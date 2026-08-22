import { Prisma } from '@prisma/client';
import { prisma } from '../src/database/prisma.js';

const CONFIRMATION = 'ENABLE_BINANCE_TESTNET_FLEET';
const SYMBOLS = ['ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'LINKUSDT', 'AVAXUSDT', 'DOTUSDT', 'LTCUSDT', 'BCHUSDT', 'TRXUSDT', 'SUIUSDT', 'NEARUSDT', 'APTUSDT'] as const;

function configuration(value: Prisma.JsonValue, index: number): Prisma.InputJsonObject {
  const source = value && !Array.isArray(value) && typeof value === 'object' ? value as Prisma.JsonObject : {};
  const candidate = Number(source.allocationUsdt);
  const allocationUsdt = Number.isFinite(candidate) && candidate >= 10 && candidate <= 10_000 ? candidate : 100;
  return {
    ...source,
    signalThresholdBps: 5 + (index % 5) * 5,
    side: 'BOTH', leverage: 5 + Math.round(index * 15 / (SYMBOLS.length - 1)), marginMode: 'ISOLATED',
    stopLossBps: 75,
    takeProfitBps: 125,
    fixedRiskPct: 0.0075,
    atrStopMultiplier: 1.5,
    adaptiveStopMinBps: 75,
    adaptiveStopMaxBps: 300,
    riskRewardRatio: 1.5,
    maintenanceMarginBps: 50,
    liquidationReserveFraction: 0.2,
    allocationUsdt,
    positionNotionalPct: 0.10,
    pyramidingEnabled: true,
    paperFeeBps: 4,
    paperSlippageBps: 2,
  };
}

function allocation(value: Prisma.JsonValue) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return 100;
  const candidate = Number((value as Prisma.JsonObject).allocationUsdt);
  return Number.isFinite(candidate) && candidate >= 10 && candidate <= 10_000 ? candidate : 100;
}

async function main() {
  if (!process.argv.includes(`--confirm=${CONFIRMATION}`)) throw new Error(`Explicit --confirm=${CONFIRMATION} is required.`);
  const account = await prisma.exchangeAccount.findFirst({
    where: { provider: 'BINANCE', environment: 'TESTNET', accountType: 'USDT_M', isActive: true, connectionStatus: 'CONNECTED', executionEngine: 'GO' },
    include: { riskProfile: true }, orderBy: { createdAt: 'asc' },
  });
  if (!account?.riskProfile?.enabled || account.riskProfile.accountKillSwitch) throw new Error('Connected Binance TESTNET GO account with an enabled risk profile is required.');
  const riskProfile = account.riskProfile;
  const control = await prisma.tradingRiskControl.findUnique({ where: { id: 'global' } });
  if (!control || control.globalKillSwitch) throw new Error('Global Risk Engine kill switch must be off.');

  const sources = await prisma.tradingBot.findMany({
    where: { userId: account.userId, type: 'AUTONOMOUS', mode: 'PAPER', lifecycleStatus: 'PAPER', strategyVersionId: { not: null } },
    include: { metrics: { orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }], take: 1 } },
  });
  sources.sort((left, right) => {
    const score = (right.metrics[0]?.score?.toNumber() ?? -1) - (left.metrics[0]?.score?.toNumber() ?? -1);
    if (score !== 0) return score;
    const trades = (right.metrics[0]?.totalTrades ?? 0) - (left.metrics[0]?.totalTrades ?? 0);
    return trades || left.id.localeCompare(right.id);
  });
  if (sources.length < SYMBOLS.length) throw new Error('At least 15 ranked PAPER source bots are required.');
  const fleetAllocation = sources.slice(0, SYMBOLS.length).reduce((sum, source) => sum + allocation(source.configuration), 0);

  const current = await prisma.tradingBot.findFirst({ where: { userId: account.userId, type: 'AUTONOMOUS', mode: 'DEMO' }, orderBy: { createdAt: 'asc' } });
  await prisma.$transaction(async (tx) => {
    await tx.tradingRiskProfile.update({ where: { id: account.riskProfile!.id }, data: {
      maxOpenPositions: 15,
      maxAccountOpenNotional: Math.max(riskProfile.maxAccountOpenNotional.toNumber(), fleetAllocation).toFixed(2),
      maxLeverage: 20,
      maxOrdersPerMinute: 1000,
      maxDailyOrders: 100_000,
      cooldownSeconds: 0,
      allowedSymbols: [...SYMBOLS],
    } });
    for (let index = 0; index < SYMBOLS.length; index += 1) {
      const source = sources[index]!;
      const symbol = SYMBOLS[index]!;
      const name = `AI TESTNET Fleet #${String(index + 1).padStart(2, '0')} ${symbol}`;
      const data = {
        exchangeAccountId: account.id, name, type: 'AUTONOMOUS' as const, mode: 'DEMO' as const,
        state: 'STARTING' as const, desiredState: 'RUNNING' as const, symbol, intervalSeconds: 15,
        configuration: configuration(source.configuration, index), stateReason: 'Explicit 15-bot Binance TESTNET fleet deployment.',
        schedulerOwner: null, leaseExpiresAt: null, heartbeatAt: null, lastErrorCode: null, lastErrorMessage: null,
        strategyVersionId: source.strategyVersionId, generationId: null, parentBotId: source.id,
        riskProfileId: account.riskProfile!.id, lifecycleStatus: 'PAPER' as const,
        startingPaperBalance: source.startingPaperBalance, factoryCreationMethod: 'CLONE' as const,
        symbols: [symbol], timeframe: '1m', version: { increment: 1 },
      };
      if (index === 0 && current) {
        await tx.tradingBot.update({ where: { id: current.id }, data });
        continue;
      }
      const existing = await tx.tradingBot.findFirst({ where: { userId: account.userId, name } });
      if (existing) await tx.tradingBot.update({ where: { id: existing.id }, data });
      else await tx.tradingBot.create({ data: { ...data, userId: account.userId, version: 0 } });
    }
    await tx.tradingAuditLog.create({ data: {
      userId: account.userId, exchangeAccountId: account.id, action: 'AI_TESTNET_FLEET_DEPLOYED', entityType: 'EXCHANGE_ACCOUNT', entityId: account.id,
      metadata: { botCount: SYMBOLS.length, symbols: [...SYMBOLS], allocationPerBotUsdt: 100, positionNotionalPct: 0.10, environment: 'TESTNET', productionLive: false, riskEngineBypassed: false },
    } });
  }, { maxWait: 10_000, timeout: 30_000 });

  console.log(JSON.stringify({ deployed: SYMBOLS.length, symbols: SYMBOLS, allocationPerBotUsdt: 100, activeAllocationUsdt: SYMBOLS.length * 100, productionLive: false, confirmation: CONFIRMATION }));
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }).finally(() => prisma.$disconnect());
