import { prisma } from '../src/database/prisma.js';
import { getTradingEngineSnapshot } from '../src/modules/trading/trading-engine.client.js';

function jsonObject(value: unknown): Record<string, unknown> | null {
  return value !== null && !Array.isArray(value) && typeof value === 'object' ? value as Record<string, unknown> : null;
}

async function main() {
  const now = new Date();
  const since = new Date(now.getTime() - 5 * 60_000);
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const account = await prisma.exchangeAccount.findFirstOrThrow({
    where: { environment: 'TESTNET', isActive: true },
  });
  const [decisions, signals, entries, fills, runtimeBots, snapshot, riskProfile, riskControl, ordersLastMinute, ordersToday, recentRiskEvents] = await Promise.all([
    prisma.tradingBotDecision.findMany({
      where: { exchangeAccountId: account.id, mode: 'DEMO', occurredAt: { gte: since } },
      select: { tradingBotId: true, kind: true, symbol: true, summary: true, metrics: true, occurredAt: true },
    }),
    prisma.tradingBotSignal.findMany({
      where: { exchangeAccountId: account.id, source: 'RULE_ENGINE', createdAt: { gte: since }, decision: { kind: { not: 'HOLD' } } },
      select: { tradingBotId: true, status: true, safetyChecks: true },
    }),
    prisma.tradingOrder.findMany({
      where: { exchangeAccountId: account.id, source: 'SYSTEM', reduceOnly: false, createdAt: { gte: since } },
      select: { symbol: true, status: true },
    }),
    prisma.testnetExecutionFill.findMany({
      where: { exchangeAccountId: account.id, reduceOnly: false, occurredAt: { gte: since } },
      select: { tradingBotId: true, symbol: true },
    }),
    prisma.tradingBot.findMany({
      where: { exchangeAccountId: account.id, mode: 'DEMO', lifecycleStatus: { not: 'ARCHIVED' }, timeframe: '15m' },
      select: { id: true, name: true, symbol: true, state: true, desiredState: true, configuration: true, lastDecisionAt: true, lastErrorCode: true },
    }),
    getTradingEngineSnapshot(account),
    prisma.tradingRiskProfile.findUnique({ where: { exchangeAccountId: account.id }, select: {
      enabled: true, accountKillSwitch: true, maxOrderNotional: true, maxInitialMargin: true,
      maxAccountOpenNotional: true, maxSymbolOpenNotional: true, maxOpenPositions: true,
      maxSymbolPositions: true, minAvailableBalance: true, maxOrdersPerMinute: true, maxDailyOrders: true,
    } }),
    prisma.tradingRiskControl.findUnique({ where: { id: 'global' }, select: { globalKillSwitch: true } }),
    prisma.tradingOrder.count({ where: { exchangeAccountId: account.id, source: { not: 'MANUAL' }, status: { not: 'FAILED' }, createdAt: { gte: new Date(now.getTime() - 60_000) } } }),
    prisma.tradingOrder.count({ where: { exchangeAccountId: account.id, source: { not: 'MANUAL' }, status: { not: 'FAILED' }, createdAt: { gte: dayStart } } }),
    prisma.tradingRiskEvent.findMany({ where: { exchangeAccountId: account.id, occurredAt: { gte: dayStart } }, orderBy: { occurredAt: 'desc' }, take: 20,
      select: { decision: true, code: true, message: true, metrics: true, occurredAt: true } }),
  ]);
  const kinds = decisions.reduce<Record<string, number>>((counts, decision) => {
    counts[decision.kind] = (counts[decision.kind] ?? 0) + 1;
    return counts;
  }, {});
  const transitions = decisions.filter((decision) => jsonObject(decision.metrics)?.testnetTransitionRegimeAccepted === true);
  const shortTermDecisions = decisions.filter((decision) => {
    const metrics = jsonObject(decision.metrics);
    return JSON.stringify(metrics?.analysisTimeframes) === JSON.stringify(['15m', '1h'])
      && JSON.stringify(metrics?.directionWindowsHours) === JSON.stringify([24, 48]);
  });
  const positions = snapshot.positions.filter((position) => Number(position.quantity) !== 0);
  const entryPausedBots = runtimeBots.filter((bot) => jsonObject(bot.configuration)?.entryPaused === true).length;
  const riskOutcomes = signals.reduce<Record<string, number>>((counts, signal) => {
    const safety = jsonObject(signal.safetyChecks);
    const risk = jsonObject(safety?.autonomousRiskDecision);
    const key = String(risk?.code ?? risk?.Code ?? risk?.status ?? risk?.Status ?? signal.status);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const executionOutcomes = signals.reduce<Record<string, number>>((counts, signal) => {
    const safety = jsonObject(signal.safetyChecks);
    const key = String(safety?.executionStatus ?? (safety?.autonomousRiskApproved === true ? 'APPROVED_NOT_EXECUTED' : 'NOT_APPROVED'));
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const executionReasonCodes = signals.reduce<Record<string, number>>((counts, signal) => {
    const safety = jsonObject(signal.safetyChecks);
    const key = String(safety?.executionReasonCode ?? safety?.detail ?? 'NO_REASON_CODE');
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  const botActivity = runtimeBots.map((bot) => {
    const botDecisions = decisions.filter((decision) => decision.tradingBotId === bot.id);
    const botSignals = signals.filter((signal) => signal.tradingBotId === bot.id);
    const botFills = fills.filter((fill) => fill.tradingBotId === bot.id);
    const latestDecision = botDecisions.reduce<(typeof botDecisions)[number] | null>(
      (latest, decision) => !latest || decision.occurredAt > latest.occurredAt ? decision : latest,
      null,
    );
    return {
      name: bot.name,
      symbol: bot.symbol,
      state: bot.state,
      desiredState: bot.desiredState,
      entryPaused: jsonObject(bot.configuration)?.entryPaused === true,
      decisions: botDecisions.length,
      decisionKinds: botDecisions.reduce<Record<string, number>>((counts, decision) => {
        counts[decision.kind] = (counts[decision.kind] ?? 0) + 1;
        return counts;
      }, {}),
      riskOutcomes: botSignals.reduce<Record<string, number>>((counts, signal) => {
        const risk = jsonObject(jsonObject(signal.safetyChecks)?.autonomousRiskDecision);
        const key = String(risk?.code ?? risk?.Code ?? risk?.status ?? risk?.Status ?? signal.status);
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {}),
      entryFills: botFills.length,
      latestDecision: latestDecision ? { kind: latestDecision.kind, summary: latestDecision.summary, occurredAt: latestDecision.occurredAt } : null,
      lastDecisionAt: bot.lastDecisionAt,
      lastErrorCode: bot.lastErrorCode,
    };
  });

  console.log(JSON.stringify({
    windowMinutes: 5,
    decisions: decisions.length,
    decisionKinds: kinds,
    guardedTransitionDecisions: transitions.length,
    guardedTransitionBots: new Set(transitions.map((decision) => decision.tradingBotId)).size,
    shortTermAnalysisDecisions: shortTermDecisions.length,
    shortTermConfiguredBots: runtimeBots.length,
    desiredRunningBots: runtimeBots.filter((bot) => bot.desiredState === 'RUNNING').length,
    entryPausedBots,
    automaticEntriesPaused: runtimeBots.length > 0 && entryPausedBots === runtimeBots.length,
    executionGates: {
      riskProfileEnabled: riskProfile?.enabled ?? false,
      accountKillSwitch: riskProfile?.accountKillSwitch ?? null,
      globalKillSwitch: riskControl?.globalKillSwitch ?? null,
    },
    riskLimits: riskProfile ? {
      maxOrderNotional: riskProfile.maxOrderNotional.toString(),
      maxInitialMargin: riskProfile.maxInitialMargin.toString(),
      maxAccountOpenNotional: riskProfile.maxAccountOpenNotional.toString(),
      maxSymbolOpenNotional: riskProfile.maxSymbolOpenNotional.toString(),
      maxOpenPositions: riskProfile.maxOpenPositions,
      maxSymbolPositions: riskProfile.maxSymbolPositions,
      minAvailableBalance: riskProfile.minAvailableBalance.toString(),
      maxOrdersPerMinute: riskProfile.maxOrdersPerMinute,
      maxDailyOrders: riskProfile.maxDailyOrders,
    } : null,
    orderRateUsage: {
      ordersLastMinute,
      ordersTodayUtc: ordersToday,
      minuteLimit: riskProfile?.maxOrdersPerMinute ?? null,
      dailyLimit: riskProfile?.maxDailyOrders ?? null,
      minuteBlocked: Boolean(riskProfile && riskProfile.maxOrdersPerMinute > 0 && ordersLastMinute >= riskProfile.maxOrdersPerMinute),
      dailyBlocked: Boolean(riskProfile && riskProfile.maxDailyOrders > 0 && ordersToday >= riskProfile.maxDailyOrders),
      zeroMeansUnlimited: true,
    },
    riskOutcomes,
    executionOutcomes,
    executionReasonCodes,
    recentRiskEvents,
    submittedEntries: entries.length,
    filledEntries: fills.length,
    entryBots: new Set(fills.map((fill) => fill.tradingBotId)).size,
    entrySymbols: [...new Set(fills.map((fill) => fill.symbol))].sort(),
    rejectedEntries: entries.filter((entry) => ['REJECTED', 'FAILED'].includes(entry.status)).length,
    exchangeOpenPositions: positions.length,
    exchangePositionSymbols: positions.map((position) => position.symbol).sort(),
    botActivity,
    productionLive: false,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
