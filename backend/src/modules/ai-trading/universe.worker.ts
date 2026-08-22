import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';
import { adapterFor } from '../trading/exchange-account.service.js';
import type { ExchangeOrder } from '../trading/exchanges/exchange-adapter.js';
import { cancelTradingEngineOrder, getTradingEngineSnapshot } from '../trading/trading-engine.client.js';

let universeCycleRunning = false;
export const TESTNET_ROTATION_SETTLE_MS = 15_000;

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

export async function runAutonomousUniverseCycle(now = new Date()) {
  if (universeCycleRunning) return { status: 'LOCKED' as const };
  universeCycleRunning = true;
  try {
    const account = await prisma.exchangeAccount.findFirst({
      where: { provider: 'BINANCE', environment: 'TESTNET', accountType: 'USDT_M', executionEngine: 'GO', isActive: true, connectionStatus: 'CONNECTED' },
      include: { riskProfile: true }, orderBy: { createdAt: 'asc' },
    });
    if (!account?.riskProfile?.enabled || account.riskProfile.accountKillSwitch) return { status: 'ACCOUNT_NOT_READY' as const };
    const adapter = adapterFor(account);
    const [rules, snapshot, bots] = await Promise.all([
      adapter.getSymbols(), getTradingEngineSnapshot(account),
      prisma.tradingBot.findMany({
        where: {
          userId: account.userId, type: 'AUTONOMOUS', mode: { in: ['PAPER', 'DEMO'] }, lifecycleStatus: 'PAPER',
          OR: [
            { desiredState: 'RUNNING' },
            { mode: 'DEMO', state: 'PAUSED', stateReason: { startsWith: 'TESTNET universe rotation staged' } },
          ],
        },
        include: { paperPosition: { select: { netQuantity: true } }, metrics: { orderBy: { snapshotAt: 'desc' }, take: 1, select: { totalTrades: true, currentEquity: true } } }, orderBy: [{ mode: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    const positions = snapshot.positions;
    const symbols = rules.filter((rule) => rule.maxLeverage >= 20).map((rule) => rule.symbol).sort();
    if (symbols.length < 15) throw new Error('At least 15 Binance TESTNET USDT perpetual symbols supporting 20x are required.');
    const allowed = new Set(symbols);
    const occupied = new Set(positions.filter((position) => Number(position.quantity) !== 0).map((position) => position.symbol));
    const paper = bots.filter((bot) => bot.mode === 'PAPER');
    const demo = bots.filter((bot) => bot.mode === 'DEMO');
    const slot = Math.floor(now.getTime() / (env.AI_TRADING_UNIVERSE_INTERVAL_MINUTES * 60_000));
    const updates: Array<ReturnType<typeof prisma.tradingBot.update>> = [];
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
      if (!allowed.has(target)) continue;
      const changedSymbol = target !== bot.symbol;
      const allocation = scaleTarget.get(bot.id) ?? botAllocationUsdt(bot.configuration);
      updates.push(prisma.tradingBot.update({ where: { id: bot.id }, data: {
        symbol: target, symbols: [target], configuration: configuration(bot.configuration, leverage, { allocationUsdt: allocation }),
        ...(allocation > botAllocationUsdt(bot.configuration, bot.startingPaperBalance.toNumber()) ? { startingPaperBalance: allocation } : {}),
        ...(changedSymbol ? { state: 'STARTING', schedulerOwner: null, leaseExpiresAt: null, heartbeatAt: null, stateReason: 'Flat PAPER bot rotated through the Binance Futures universe.' } : {}),
        version: { increment: 1 },
      } }));
      if (changedSymbol) rotatedPaper += 1;
    }

    const reserved = new Set(occupied);
    for (let index = 0; index < demo.length; index += 1) {
      const bot = demo[index]!;
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
      if (!allowed.has(target)) continue;
      reserved.add(target);
      const changedSymbol = target !== bot.symbol;
      if (!hasPosition && !pending) {
        updates.push(prisma.tradingBot.update({ where: { id: bot.id }, data: {
          configuration: configuration(bot.configuration, leverage, { universeRotationPending: true, allocationUsdt: allocation }),
          ...(allocation > botAllocationUsdt(bot.configuration, bot.startingPaperBalance.toNumber()) ? { startingPaperBalance: allocation } : {}),
          state: 'PAUSED', desiredState: 'PAUSED', schedulerOwner: null, leaseExpiresAt: null, heartbeatAt: null,
          stateReason: 'TESTNET universe rotation staged; next cycle verifies the old symbol is still flat.', version: { increment: 1 },
        } }));
        stagedDemo += 1;
        continue;
      }
      updates.push(prisma.tradingBot.update({ where: { id: bot.id }, data: {
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
      prisma.tradingRiskProfile.update({ where: { id: account.riskProfile.id }, data: {
        maxLeverage: 20, maxOpenPositions: 15,
        maxAccountOpenNotional: Math.max(account.riskProfile.maxAccountOpenNotional.toNumber(), projectedDemoAllocation).toFixed(2),
        maxSymbolOpenNotional: Math.max(account.riskProfile.maxSymbolOpenNotional.toNumber(), ...[...scaleTarget.values()]).toFixed(2), maxOrdersPerMinute: 1000,
        maxDailyOrders: 100_000, cooldownSeconds: 0, allowedSymbols: symbols,
      } }),
      ...updates,
      prisma.tradingAuditLog.create({ data: {
        userId: account.userId, exchangeAccountId: account.id, action: 'AI_FUTURES_UNIVERSE_ROTATED', entityType: 'EXCHANGE_ACCOUNT', entityId: account.id,
        metadata: { universeSize: symbols.length, rotatedPaper, rotatedDemo, stagedDemo, adjustedPositions, canceledStaleProtectives, autoScaledCapital,
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
