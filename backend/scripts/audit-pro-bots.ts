import { prisma } from '../src/database/prisma.js';
import { env } from '../src/config/env.js';
import { getArenaStatus } from '../src/modules/ai-trading/autonomous-admin.service.js';

try {
  const bots = await prisma.tradingBot.findMany({ where: { type: 'AUTONOMOUS', lifecycleStatus: { not: 'ARCHIVED' } }, select: { symbol: true, mode: true, state: true, desiredState: true, lastDecisionAt: true, intervalSeconds: true, configuration: true, stateReason: true } });
  console.log(JSON.stringify({ evolutionEnabled: env.AI_TRADING_EVOLUTION_ENABLED, bots: bots.map(({ configuration, ...b }) => { const c = configuration as Record<string, unknown>; return { ...b, entryPaused: c.entryPaused, takeProfitBps: c.takeProfitBps, stopLossBps: c.stopLossBps, estimatedRoundTripCostBps: c.estimatedRoundTripCostBps }; }) }));
  console.log(JSON.stringify({ latestDecisions: await prisma.tradingBotDecision.findMany({ where: { type: 'AUTONOMOUS', mode: 'DEMO' }, orderBy: { occurredAt: 'desc' }, take: 5, select: { symbol: true, kind: true, summary: true, metrics: true, occurredAt: true } }), generations: await prisma.generation.findMany({ orderBy: { createdAt: 'desc' }, take: 3, select: { number: true, status: true, createdAt: true } }) }));
  console.log(JSON.stringify({ protectionOrders: await prisma.tradingOrder.groupBy({ by: ['source', 'type', 'status'], where: { type: { in: ['TAKE_PROFIT_MARKET', 'STOP_MARKET'] } }, _count: true }) }));
  console.log(JSON.stringify({ failedTakeProfits: await prisma.tradingOrder.findMany({ where: { type: 'TAKE_PROFIT_MARKET', status: 'FAILED' }, select: { symbol: true, failureCode: true, failureMessage: true, createdAt: true } }), universe: await prisma.tradingUniverseAsset.findMany({ where: { enabled: true }, select: { symbol: true } }) }));
  const account = await prisma.tradingBot.findFirst({ where: { type: 'AUTONOMOUS', mode: 'DEMO' }, select: { userId: true, exchangeAccountId: true } });
  if (account) {
    const { data } = await getArenaStatus(account.userId, account.exchangeAccountId);
    console.log(JSON.stringify({ feedCheck: { decisions: data.recentDecisions.length, signals: data.recentSignals.length, analysisFresh: data.analysisFresh, sources: [...new Set(data.recentSignals.map(s => s.source))] } }));
  }
} finally { await prisma.$disconnect(); }
