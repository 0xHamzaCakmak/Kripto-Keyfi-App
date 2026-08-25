import { prisma } from '../src/database/prisma.js';

async function main() {
  const owners = await prisma.tradingBot.findMany({ where: { type: 'AUTONOMOUS' }, distinct: ['userId'], select: { userId: true } });
  const results = [];
  for (const { userId } of owners) {
    const [bots, strategies, generations] = await Promise.all([
      prisma.tradingBot.findMany({ where: { userId, type: 'AUTONOMOUS' }, select: { id: true, name: true, mode: true, state: true, lifecycleStatus: true, startingPaperBalance: true } }),
      prisma.strategy.findMany({ where: { createdById: userId }, select: { id: true } }),
      prisma.generation.findMany({ where: { createdById: userId }, select: { id: true, number: true, status: true, populationTarget: true } }),
    ]);
    const botIds = bots.map((bot) => bot.id);
    const strategyIds = strategies.map((strategy) => strategy.id);
    const generationIds = generations.map((generation) => generation.id);
    const [decisions, fills, positions, paperTrades, testnetFills, shadowTrades, signals, metrics, teachers, research, evolutions, mutations, crossovers, champions, allocations, accounting] = await Promise.all([
      prisma.tradingBotDecision.count({ where: { tradingBotId: { in: botIds } } }),
      prisma.tradingBotPaperFill.count({ where: { tradingBotId: { in: botIds } } }),
      prisma.tradingBotPaperPosition.count({ where: { tradingBotId: { in: botIds } } }),
      prisma.paperTrade.count({ where: { tradingBotId: { in: botIds } } }),
      prisma.testnetExecutionFill.count({ where: { tradingBotId: { in: botIds } } }),
      prisma.shadowTrade.count({ where: { tradingBotId: { in: botIds } } }),
      prisma.tradingBotSignal.count({ where: { tradingBotId: { in: botIds } } }),
      prisma.botMetric.count({ where: { tradingBotId: { in: botIds } } }),
      prisma.teacherEvaluation.count({ where: { OR: [{ tradingBotId: { in: botIds } }, { strategyId: { in: strategyIds } }] } }),
      prisma.researchHypothesis.count({ where: { createdById: userId } }),
      prisma.evolutionRun.count({ where: { createdById: userId } }),
      prisma.botMutation.count({ where: { generationId: { in: generationIds } } }),
      prisma.botCrossover.count({ where: { generationId: { in: generationIds } } }),
      prisma.championCandidate.count({ where: { tradingBotId: { in: botIds } } }),
      prisma.portfolioAllocation.count({ where: { userId, mode: { in: ['PAPER', 'DEMO', 'SHADOW'] } } }),
      prisma.paperAccountingPeriod.findMany({ where: { userId }, select: { number: true, status: true, botCount: true, baselineRealizedPnl: true, baselineFees: true } }),
    ]);
    results.push({
      userId,
      bots: bots.map((bot) => ({ ...bot, startingPaperBalance: bot.startingPaperBalance.toString() })),
      generations,
      evidence: { decisions, fills, positions, paperTrades, testnetFills, shadowTrades, signals, metrics, teachers, research, evolutions, mutations, crossovers, champions, allocations },
      accounting: accounting.map((period) => ({ ...period, baselineRealizedPnl: period.baselineRealizedPnl.toString(), baselineFees: period.baselineFees.toString() })),
    });
  }
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
