import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';
import { adapterFor } from '../trading/exchange-account.service.js';
import type { ExchangeOrder } from '../trading/exchanges/exchange-adapter.js';
import { cancelTradingEngineOrder, getTradingEngineSnapshot } from '../trading/trading-engine.client.js';
import { ensureCoreTradingUniverse, getEnabledTradingSymbols } from './trading-universe.service.js';

let universeCycleRunning = false;
export const TESTNET_ROTATION_SETTLE_MS = 15_000;
export const PAPER_TRAINING_MAX_OPEN_POSITIONS = 100;
export const PAPER_TRAINING_STOP_LOSS_BPS = 2_000;
export const PAPER_TRAINING_TAKE_PROFIT_BPS = 300;
export const PAPER_TRAINING_MIN_NET_PROFIT_BPS = 300;
export const PAPER_TRAINING_INTERVAL_SECONDS = 5;
export const PAPER_TRAINING_MIN_INITIAL_MARGIN_USDT = 20;
export const PAPER_TRAINING_MAX_RISK_PER_TRADE_PCT = 0.05;

export function universeCandidate(symbols: string[], slot: number, index: number, cohortSize: number) {
  if (symbols.length === 0) throw new Error('Futures universe is empty.');
  const offset = ((slot % symbols.length) * (cohortSize % symbols.length)) % symbols.length;
  return symbols[(offset + index) % symbols.length]!;
}

export function fleetLeverage(index: number, population: number) {
  if (population <= 1) return 5;
  return 5 + Math.round(index * 15 / (population - 1));
}

export function staleAutonomousProtection(order: ExchangeOrder, occupiedSymbols: Set<string>) {
  return order.reduceOnly && order.clientOrderId.startsWith('ka')
    && ['STOP_MARKET', 'TAKE_PROFIT_MARKET'].includes(order.type) && !occupiedSymbols.has(order.symbol);
}

function configuration(value: Prisma.JsonValue, leverage: number, extra: Prisma.InputJsonObject = {}): Prisma.InputJsonObject {
  const source = value && !Array.isArray(value) && typeof value === 'object' ? value as Prisma.JsonObject : {};
  return { ...source, side: 'BOTH', leverage, marginMode: 'ISOLATED', allocationUsdt: botAllocationUsdt(value, 100), positionNotionalPct: 0.10, pyramidingEnabled: true, ...extra };
}

export function paperTrainingConfiguration(value: Prisma.JsonValue, leverage: number, extra: Prisma.InputJsonObject = {}): Prisma.InputJsonObject {
  const source = configuration(value, leverage);
  const configuredThreshold = Number(source.signalThresholdBps);
  const configuredStop = Number(source.stopLossBps);
  const configuredTarget = Number(source.takeProfitBps);
  const stopLossBps = Number.isFinite(configuredStop) && configuredStop > 0 ? Math.min(configuredStop, PAPER_TRAINING_STOP_LOSS_BPS) : PAPER_TRAINING_STOP_LOSS_BPS;
  const takeProfitBps = Number.isFinite(configuredTarget) && configuredTarget > 0 ? Math.max(configuredTarget, PAPER_TRAINING_TAKE_PROFIT_BPS) : PAPER_TRAINING_TAKE_PROFIT_BPS;
  return {
    ...source, ...extra, paperTrainingMode: true,
    signalThresholdBps: Number.isFinite(configuredThreshold) ? Math.min(configuredThreshold, 10) : 10,
    stopLossBps, takeProfitBps,
    minimumNetProfitBps: PAPER_TRAINING_MIN_NET_PROFIT_BPS,
    minimumInitialMarginUsdt: PAPER_TRAINING_MIN_INITIAL_MARGIN_USDT,
    paperMaxRiskPerTradePct: PAPER_TRAINING_MAX_RISK_PER_TRADE_PCT,
    paperAlwaysInMarket: true,
    adaptiveStopMinBps: 75, adaptiveStopMaxBps: stopLossBps,
    riskRewardRatio: 1.5, trailingStopBps: stopLossBps,
    pyramidingEnabled: false, independentPaperTrades: true,
  };
}

export function botAllocationUsdt(value: Prisma.JsonValue, fallback = 100) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return fallback;
  const candidate = Number((value as Prisma.JsonObject).allocationUsdt);
  return Number.isFinite(candidate) && candidate >= 10 && candidate <= 200 ? candidate : fallback;
}

export function automaticCapitalScaleTarget(allocation: number, startingBalance: number, totalTrades: number, currentEquity: number) {
  return allocation < 200 && totalTrades >= 200 && currentEquity > startingBalance ? 200 : allocation;
}

export function rotationPending(value: Prisma.JsonValue) {
  return Boolean(value && !Array.isArray(value) && typeof value === 'object' && (value as Prisma.JsonObject).universeRotationPending === true);
}

export function schedulerLeaseActive(owner: string | null, expiresAt: Date | null, now: Date) {
  return owner !== null && expiresAt !== null && expiresAt.getTime() > now.getTime();
}

function availableBotWhere(id: string, now: Date): Prisma.TradingBotWhereInput {
  return { id, OR: [{ schedulerOwner: null }, { leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }] };
}

export async function runAutonomousUniverseCycle(now = new Date()) {
  if (universeCycleRunning) return { status: 'LOCKED' as const };
  universeCycleRunning = true;
  try {
    const autonomousOwners = await prisma.tradingBot.findMany({ where: { type: 'AUTONOMOUS' }, distinct: ['userId'], select: { userId: true } });
    await Promise.all(autonomousOwners.map((owner) => ensureCoreTradingUniverse(owner.userId)));
    const account = await prisma.exchangeAccount.findFirst({
      where: { provider: 'BINANCE', environment: 'TESTNET', accountType: 'USDT_M', executionEngine: 'GO', isActive: true },
      include: { riskProfile: true }, orderBy: { createdAt: 'asc' },
    });
    if (!account?.riskProfile?.enabled || account.riskProfile.accountKillSwitch) return { status: 'ACCOUNT_NOT_READY' as const };
    const adapter = adapterFor(account);
    const privateExecutionReady = account.connectionStatus === 'CONNECTED';
    const [rules, bots, configuredSymbols] = await Promise.all([
      adapter.getSymbols(),
      prisma.tradingBot.findMany({
        where: {
          userId: account.userId, type: 'AUTONOMOUS', mode: { in: ['PAPER', 'DEMO'] }, lifecycleStatus: 'PAPER',
          OR: [
            { desiredState: 'RUNNING' },
            { mode: 'DEMO', state: 'PAUSED', stateReason: { startsWith: 'TESTNET universe rotation staged' } },
          ],
        },
        include: { paperPosition: { select: { netQuantity: true } }, metrics: { orderBy: { snapshotAt: 'desc' }, take: 1, select: { totalTrades: true, currentEquity: true } } }, orderBy: [{ mode: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }), getEnabledTradingSymbols(account.userId),
    ]);
    // PAPER rotation only needs public exchange metadata. A degraded private
    // TESTNET account must pause DEMO reconciliation/execution without
    // stranding the independent simulation fleet on stale symbols.
    const snapshot = privateExecutionReady
      ? await getTradingEngineSnapshot(account)
      : { balances: [], symbols: rules, orders: [], positions: [] };
    const positions = snapshot.positions;
    const exchangeSymbols = rules.filter((rule) => rule.maxLeverage >= 20).map((rule) => rule.symbol).sort();
    const exchangeAllowed = new Set(exchangeSymbols);
    const symbols = configuredSymbols.filter((symbol) => exchangeAllowed.has(symbol));
    if (symbols.length === 0) throw new Error('Core Trading Universe has no enabled Binance TESTNET USDT perpetual symbol supporting 20x.');
    const occupied = new Set(positions.filter((position) => Number(position.quantity) !== 0).map((position) => position.symbol));
    const paper = bots.filter((bot) => bot.mode === 'PAPER');
    const demo = privateExecutionReady ? bots.filter((bot) => bot.mode === 'DEMO') : [];
    const slot = Math.floor(now.getTime() / (env.AI_TRADING_UNIVERSE_INTERVAL_MINUTES * 60_000));
    const updates: Array<ReturnType<typeof prisma.tradingBot.updateMany>> = [];
    let rotatedPaper = 0;
    let rotatedDemo = 0;
    let stagedDemo = 0;
    let adjustedPositions = 0;
    let canceledStaleProtectives = 0;
    let autoScaledCapital = 0;

    const scaleTarget = new Map(bots.map((bot) => {
      const allocation = botAllocationUsdt(bot.configuration, bot.startingPaperBalance.toNumber());
      const latest = bot.metrics[0];
      const target = automaticCapitalScaleTarget(allocation, bot.startingPaperBalance.toNumber(), latest?.totalTrades ?? 0, latest?.currentEquity.toNumber() ?? 0);
      if (target > allocation) autoScaledCapital += 1;
      return [bot.id, target] as const;
    }));

    for (const order of snapshot.orders.filter((item) => staleAutonomousProtection(item, occupied))) {
      await cancelTradingEngineOrder(account, order.exchangeOrderId, order.symbol, `ai_stale_${order.exchangeOrderId}_${slot}`);
      canceledStaleProtectives += 1;
    }

    // The user-approved TESTNET leverage band also applies to positions that
    // were opened before this rollout. Binance keeps their reduce-only
    // protection orders while the isolated leverage setting is updated.
    for (let index = 0; index < demo.length; index += 1) {
      const bot = demo[index]!;
      const position = positions.find((item) => item.symbol === bot.symbol && Number(item.quantity) !== 0);
      const leverage = fleetLeverage(index, demo.length);
      const currentLeverage = Number(position?.leverage ?? 0);
      if (position && (currentLeverage < 5 || currentLeverage > 20)) {
        await adapter.configurePosition(bot.symbol, leverage, 'ISOLATED');
        adjustedPositions += 1;
      }
    }

    for (let index = 0; index < paper.length; index += 1) {
      const bot = paper[index]!;
      const leverage = fleetLeverage(index % 16, 16);
      const flat = !bot.paperPosition || bot.paperPosition.netQuantity.isZero();
      const target = flat ? universeCandidate(symbols, slot, index, paper.length) : bot.symbol;
      if (!exchangeAllowed.has(target)) continue;
      const changedSymbol = target !== bot.symbol;
      const allocation = scaleTarget.get(bot.id) ?? botAllocationUsdt(bot.configuration);
      // Runtime policy is safe to refresh while a trade is open; symbol
      // rotation is not. Keeping these updates separate makes the 20 USDT
      // margin/continuous-training policy effective on the next engine cycle
      // without mutating the market of an active position.
      updates.push(prisma.tradingBot.updateMany({ where: { id: bot.id, mode: 'PAPER' }, data: {
        intervalSeconds: PAPER_TRAINING_INTERVAL_SECONDS,
        configuration: paperTrainingConfiguration(bot.configuration, leverage, { allocationUsdt: allocation }),
        ...(allocation > botAllocationUsdt(bot.configuration, bot.startingPaperBalance.toNumber()) ? { startingPaperBalance: allocation } : {}),
        version: { increment: 1 },
      } }));
      updates.push(prisma.tradingBot.updateMany({ where: {
        id: bot.id, symbol: bot.symbol,
        OR: [{ paperPosition: { is: null } }, { paperPosition: { is: { netQuantity: 0 } } }],
      }, data: {
        symbol: target, symbols: [target],
        version: { increment: 1 },
      } }));
      if (changedSymbol) rotatedPaper += 1;
    }

    const reserved = new Set(occupied);
    for (let index = 0; index < demo.length; index += 1) {
      const bot = demo[index]!;
      if (schedulerLeaseActive(bot.schedulerOwner, bot.leaseExpiresAt, now)) continue;
      const leverage = fleetLeverage(index, demo.length);
      const hasPosition = occupied.has(bot.symbol);
      const pending = rotationPending(bot.configuration);
      const allocation = scaleTarget.get(bot.id) ?? botAllocationUsdt(bot.configuration);
      let target = bot.symbol;
      if (pending && !hasPosition) {
        for (let attempt = 0; attempt < symbols.length; attempt += 1) {
          const candidate = universeCandidate(symbols, slot, index + attempt, demo.length);
          if (!reserved.has(candidate)) { target = candidate; break; }
        }
      }
      if (!exchangeAllowed.has(target)) continue;
      reserved.add(target);
      const changedSymbol = target !== bot.symbol;
      if (!hasPosition && !pending) {
        updates.push(prisma.tradingBot.updateMany({ where: availableBotWhere(bot.id, now), data: {
          configuration: configuration(bot.configuration, leverage, { universeRotationPending: true, allocationUsdt: allocation }),
          ...(allocation > botAllocationUsdt(bot.configuration, bot.startingPaperBalance.toNumber()) ? { startingPaperBalance: allocation } : {}),
          state: 'PAUSED', desiredState: 'PAUSED', schedulerOwner: null, leaseExpiresAt: null, heartbeatAt: null,
          stateReason: 'TESTNET universe rotation staged; next cycle verifies the old symbol is still flat.', version: { increment: 1 },
        } }));
        stagedDemo += 1;
        continue;
      }
      updates.push(prisma.tradingBot.updateMany({ where: availableBotWhere(bot.id, now), data: {
        symbol: target, symbols: [target], configuration: configuration(bot.configuration, leverage, { universeRotationPending: false, allocationUsdt: allocation }),
        ...(allocation > botAllocationUsdt(bot.configuration, bot.startingPaperBalance.toNumber()) ? { startingPaperBalance: allocation } : {}),
        ...(pending ? { desiredState: 'RUNNING', state: 'STARTING', schedulerOwner: null, leaseExpiresAt: null, heartbeatAt: null,
          stateReason: hasPosition ? 'A position appeared during staged rotation; original symbol preserved.' : 'Staged flat TESTNET bot rotated safely through the Futures universe.' } : {}),
        ...(changedSymbol ? { name: `AI TESTNET Universe #${String(index + 1).padStart(2, '0')} ${target}` } : {}),
        version: { increment: 1 },
      } }));
      if (changedSymbol) rotatedDemo += 1;
    }

    const projectedDemoAllocation = demo.reduce((sum, bot) => sum + (scaleTarget.get(bot.id) ?? botAllocationUsdt(bot.configuration, bot.startingPaperBalance.toNumber())), 0);
    await prisma.$transaction([
      ...updates,
      prisma.tradingAuditLog.create({ data: {
        userId: account.userId, exchangeAccountId: account.id, action: 'AI_FUTURES_UNIVERSE_ROTATED', entityType: 'EXCHANGE_ACCOUNT', entityId: account.id,
        metadata: { universeSize: symbols.length, rotatedPaper, rotatedDemo, stagedDemo, adjustedPositions, canceledStaleProtectives, autoScaledCapital,
          paperTrainingPolicy: { adminConfiguredMaxOpenPositions: account.riskProfile.maxOpenPositions,
            maxOpenPositionsCeiling: PAPER_TRAINING_MAX_OPEN_POSITIONS, stopLossBps: PAPER_TRAINING_STOP_LOSS_BPS,
            takeProfitBps: PAPER_TRAINING_TAKE_PROFIT_BPS, intervalSeconds: PAPER_TRAINING_INTERVAL_SECONDS,
            minimumInitialMarginUsdt: PAPER_TRAINING_MIN_INITIAL_MARGIN_USDT,
            maximumRiskPerTradePct: PAPER_TRAINING_MAX_RISK_PER_TRADE_PCT, alwaysInMarket: true },
          riskProfileOwnership: 'ADMIN_MANAGED_NOT_MUTATED_BY_UNIVERSE_WORKER',
          automaticScaleRule: { minimumClosedTrades: 200, profitableEquityRequired: true, targetAllocationUsdt: 200 },
          projectedDemoAllocation, leverageMin: 5, leverageMax: 20, productionLive: false, occupiedSymbolsPreserved: [...occupied] },
      } }),
    ]);
    return { status: 'ROTATED' as const, universeSize: symbols.length, paperBots: paper.length, demoBots: demo.length, rotatedPaper, rotatedDemo, stagedDemo, adjustedPositions, canceledStaleProtectives, autoScaledCapital, occupied: occupied.size };
  } finally {
    universeCycleRunning = false;
  }
}

export function scheduleAutonomousUniverse() {
  const execute = () => void runAutonomousUniverseCycle().then((result) => {
    logger.info({ result }, 'autonomous Futures universe cycle');
    if (result.status === 'ROTATED' && result.stagedDemo > 0) {
      const settleTimer = setTimeout(execute, TESTNET_ROTATION_SETTLE_MS);
      settleTimer.unref();
    }
  })
    .catch((error) => logger.error({ err: error }, 'autonomous Futures universe cycle failed'));
  execute();
  const timer = setInterval(execute, env.AI_TRADING_UNIVERSE_INTERVAL_MINUTES * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
