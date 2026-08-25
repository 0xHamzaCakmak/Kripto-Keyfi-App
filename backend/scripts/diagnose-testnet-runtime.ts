import { prisma } from '../src/database/prisma.js';
import { getTradingEngineSnapshot } from '../src/modules/trading/trading-engine.client.js';

function jsonObject(value: unknown): Record<string, unknown> | null {
  return value !== null && !Array.isArray(value) && typeof value === 'object' ? value as Record<string, unknown> : null;
}

async function main() {
  const since = new Date(Date.now() - 5 * 60_000);
  const account = await prisma.exchangeAccount.findFirstOrThrow({
    where: { environment: 'TESTNET', isActive: true },
  });
  const [decisions, signals, entries, fills, shortTermBots, snapshot] = await Promise.all([
    prisma.tradingBotDecision.findMany({
      where: { exchangeAccountId: account.id, mode: 'DEMO', occurredAt: { gte: since } },
      select: { tradingBotId: true, kind: true, symbol: true, metrics: true },
    }),
    prisma.tradingBotSignal.findMany({
      where: { exchangeAccountId: account.id, source: 'RULE_ENGINE', createdAt: { gte: since }, decision: { kind: { not: 'HOLD' } } },
      select: { status: true, safetyChecks: true },
    }),
    prisma.tradingOrder.findMany({
      where: { exchangeAccountId: account.id, source: 'SYSTEM', reduceOnly: false, createdAt: { gte: since } },
      select: { symbol: true, status: true },
    }),
    prisma.testnetExecutionFill.findMany({
      where: { exchangeAccountId: account.id, reduceOnly: false, occurredAt: { gte: since } },
      select: { tradingBotId: true, symbol: true },
    }),
    prisma.tradingBot.count({
      where: { exchangeAccountId: account.id, mode: 'DEMO', lifecycleStatus: { not: 'ARCHIVED' }, timeframe: '15m' },
    }),
    getTradingEngineSnapshot(account),
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

  console.log(JSON.stringify({
    windowMinutes: 5,
    decisions: decisions.length,
    decisionKinds: kinds,
    guardedTransitionDecisions: transitions.length,
    guardedTransitionBots: new Set(transitions.map((decision) => decision.tradingBotId)).size,
    shortTermAnalysisDecisions: shortTermDecisions.length,
    shortTermConfiguredBots: shortTermBots,
    riskOutcomes,
    executionOutcomes,
    submittedEntries: entries.length,
    filledEntries: fills.length,
    entryBots: new Set(fills.map((fill) => fill.tradingBotId)).size,
    entrySymbols: [...new Set(fills.map((fill) => fill.symbol))].sort(),
    rejectedEntries: entries.filter((entry) => ['REJECTED', 'FAILED'].includes(entry.status)).length,
    exchangeOpenPositions: positions.length,
    exchangePositionSymbols: positions.map((position) => position.symbol).sort(),
    productionLive: false,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
