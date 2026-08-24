import type { AutonomousTradingStatus, MarketRegime, Prisma, TradingBotMode, TradingBotState } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { RouteStrategyInput } from './strategy-router.schema.js';
import { getCoinPerformance } from './coin-performance.service.js';

const ROUTABLE_LIFECYCLES = new Set<AutonomousTradingStatus>(['PAPER', 'CHALLENGER', 'CHAMPION']);
const UNHEALTHY_STATES = new Set<TradingBotState>(['RISK_BLOCKED', 'EMERGENCY_STOPPED', 'ERROR']);

export type StrategyRouterEvidence = {
  botId: string; botName: string; exchangeAccountId: string; mode: TradingBotMode;
  lifecycleStatus: AutonomousTradingStatus; state: TradingBotState; desiredState: string;
  lastErrorCode: string | null; heartbeatAt: Date | null; regimeScore: number | null;
  metricAt: Date | null; riskProfileEnabled: boolean; accountKillSwitch: boolean;
  globalKillSwitch: boolean; accountActive: boolean; accountConnected: boolean; universeEnabled: boolean;
};

export type RoutedBot = {
  botId: string; botName: string; exchangeAccountId: string; regimeScore: number;
  health: 'HEALTHY' | 'DEGRADED'; routingScore: number; weight: number; reasons: string[];
};

export function selectStrategyPool(evidence: StrategyRouterEvidence[], regime: MarketRegime, input: RouteStrategyInput, now: Date) {
  const evaluated = evidence.map((item) => evaluateBot(item, regime, input, now));
  const eligible = evaluated.filter((item): item is RoutedBot & { eligible: true; failedGates: [] } => item.eligible)
    .sort((left, right) => right.routingScore - left.routingScore || right.regimeScore - left.regimeScore || left.botId.localeCompare(right.botId))
    .slice(0, input.maxBots);
  const total = eligible.reduce((sum, item) => sum + item.routingScore, 0);
  const selectedBots = eligible.map((item) => ({
    botId: item.botId, botName: item.botName, exchangeAccountId: item.exchangeAccountId,
    regimeScore: item.regimeScore, health: item.health, routingScore: item.routingScore, reasons: item.reasons,
    weight: total > 0 ? item.routingScore / total : 1 / eligible.length,
  }));
  return {
    regime,
    selectedBots,
    excludedBots: evaluated.filter((item) => !item.eligible).map((item) => ({ botId: item.botId, botName: item.botName, failedGates: item.failedGates })),
    reasonSummary: regime === 'UNKNOWN'
      ? 'No paper bots selected because the current market regime is unknown or stale.'
      : `${selectedBots.length} paper bot(s) selected deterministically for ${regime}; ${evaluated.length - selectedBots.length} excluded by score, risk, or health gates.`,
  };
}

export async function routeStrategies(userId: string, input: RouteStrategyInput, ipAddress?: string) {
  const now = new Date();
  const regimeSnapshot = await prisma.marketRegimeSnapshot.findFirst({
    where: { symbol: input.symbol, timeframe: input.timeframe, observedAt: { gte: new Date(now.getTime() - input.maxRegimeAgeMinutes * 60_000) } },
    orderBy: [{ observedAt: 'desc' }, { id: 'desc' }], select: { id: true, regime: true, confidence: true, observedAt: true },
  });
  const regime = regimeSnapshot?.regime ?? 'UNKNOWN';
  const [globalRisk, bots, coinPerformance, universeAsset] = await Promise.all([
    prisma.tradingRiskControl.findUnique({ where: { id: 'global' }, select: { globalKillSwitch: true } }),
    prisma.tradingBot.findMany({
      where: {
        userId, type: 'AUTONOMOUS', mode: 'PAPER', symbol: input.symbol, timeframe: input.timeframe,
        lifecycleStatus: { in: ['PAPER', 'CHALLENGER', 'CHAMPION'] },
      },
      select: {
        id: true, name: true, exchangeAccountId: true, mode: true, lifecycleStatus: true, state: true,
        desiredState: true, lastErrorCode: true, heartbeatAt: true,
        exchangeAccount: { select: { isActive: true, connectionStatus: true } },
        riskProfile: { select: { enabled: true, accountKillSwitch: true } },
        metrics: {
          where: { marketRegimeSnapshot: { regime } }, orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }], take: 1,
          select: { score: true, snapshotAt: true },
        },
      },
      orderBy: { id: 'asc' },
    }), getCoinPerformance(userId, { symbol: input.symbol, regime, limit: 500 }),
    prisma.tradingUniverseAsset.findUnique({ where: { userId_symbol: { userId, symbol: input.symbol } }, select: { enabled: true } }),
  ]);
  const coinPerformanceByBot = new Map(coinPerformance.map((row) => [row.tradingBotId, row]));
  const evidence: StrategyRouterEvidence[] = bots.map((bot) => ({
    botId: bot.id, botName: bot.name, exchangeAccountId: bot.exchangeAccountId, mode: bot.mode,
    lifecycleStatus: bot.lifecycleStatus, state: bot.state, desiredState: bot.desiredState,
    lastErrorCode: bot.lastErrorCode, heartbeatAt: bot.heartbeatAt,
    regimeScore: coinPerformanceByBot.get(bot.id)?.score ?? bot.metrics[0]?.score?.toNumber() ?? null,
    metricAt: coinPerformanceByBot.get(bot.id)?.latestTradeAt ?? bot.metrics[0]?.snapshotAt ?? null,
    riskProfileEnabled: bot.riskProfile?.enabled === true, accountKillSwitch: bot.riskProfile?.accountKillSwitch ?? true,
    globalKillSwitch: globalRisk?.globalKillSwitch ?? true, accountActive: bot.exchangeAccount.isActive,
    accountConnected: bot.exchangeAccount.connectionStatus === 'CONNECTED', universeEnabled: universeAsset?.enabled === true,
  }));
  const decision = selectStrategyPool(evidence, regime, input, now);
  const audit = await prisma.tradingAuditLog.create({ data: {
    userId, action: 'AI_STRATEGY_ROUTED', entityType: 'STRATEGY_ROUTER',
    metadata: {
      symbol: input.symbol, timeframe: input.timeframe, regime: decision.regime,
      regimeSnapshotId: regimeSnapshot?.id.toString() ?? null,
      regimeObservedAt: regimeSnapshot?.observedAt.toISOString() ?? null,
      regimeConfidence: regimeSnapshot?.confidence.toNumber() ?? null,
      scoreScope: 'BOT_COIN_STRATEGY_REGIME', coinPerformanceEvidence: coinPerformance,
      selectedBots: decision.selectedBots, excludedBots: decision.excludedBots,
      reasonSummary: decision.reasonSummary, deterministic: true, orderSubmitted: false, liveActivated: false,
    } as Prisma.InputJsonObject,
    ...(ipAddress ? { ipAddress } : {}),
  }, select: { id: true, createdAt: true } });
  return { ...decision, auditId: audit.id, decidedAt: audit.createdAt, deterministic: true, orderSubmitted: false, liveActivated: false };
}

function evaluateBot(item: StrategyRouterEvidence, regime: MarketRegime, input: RouteStrategyInput, now: Date) {
  const failedGates: string[] = [];
  if (regime === 'UNKNOWN') failedGates.push('UNKNOWN_REGIME');
  if (item.mode !== 'PAPER') failedGates.push('PAPER_MODE_REQUIRED');
  if (!ROUTABLE_LIFECYCLES.has(item.lifecycleStatus)) failedGates.push('LIFECYCLE_NOT_ROUTABLE');
  if (item.globalKillSwitch) failedGates.push('GLOBAL_KILL_SWITCH');
  if (!item.riskProfileEnabled) failedGates.push('RISK_PROFILE_DISABLED');
  if (item.accountKillSwitch) failedGates.push('ACCOUNT_KILL_SWITCH');
  if (!item.accountActive) failedGates.push('ACCOUNT_DISABLED');
  if (!item.accountConnected) failedGates.push('ACCOUNT_NOT_CONNECTED');
  if (!item.universeEnabled) failedGates.push('SYMBOL_OUTSIDE_TRADING_UNIVERSE');
  if (UNHEALTHY_STATES.has(item.state)) failedGates.push('BOT_STATE_UNHEALTHY');
  if (item.lastErrorCode) failedGates.push('RECENT_BOT_ERROR');
  if (item.regimeScore === null) failedGates.push('REGIME_SCORE_MISSING');
  else if (item.regimeScore < input.minimumRegimeScore) failedGates.push('REGIME_SCORE_BELOW_MINIMUM');
  if (!item.metricAt || now.getTime() - item.metricAt.getTime() > input.maxMetricAgeMinutes * 60_000) failedGates.push('REGIME_SCORE_STALE');
  if (item.state === 'RUNNING' && (!item.heartbeatAt || now.getTime() - item.heartbeatAt.getTime() > input.maxHeartbeatAgeMinutes * 60_000)) failedGates.push('HEARTBEAT_STALE');
  const health = item.state === 'RUNNING' && item.desiredState === 'RUNNING' ? 'HEALTHY' as const : 'DEGRADED' as const;
  const healthFactor = health === 'HEALTHY' ? 1 : 0.85;
  const regimeScore = item.regimeScore ?? 0;
  return {
    botId: item.botId, botName: item.botName, exchangeAccountId: item.exchangeAccountId,
    regimeScore, health, routingScore: regimeScore * healthFactor, weight: 0,
    reasons: [`${regime} score ${regimeScore.toFixed(2)}`, `${health.toLowerCase()} recent health`],
    eligible: failedGates.length === 0, failedGates,
  };
}
