import type { Prisma, TradingBotMode } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import type { PortfolioAllocatorInput } from './portfolio-allocator.schema.js';

export type PortfolioBotEvidence = {
  botId: string;
  botName: string;
  symbol: string;
  mode: TradingBotMode;
  lifecycleStatus: string;
  score: number | null;
  regimeFit: number | null;
  recentDrawdown: number;
  volatility: number | null;
  correlation: number | null;
  currentExposure: number;
  metricAt: Date | null;
};

export type PortfolioRiskLimits = {
  enabled: boolean;
  accountKillSwitch: boolean;
  globalKillSwitch: boolean;
  maxAccountOpenNotional: number;
  maxSymbolOpenNotional: number;
  maxOrderNotional: number;
  maxDrawdownPct: number;
};

export type PortfolioAllocationConfig = Pick<PortfolioAllocatorInput,
  'mode' | 'capital' | 'cashReservePct' | 'maxBotAllocationPct' | 'maxSymbolAllocationPct' | 'maxMetricAgeMinutes'>;

export function allocatePortfolio(
  evidence: PortfolioBotEvidence[],
  risk: PortfolioRiskLimits,
  config: PortfolioAllocationConfig,
  now: Date,
) {
  const excludedBots: Array<{ botId: string; failedGates: string[] }> = [];
  const eligible = evidence.flatMap((bot) => {
    const failedGates = evaluateGates(bot, risk, config, now);
    if (failedGates.length > 0) {
      excludedBots.push({ botId: bot.botId, failedGates });
      return [];
    }
    return [{ ...bot, allocationScore: allocationScore(bot, risk) }];
  }).sort((left, right) => right.allocationScore - left.allocationScore || left.botId.localeCompare(right.botId));

  const currentTotalExposure = evidence.reduce((sum, bot) => sum + Math.max(0, bot.currentExposure), 0);
  const currentSymbolExposure = new Map<string, number>();
  for (const bot of evidence) currentSymbolExposure.set(bot.symbol, (currentSymbolExposure.get(bot.symbol) ?? 0) + Math.max(0, bot.currentExposure));
  const requestedDeployable = config.capital * (1 - config.cashReservePct);
  const totalRiskCapacity = risk.maxAccountOpenNotional === 0 ? requestedDeployable : Math.max(0, risk.maxAccountOpenNotional - currentTotalExposure);
  const target = Math.min(requestedDeployable, totalRiskCapacity);
  const remainingBotCapacity = new Map(eligible.map((bot) => [bot.botId,
    Math.max(0, Math.min(config.capital * config.maxBotAllocationPct, unlimitedAs(risk.maxOrderNotional, config.capital)) - bot.currentExposure)]));
  const remainingSymbolCapacity = new Map(eligible.map((bot) => [bot.symbol,
    Math.max(0, Math.min(config.capital * config.maxSymbolAllocationPct, unlimitedAs(risk.maxSymbolOpenNotional, config.capital)) - (currentSymbolExposure.get(bot.symbol) ?? 0))]));
  const amounts = waterfill(eligible, target, remainingBotCapacity, remainingSymbolCapacity);
  const botAllocations = eligible.map((bot) => {
    const amount = roundMoney(amounts.get(bot.botId) ?? 0);
    return {
      botId: bot.botId, botName: bot.botName, symbol: bot.symbol,
      allocationPct: roundRatio(amount / config.capital), allocationAmount: amount,
      allocationScore: roundScore(bot.allocationScore), currentExposure: roundMoney(bot.currentExposure),
      factors: {
        botScore: bot.score, regimeFit: bot.regimeFit, recentDrawdown: bot.recentDrawdown,
        volatility: bot.volatility, correlation: bot.correlation,
      },
    };
  }).filter((item) => item.allocationAmount > 0);
  const symbolTotals = new Map<string, number>();
  for (const item of botAllocations) symbolTotals.set(item.symbol, (symbolTotals.get(item.symbol) ?? 0) + item.allocationAmount);
  const symbolAllocations = [...symbolTotals.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([symbol, amount]) => ({
    symbol, allocationAmount: roundMoney(amount), allocationPct: roundRatio(amount / config.capital),
  }));
  const allocatedCapital = roundMoney(botAllocations.reduce((sum, item) => sum + item.allocationAmount, 0));
  return {
    mode: config.mode, capital: config.capital, allocatedCapital,
    reservePct: roundRatio(1 - allocatedCapital / config.capital),
    botAllocations, symbolAllocations, excludedBots,
    deterministic: true, orderSubmitted: false, liveActivated: false,
  };
}

export async function createPortfolioAllocation(userId: string, input: PortfolioAllocatorInput, ipAddress?: string) {
  const now = new Date();
  const account = await prisma.exchangeAccount.findFirst({
    where: { id: input.exchangeAccountId, userId },
    include: { riskProfile: true },
  });
  if (!account) throw new ApiError(404, 'Exchange account not found.', 'EXCHANGE_ACCOUNT_NOT_FOUND');
  if (account.environment !== 'TESTNET' && account.environment !== 'DEMO') {
    throw new ApiError(409, 'Portfolio allocation requires a testnet or demo account.', 'SAFE_ENVIRONMENT_REQUIRED');
  }
  const globalRisk = await prisma.tradingRiskControl.findUnique({ where: { id: 'global' } });
  const profile = account.riskProfile;
  if (!profile) throw new ApiError(409, 'Risk profile is required.', 'RISK_PROFILE_REQUIRED');
  const bots = await prisma.tradingBot.findMany({
    where: { userId, exchangeAccountId: input.exchangeAccountId, type: 'AUTONOMOUS', mode: input.mode, lifecycleStatus: 'CHAMPION' },
    include: {
      paperPosition: true,
      paperTrades: {
        where: { status: 'CLOSED' }, orderBy: [{ closedAt: 'desc' }, { id: 'desc' }], take: 100,
        select: { realizedPnl: true },
      },
      metrics: {
        orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }], take: 50,
        include: { marketRegimeSnapshot: { select: { regime: true } } },
      },
    },
    orderBy: { id: 'asc' },
  });
  const currentRegimes = new Map<string, string | null>();
  await Promise.all([...new Set(bots.map((bot) => `${bot.symbol}\u0000${bot.timeframe ?? ''}`))].map(async (key) => {
    const [symbol, timeframe] = key.split('\u0000') as [string, string];
    const snapshot = timeframe ? await prisma.marketRegimeSnapshot.findFirst({
      where: { symbol, timeframe }, orderBy: [{ observedAt: 'desc' }, { id: 'desc' }], select: { regime: true },
    }) : null;
    currentRegimes.set(key, snapshot?.regime ?? null);
  }));
  const returnsByBot = new Map(bots.map((bot) => [bot.id,
    bot.paperTrades.map((trade) => trade.realizedPnl.toNumber() / Math.max(bot.startingPaperBalance.toNumber(), 0.000001)).reverse()]));
  const evidence: PortfolioBotEvidence[] = bots.map((bot) => {
    const metric = bot.metrics[0];
    const currentRegime = currentRegimes.get(`${bot.symbol}\u0000${bot.timeframe ?? ''}`) ?? null;
    const regimeMetric = currentRegime ? bot.metrics.find((item) => item.marketRegimeSnapshot?.regime === currentRegime) : undefined;
    const returns = returnsByBot.get(bot.id) ?? [];
    const peerReturns = bots.filter((peer) => peer.id !== bot.id).map((peer) => returnsByBot.get(peer.id) ?? []);
    const position = bot.paperPosition;
    return {
      botId: bot.id, botName: bot.name, symbol: bot.symbol, mode: bot.mode, lifecycleStatus: bot.lifecycleStatus,
      score: metric?.score?.toNumber() ?? null,
      regimeFit: regimeMetric?.score?.toNumber() ?? null,
      recentDrawdown: metric?.maxDrawdown.toNumber() ?? 1,
      volatility: normalizedVolatility(returns), correlation: averageCorrelation(returns, peerReturns),
      currentExposure: position ? Math.abs(position.netQuantity.toNumber() * position.lastMarkPrice.toNumber()) : 0,
      metricAt: metric?.snapshotAt ?? null,
    };
  });
  const risk: PortfolioRiskLimits = {
    enabled: profile.enabled, accountKillSwitch: profile.accountKillSwitch,
    globalKillSwitch: globalRisk?.globalKillSwitch ?? true,
    maxAccountOpenNotional: profile.maxAccountOpenNotional.toNumber(),
    maxSymbolOpenNotional: profile.maxSymbolOpenNotional.toNumber(),
    maxOrderNotional: profile.maxOrderNotional.toNumber(), maxDrawdownPct: profile.maxDrawdownPct.toNumber(),
  };
  const decision = allocatePortfolio(evidence, risk, input, now);
  const saved = await prisma.$transaction(async (tx) => {
    const allocation = await tx.portfolioAllocation.create({ data: {
      userId, exchangeAccountId: input.exchangeAccountId, mode: input.mode, capital: input.capital,
      allocatedCapital: decision.allocatedCapital, reservePct: decision.reservePct,
      botAllocations: decision.botAllocations as unknown as Prisma.InputJsonValue,
      symbolAllocations: decision.symbolAllocations as unknown as Prisma.InputJsonValue,
      riskSnapshot: risk, config: input, deterministic: true, orderSubmitted: false, liveActivated: false,
    } });
    await tx.tradingAuditLog.create({ data: {
      userId, exchangeAccountId: input.exchangeAccountId, action: 'AI_PORTFOLIO_ALLOCATED',
      entityType: 'PORTFOLIO_ALLOCATION', entityId: allocation.id,
      metadata: { mode: input.mode, allocatedCapital: decision.allocatedCapital, reservePct: decision.reservePct,
        botAllocations: decision.botAllocations, symbolAllocations: decision.symbolAllocations,
        deterministic: true, orderSubmitted: false, liveActivated: false },
      ...(ipAddress ? { ipAddress } : {}),
    } });
    return allocation;
  });
  return { id: saved.id, createdAt: saved.createdAt, ...decision };
}

export async function listPortfolioAllocations(userId: string, query: {
  exchangeAccountId?: string | undefined;
  mode?: 'PAPER' | 'SHADOW' | undefined;
  limit: number;
}) {
  return prisma.portfolioAllocation.findMany({
    where: { userId, ...(query.exchangeAccountId ? { exchangeAccountId: query.exchangeAccountId } : {}), ...(query.mode ? { mode: query.mode } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.limit,
  });
}

function evaluateGates(bot: PortfolioBotEvidence, risk: PortfolioRiskLimits, config: PortfolioAllocationConfig, now: Date) {
  const failed: string[] = [];
  if (!risk.enabled) failed.push('RISK_PROFILE_DISABLED');
  if (risk.accountKillSwitch) failed.push('ACCOUNT_KILL_SWITCH');
  if (risk.globalKillSwitch) failed.push('GLOBAL_KILL_SWITCH');
  if (bot.mode !== config.mode || (bot.mode !== 'PAPER' && bot.mode !== 'SHADOW')) failed.push('SAFE_MODE_REQUIRED');
  if (bot.lifecycleStatus !== 'CHAMPION') failed.push('CHAMPION_REQUIRED');
  if (bot.score === null) failed.push('BOT_SCORE_MISSING');
  if (bot.regimeFit === null) failed.push('REGIME_FIT_MISSING');
  if (bot.volatility === null) failed.push('VOLATILITY_MISSING');
  if (bot.correlation === null) failed.push('CORRELATION_MISSING');
  if (!bot.metricAt || now.getTime() - bot.metricAt.getTime() > config.maxMetricAgeMinutes * 60_000) failed.push('METRIC_STALE');
  if (bot.recentDrawdown > risk.maxDrawdownPct) failed.push('MAX_DRAWDOWN_EXCEEDED');
  return failed;
}

function allocationScore(bot: PortfolioBotEvidence, risk: PortfolioRiskLimits) {
  const score = clamp((bot.score ?? 0) / 100);
  const regime = clamp((bot.regimeFit ?? 0) / 100);
  const drawdown = 1 - clamp(bot.recentDrawdown / Math.max(risk.maxDrawdownPct, 0.000001));
  const volatility = 1 - clamp(bot.volatility ?? 1);
  const correlation = 1 - clamp(((bot.correlation ?? 1) + 1) / 2);
  const exposure = risk.maxOrderNotional === 0 ? 1 : 1 - clamp(bot.currentExposure / Math.max(risk.maxOrderNotional, 0.000001));
  return score * 0.35 + regime * 0.25 + drawdown * 0.15 + volatility * 0.1 + correlation * 0.1 + exposure * 0.05;
}

function unlimitedAs(limit: number, fallback: number) { return limit === 0 ? fallback : limit; }

function waterfill(
  bots: Array<PortfolioBotEvidence & { allocationScore: number }>, target: number,
  botCapacity: Map<string, number>, symbolCapacity: Map<string, number>,
) {
  const result = new Map<string, number>();
  let active = bots.filter((bot) => (botCapacity.get(bot.botId) ?? 0) > 0 && (symbolCapacity.get(bot.symbol) ?? 0) > 0);
  let remaining = target;
  for (let iteration = 0; iteration < bots.length + 1 && remaining > 0.00000001 && active.length > 0; iteration += 1) {
    const totalWeight = active.reduce((sum, bot) => sum + Math.max(bot.allocationScore, 0.000001), 0);
    let distributed = 0;
    for (const bot of active) {
      const share = remaining * Math.max(bot.allocationScore, 0.000001) / totalWeight;
      const amount = Math.min(share, botCapacity.get(bot.botId) ?? 0, symbolCapacity.get(bot.symbol) ?? 0);
      if (amount <= 0) continue;
      result.set(bot.botId, (result.get(bot.botId) ?? 0) + amount);
      botCapacity.set(bot.botId, (botCapacity.get(bot.botId) ?? 0) - amount);
      symbolCapacity.set(bot.symbol, (symbolCapacity.get(bot.symbol) ?? 0) - amount);
      distributed += amount;
    }
    remaining -= distributed;
    if (distributed <= 0.00000001) break;
    active = active.filter((bot) => (botCapacity.get(bot.botId) ?? 0) > 0.00000001 && (symbolCapacity.get(bot.symbol) ?? 0) > 0.00000001);
  }
  return result;
}

function normalizedVolatility(returns: number[]) {
  if (returns.length < 2) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  return clamp(Math.sqrt(variance) / 0.05);
}
function averageCorrelation(returns: number[], peers: number[][]) {
  if (peers.length === 0) return 0;
  const values = peers.map((peer) => pearsonCorrelation(returns, peer)).filter((value): value is number => value !== null);
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
function pearsonCorrelation(left: number[], right: number[]) {
  const count = Math.min(left.length, right.length);
  if (count < 2) return null;
  const a = left.slice(-count); const b = right.slice(-count);
  const meanA = a.reduce((sum, value) => sum + value, 0) / count;
  const meanB = b.reduce((sum, value) => sum + value, 0) / count;
  let covariance = 0; let varianceA = 0; let varianceB = 0;
  for (let index = 0; index < count; index += 1) {
    const deltaA = a[index]! - meanA; const deltaB = b[index]! - meanB;
    covariance += deltaA * deltaB; varianceA += deltaA * deltaA; varianceB += deltaB * deltaB;
  }
  const denominator = Math.sqrt(varianceA * varianceB);
  return denominator > 0 ? Math.max(-1, Math.min(1, covariance / denominator)) : 0;
}
function clamp(value: number) { return Math.max(0, Math.min(1, value)); }
function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100_000_000) / 100_000_000; }
function roundRatio(value: number) { return Math.round(clamp(value) * 1_000_000) / 1_000_000; }
function roundScore(value: number) { return Math.round(value * 1_000_000) / 1_000_000; }
