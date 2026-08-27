import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';
import { adapterFor } from '../trading/exchange-account.service.js';
import { getBinanceFuturesPublicSymbols } from '../trading/exchanges/binance-futures.adapter.js';
import type { ExchangeOrder } from '../trading/exchanges/exchange-adapter.js';
import { cancelTradingEngineOrder, getTradingEngineSnapshot } from '../trading/trading-engine.client.js';
import { ensureCoreTradingUniverse, getEnabledTradingSymbols } from './trading-universe.service.js';

let universeCycleRunning = false;
export const TESTNET_ROTATION_SETTLE_MS = 15_000;
export const PAPER_TRAINING_MAX_OPEN_POSITIONS = 100;
export const PAPER_TRAINING_STOP_LOSS_BPS = 2_000;
export const PAPER_TRAINING_TAKE_PROFIT_BPS = 300;
export const PAPER_TRAINING_MIN_NET_PROFIT_BPS = 300;
// Strategies use 15m/1h candles, so evaluating every five seconds only creates
// duplicate decisions and bursts Binance private API reads. One cycle per bot
// per minute keeps execution responsive while leaving ample request-weight
// headroom for reconciliation and protective orders.
export const PAPER_TRAINING_INTERVAL_SECONDS = 60;
// TESTNET may evaluate slightly more often than PAPER while remaining far
// above the old burst-prone five-second cadence. Twenty bots at this interval
// produce about 27 decision cycles/minute; order writes remain independently
// rate-limited and same-candle duplicate entries are still suppressed.
export const TESTNET_DECISION_INTERVAL_SECONDS = 45;
export const PAPER_TRAINING_MIN_INITIAL_MARGIN_USDT = 20;
export const PAPER_TRAINING_MAX_RISK_PER_TRADE_PCT = 0.05;
export const TESTNET_TREND_GRID_STEP_BPS = 25;
export const TESTNET_TRANSITION_MIN_CONFIRMED_TIMEFRAMES = 2;
export const TESTNET_TRANSITION_MIN_ATR_BPS = 20;
export const TESTNET_MIN_TAKE_PROFIT_BPS = 100;
export const TESTNET_MAX_ADAPTIVE_STOP_BPS = 1_000;
export const TESTNET_ESTIMATED_ROUND_TRIP_COST_BPS = 20;
export const TESTNET_DEFAULT_MIN_INITIAL_MARGIN_USDT = 20;

export function universeCandidate(symbols: string[], slot: number, index: number, cohortSize: number) {
  if (symbols.length === 0) throw new Error('Futures universe is empty.');
  const offset = ((slot % symbols.length) * (cohortSize % symbols.length)) % symbols.length;
  return symbols[(offset + index) % symbols.length]!;
}

export function fleetLeverage(index: number, population: number, minimum = 5, maximum = 20) {
  const min = Math.max(1, Math.min(20, Math.round(minimum)));
  const max = Math.max(min, Math.min(20, Math.round(maximum)));
  if (population <= 1) return min;
  return min + Math.round(index * (max - min) / (population - 1));
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
  const configuredMinimumMargin = Number(extra.minimumInitialMarginUsdt ?? source.minimumInitialMarginUsdt);
  return {
    ...source, ...extra, paperTrainingMode: true,
    signalThresholdBps: Number.isFinite(configuredThreshold) ? Math.min(configuredThreshold, 10) : 10,
    stopLossBps, takeProfitBps,
    minimumNetProfitBps: PAPER_TRAINING_MIN_NET_PROFIT_BPS,
    minimumInitialMarginUsdt: Number.isFinite(configuredMinimumMargin) && configuredMinimumMargin > 0 ? configuredMinimumMargin : PAPER_TRAINING_MIN_INITIAL_MARGIN_USDT,
    paperMaxRiskPerTradePct: PAPER_TRAINING_MAX_RISK_PER_TRADE_PCT,
    paperAlwaysInMarket: true,
    adaptiveStopMinBps: 75, adaptiveStopMaxBps: stopLossBps,
    riskRewardRatio: 1.5, trailingStopBps: stopLossBps,
    pyramidingEnabled: false, independentPaperTrades: true,
  };
}

export function testnetExecutionConfiguration(value: Prisma.JsonValue, leverage: number, extra: Prisma.InputJsonObject = {}): Prisma.InputJsonObject {
  const source = configuration(value, leverage);
  const configuredThreshold = Number(source.signalThresholdBps);
  const configuredMinimumMargin = Number(extra.minimumInitialMarginUsdt ?? source.minimumInitialMarginUsdt);
  const configuredStop = Number(extra.stopLossBps ?? source.stopLossBps);
  const configuredTarget = Number(extra.takeProfitBps ?? source.takeProfitBps);
  const stopLossBps = Number.isFinite(configuredStop) && configuredStop >= 50 && configuredStop <= TESTNET_MAX_ADAPTIVE_STOP_BPS ? configuredStop : TESTNET_MAX_ADAPTIVE_STOP_BPS;
  const takeProfitBps = Number.isFinite(configuredTarget) && configuredTarget >= 50 && configuredTarget <= 5_000 ? configuredTarget : TESTNET_MIN_TAKE_PROFIT_BPS;
  return {
    ...source, ...extra,
    paperTrainingMode: false,
    paperAlwaysInMarket: false,
    independentPaperTrades: false,
    testnetExecutionProfile: true,
    testnetContinuousExecution: true,
    testnetTrendGridEnabled: true,
    testnetGridStepBps: TESTNET_TREND_GRID_STEP_BPS,
    testnetTransitionRegimeEnabled: true,
    testnetTransitionMinConfirmedTimeframes: TESTNET_TRANSITION_MIN_CONFIRMED_TIMEFRAMES,
    testnetTransitionMinAtrBps: TESTNET_TRANSITION_MIN_ATR_BPS,
    analysisTimeframes: ['15m', '1h'],
    directionWindowsHours: [24, 48],
    signalThresholdBps: Number.isFinite(configuredThreshold) ? Math.min(configuredThreshold, 10) : 10,
    stopLossBps,
    takeProfitBps,
    estimatedRoundTripCostBps: TESTNET_ESTIMATED_ROUND_TRIP_COST_BPS,
    minimumTakeProfitBps: takeProfitBps,
    minimumInitialMarginUsdt: Number.isFinite(configuredMinimumMargin) && configuredMinimumMargin > 0 ? configuredMinimumMargin : TESTNET_DEFAULT_MIN_INITIAL_MARGIN_USDT,
    testnetMarginAllocationMode: true,
    testnetMaxRiskPerTradePct: 0.20,
    adaptiveStopMinBps: Math.min(75, stopLossBps),
    adaptiveStopMaxBps: stopLossBps,
    fixedTestnetProtectionTargets: true,
    riskRewardRatio: 1.5,
    pyramidingEnabled: true,
  };
}

export function botAllocationUsdt(value: Prisma.JsonValue, fallback = 100) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return fallback;
  const candidate = Number((value as Prisma.JsonObject).allocationUsdt);
  return Number.isFinite(candidate) && candidate >= 10 && candidate <= 10_000 ? candidate : fallback;
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
    let privateExecutionReady = account.connectionStatus === 'CONNECTED';
    const [publicRules, bots, configuredSymbols] = await Promise.all([
      getBinanceFuturesPublicSymbols(),
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
    let privateRules = [] as Awaited<ReturnType<typeof adapter.getSymbols>>;
    let snapshot: Awaited<ReturnType<typeof getTradingEngineSnapshot>> = { balances: [], symbols: publicRules, orders: [], positions: [] };
    if (privateExecutionReady) {
      try {
        [privateRules, snapshot] = await Promise.all([adapter.getSymbols(), getTradingEngineSnapshot(account)]);
      } catch (error) {
        privateExecutionReady = false;
        logger.warn({ err: error, exchangeAccountId: account.id }, 'Futures Testnet private connection degraded; PAPER universe continues on Binance public market data');
      }
    }
    const positions = snapshot.positions;
    const paperAllowed = new Set(publicRules.map((rule) => rule.symbol));
    const paperSymbols = configuredSymbols.filter((symbol) => paperAllowed.has(symbol));
    if (paperSymbols.length === 0) throw new Error('Core Trading Universe has no enabled Binance USDT perpetual symbol for PAPER training.');
    const demoAllowed = new Set(privateRules.filter((rule) => rule.maxLeverage >= 20 && ['USDT', 'USDC'].includes(rule.quoteAsset)).map((rule) => rule.symbol));
    // The admin universe is coin-based and persisted with its canonical USDT
    // symbol. TESTNET may route alternating bots to that coin's USDC perpetual
    // when Binance lists it, allowing both native stablecoin balances to train.
    const demoSymbols = configuredSymbols.map((symbol, index) => {
      const base = symbol.endsWith('USDT') ? symbol.slice(0, -4) : symbol;
      const preferred = `${base}${index % 2 === 0 ? 'USDT' : 'USDC'}`;
      return demoAllowed.has(preferred) ? preferred : symbol;
    }).filter((symbol) => demoAllowed.has(symbol));
    const occupied = new Set(positions.filter((position) => Number(position.quantity) !== 0).map((position) => position.symbol));
    const paper = bots.filter((bot) => bot.mode === 'PAPER');
    const demo = privateExecutionReady ? bots.filter((bot) => bot.mode === 'DEMO') : [];
    const leverageMinimum = account.riskProfile.minLeverage;
    const leverageMaximum = account.riskProfile.maxLeverage;
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
      return [bot.id, allocation] as const;
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
      const leverage = fleetLeverage(index, demo.length, leverageMinimum, leverageMaximum);
      const currentLeverage = Number(position?.leverage ?? 0);
      if (position && (currentLeverage < leverageMinimum || currentLeverage > leverageMaximum)) {
        await adapter.configurePosition(bot.symbol, leverage, 'ISOLATED');
        adjustedPositions += 1;
      }
    }

    for (let index = 0; index < paper.length; index += 1) {
      const bot = paper[index]!;
      const leverage = fleetLeverage(index % 16, 16, leverageMinimum, leverageMaximum);
      const flat = !bot.paperPosition || bot.paperPosition.netQuantity.isZero();
      const target = flat ? universeCandidate(paperSymbols, slot, index, paper.length) : bot.symbol;
      if (!paperAllowed.has(target)) continue;
      const changedSymbol = target !== bot.symbol;
      const allocation = scaleTarget.get(bot.id) ?? botAllocationUsdt(bot.configuration);
      // Runtime policy is safe to refresh while a trade is open; symbol
      // rotation is not. Keeping these updates separate makes the 20 USDT
      // margin/continuous-training policy effective on the next engine cycle
      // without mutating the market of an active position.
      updates.push(prisma.tradingBot.updateMany({ where: { id: bot.id, mode: 'PAPER' }, data: {
        intervalSeconds: PAPER_TRAINING_INTERVAL_SECONDS,
        configuration: paperTrainingConfiguration(bot.configuration, leverage, { allocationUsdt: allocation, minimumInitialMarginUsdt: account.riskProfile.testnetMinInitialMarginUsdt.toNumber(), leverageMin: leverageMinimum, leverageMax: leverageMaximum }),
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
    const testnetFleetAllocation = account.riskProfile.testnetBotAllocationUsdt.toNumber();
    const testnetMinimumMargin = account.riskProfile.testnetMinInitialMarginUsdt.toNumber();
    for (let index = 0; index < demo.length; index += 1) {
      const bot = demo[index]!;
      const leverage = fleetLeverage(index, demo.length, leverageMinimum, leverageMaximum);
      const allocation = testnetFleetAllocation;
      const testnetSizing = {
        allocationUsdt: allocation, minimumInitialMarginUsdt: testnetMinimumMargin,
        leverageMin: leverageMinimum, leverageMax: leverageMaximum,
        stopLossBps: account.riskProfile.testnetStopLossBps,
        takeProfitBps: account.riskProfile.testnetTakeProfitBps,
      };
      if (schedulerLeaseActive(bot.schedulerOwner, bot.leaseExpiresAt, now)) {
        updates.push(prisma.tradingBot.updateMany({ where: { id: bot.id, mode: 'DEMO' }, data: {
          intervalSeconds: TESTNET_DECISION_INTERVAL_SECONDS,
          configuration: testnetExecutionConfiguration(bot.configuration, leverage, testnetSizing),
          timeframe: '15m',
          startingPaperBalance: allocation,
          version: { increment: 1 },
        } }));
        continue;
      }
      const hasPosition = occupied.has(bot.symbol);
      const pending = rotationPending(bot.configuration);
      let target = bot.symbol;
      if (pending && !hasPosition) {
        for (let attempt = 0; attempt < demoSymbols.length; attempt += 1) {
          const candidate = universeCandidate(demoSymbols, slot, index + attempt, demo.length);
          if (!reserved.has(candidate)) { target = candidate; break; }
        }
      }
      if (!demoAllowed.has(target)) continue;
      reserved.add(target);
      const changedSymbol = target !== bot.symbol;
      if (!hasPosition && !pending) {
      updates.push(prisma.tradingBot.updateMany({ where: availableBotWhere(bot.id, now), data: {
          intervalSeconds: TESTNET_DECISION_INTERVAL_SECONDS,
          configuration: testnetExecutionConfiguration(bot.configuration, leverage, { ...testnetSizing, universeRotationPending: true }),
          timeframe: '15m',
          ...(allocation > botAllocationUsdt(bot.configuration, bot.startingPaperBalance.toNumber()) ? { startingPaperBalance: allocation } : {}),
          state: 'PAUSED', desiredState: 'PAUSED', schedulerOwner: null, leaseExpiresAt: null, heartbeatAt: null,
          stateReason: 'TESTNET universe rotation staged; next cycle verifies the old symbol is still flat.', version: { increment: 1 },
        } }));
        stagedDemo += 1;
        continue;
      }
      updates.push(prisma.tradingBot.updateMany({ where: availableBotWhere(bot.id, now), data: {
        symbol: target, symbols: [target], timeframe: '15m', intervalSeconds: TESTNET_DECISION_INTERVAL_SECONDS, configuration: testnetExecutionConfiguration(bot.configuration, leverage, { ...testnetSizing, universeRotationPending: false }),
        ...(allocation > botAllocationUsdt(bot.configuration, bot.startingPaperBalance.toNumber()) ? { startingPaperBalance: allocation } : {}),
        ...(pending ? { desiredState: 'RUNNING', state: 'STARTING', schedulerOwner: null, leaseExpiresAt: null, heartbeatAt: null,
          stateReason: hasPosition ? 'A position appeared during staged rotation; original symbol preserved.' : 'Staged flat TESTNET bot rotated safely through the Futures universe.' } : {}),
        ...(changedSymbol ? { name: `AI TESTNET Universe #${String(index + 1).padStart(2, '0')} ${target}` } : {}),
        version: { increment: 1 },
      } }));
      if (changedSymbol) rotatedDemo += 1;
    }

    const projectedDemoAllocation = demo.length * testnetFleetAllocation;
    await prisma.$transaction([
      ...updates,
      prisma.tradingAuditLog.create({ data: {
        userId: account.userId, exchangeAccountId: account.id, action: 'AI_FUTURES_UNIVERSE_ROTATED', entityType: 'EXCHANGE_ACCOUNT', entityId: account.id,
        metadata: { universeSize: paperSymbols.length, paperUniverseSize: paperSymbols.length, testnetUniverseSize: demoSymbols.length,
          privateExecutionReady, rotatedPaper, rotatedDemo, stagedDemo, adjustedPositions, canceledStaleProtectives, autoScaledCapital,
          paperTrainingPolicy: { adminConfiguredMaxOpenPositions: account.riskProfile.paperMaxOpenPositions,
            maxOpenPositionsCeiling: PAPER_TRAINING_MAX_OPEN_POSITIONS, stopLossBps: PAPER_TRAINING_STOP_LOSS_BPS,
            takeProfitBps: PAPER_TRAINING_TAKE_PROFIT_BPS, intervalSeconds: PAPER_TRAINING_INTERVAL_SECONDS,
            minimumInitialMarginUsdt: PAPER_TRAINING_MIN_INITIAL_MARGIN_USDT,
            maximumRiskPerTradePct: PAPER_TRAINING_MAX_RISK_PER_TRADE_PCT, alwaysInMarket: true },
          riskProfileOwnership: 'ADMIN_MANAGED_NOT_MUTATED_BY_UNIVERSE_WORKER',
          automaticScaleRule: { minimumClosedTrades: 200, profitableEquityRequired: true, targetAllocationUsdt: 200 },
          testnetSizingPolicy: { botAllocationUsdt: testnetFleetAllocation, minimumInitialMarginUsdt: testnetMinimumMargin, allocationMode: 'INITIAL_MARGIN', decisionIntervalSeconds: TESTNET_DECISION_INTERVAL_SECONDS },
          projectedDemoAllocation, leverageMin: leverageMinimum, leverageMax: leverageMaximum, productionLive: false, occupiedSymbolsPreserved: [...occupied] },
      } }),
    ]);
    return { status: 'ROTATED' as const, universeSize: paperSymbols.length, paperBots: paper.length, demoBots: demo.length, privateExecutionReady, rotatedPaper, rotatedDemo, stagedDemo, adjustedPositions, canceledStaleProtectives, autoScaledCapital, occupied: occupied.size };
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
