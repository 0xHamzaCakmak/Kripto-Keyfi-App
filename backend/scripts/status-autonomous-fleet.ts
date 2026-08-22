import { prisma } from '../src/database/prisma.js';

async function main() {
  const since = new Date(Date.now() - 5 * 60_000);
  const [paperBots, demoBots, states, decisions, fills, openTrades, closedTrades, metricBots, latest, errors, blocked, accounts, missingStrategies, leases] = await Promise.all([
    prisma.tradingBot.count({ where: { type: 'AUTONOMOUS', mode: 'PAPER' } }),
    prisma.tradingBot.count({ where: { type: 'AUTONOMOUS', mode: 'DEMO' } }),
    prisma.tradingBot.groupBy({ by: ['mode', 'state'], where: { type: 'AUTONOMOUS' }, _count: { _all: true } }),
    prisma.tradingBotDecision.count({ where: { type: 'AUTONOMOUS', mode: 'PAPER', occurredAt: { gte: since } } }),
    prisma.tradingBotPaperFill.count({ where: { tradingBot: { type: 'AUTONOMOUS', mode: 'PAPER' } } }),
    prisma.paperTrade.count({ where: { tradingBot: { type: 'AUTONOMOUS', mode: 'PAPER' }, status: 'OPEN' } }),
    prisma.paperTrade.count({ where: { tradingBot: { type: 'AUTONOMOUS', mode: 'PAPER' }, status: { in: ['CLOSED', 'LIQUIDATED'] } } }),
    prisma.botMetric.groupBy({ by: ['tradingBotId'], where: { tradingBot: { type: 'AUTONOMOUS', mode: 'PAPER' }, score: { not: null } } }),
    prisma.botMetric.findMany({
      where: { tradingBot: { type: 'AUTONOMOUS', mode: 'PAPER' }, score: { not: null } },
      orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }], take: 5,
      select: { tradingBotId: true, score: true, currentEquity: true, totalTrades: true, snapshotAt: true },
    }),
    prisma.tradingBot.findMany({
      where: { type: 'AUTONOMOUS', mode: 'PAPER', state: 'ERROR' }, take: 10,
      select: { id: true, name: true, strategyVersionId: true, strategyVersion: { select: { strategy: { select: { family: true } } } }, lastErrorCode: true, lastErrorMessage: true, stateReason: true, lastDecisionAt: true },
    }),
    prisma.tradingBot.groupBy({
      by: ['mode', 'stateReason', 'lastErrorCode', 'lastErrorMessage'],
      where: { type: 'AUTONOMOUS', state: 'RISK_BLOCKED' },
      _count: { _all: true },
    }),
    prisma.exchangeAccount.findMany({
      where: { isActive: true },
      select: { id: true, name: true, provider: true, environment: true, connectionStatus: true, executionEngine: true, canTrade: true },
    }),
    prisma.tradingBot.count({ where: { type: 'AUTONOMOUS', mode: 'PAPER', strategyVersionId: null } }),
    prisma.tradingBot.findMany({
      where: { type: 'AUTONOMOUS', schedulerOwner: { not: null } }, orderBy: { leaseExpiresAt: 'desc' }, take: 12,
      select: { name: true, mode: true, state: true, schedulerOwner: true, leaseExpiresAt: true, heartbeatAt: true, lastDecisionAt: true },
    }),
  ]);
  console.log(JSON.stringify({
    paperBots, demoBots,
    states: states.map((item) => ({ mode: item.mode, state: item.state, count: item._count._all })),
    decisionsLast5m: decisions, decisionsPerMinute: decisions / 5,
    fills, openTrades, closedTrades, botsWithScoredMetrics: metricBots.length,
    latestMetrics: latest,
    errors,
    blocked: blocked.map((item) => ({ mode: item.mode, count: item._count._all, reason: item.stateReason, code: item.lastErrorCode, message: item.lastErrorMessage })),
    accounts, missingStrategies, leases,
    productionLive: false,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
