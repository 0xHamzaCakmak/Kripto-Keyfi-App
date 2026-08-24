import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';
import { DEFAULT_CHAMPION_SELECTION_CONFIG } from './champion-selection.schema.js';
import { runChampionSelection } from './champion-selection.service.js';
import { assessEvolutionReadiness, evolutionConfigForPopulation, runEvolution } from './evolution.service.js';
import { runLiveEligibility } from './live-eligibility.service.js';
import { DEFAULT_LIVE_ELIGIBILITY_CONFIG } from './live-eligibility.schema.js';

let evolutionCycleRunning = false;

export async function runAutonomousEvolutionCycle() {
  if (evolutionCycleRunning) return { status: 'LOCKED' as const };
  evolutionCycleRunning = true;
  try {
    const promotionOwners = await prisma.tradingBot.findMany({
      where: { type: 'AUTONOMOUS', lifecycleStatus: { in: ['PAPER', 'CHALLENGER', 'CHAMPION'] } },
      distinct: ['userId'], select: { userId: true }, orderBy: { userId: 'asc' },
    });
    const promotionCycles = [];
    for (const owner of promotionOwners) {
      const championSelection = await runChampionSelection(owner.userId, DEFAULT_CHAMPION_SELECTION_CONFIG).catch((error) => {
        logger.warn({ err: error, userId: owner.userId }, 'periodic Champion/Challenger evaluation failed');
        return null;
      });
      const liveEligibility = await runLiveEligibility(owner.userId, { botId: undefined, config: DEFAULT_LIVE_ELIGIBILITY_CONFIG }).catch((error) => {
        logger.warn({ err: error, userId: owner.userId }, 'periodic SHADOW Live Eligibility evaluation failed');
        return null;
      });
      promotionCycles.push({ userId: owner.userId, championSelection, liveEligibility });
    }
    const generation = await prisma.generation.findFirst({
      where: { status: { in: ['RUNNING', 'EVALUATING'] } }, orderBy: [{ number: 'asc' }, { createdAt: 'asc' }],
      include: { bots: { where: { type: 'AUTONOMOUS', mode: 'PAPER' }, select: { id: true, lifecycleStatus: true, metrics: { orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }], take: 1, select: { totalTrades: true, score: true } } } } },
    });
    if (!generation) return { status: 'IDLE' as const, promotionCycles };
    const alreadyRun = await prisma.evolutionRun.findFirst({ where: { sourceGenerationId: generation.id, status: { in: ['RUNNING', 'COMPLETED'] } }, select: { id: true } });
    if (alreadyRun) return { status: 'ALREADY_PROCESSED' as const, generationId: generation.id, promotionCycles };
    const config = evolutionConfigForPopulation(generation.populationTarget, env.AI_TRADING_EVOLUTION_MIN_TRADES, env.AI_TRADING_MAX_GENERATIONS);
    const readiness = assessEvolutionReadiness(generation.bots.map((bot) => ({
      botId: bot.id, lifecycleStatus: bot.lifecycleStatus,
      score: bot.metrics[0]?.score?.toNumber() ?? null, totalTrades: bot.metrics[0]?.totalTrades ?? 0,
    })), generation.populationTarget, config);
    if (!readiness.ready) {
      return { status: 'COLLECTING_EVIDENCE' as const, generationId: generation.id, ...readiness, promotionCycles };
    }
    await prisma.generation.update({ where: { id: generation.id }, data: { status: 'EVALUATING' } });
    const result = await runEvolution(generation.createdById, {
      sourceGenerationId: generation.id,
      config,
    });
    logger.info({ result }, 'autonomous PAPER generation evolved');
    return { status: 'EVOLVED' as const, result, promotionCycles };
  } finally {
    evolutionCycleRunning = false;
  }
}

export function scheduleAutonomousEvolution() {
  const execute = () => void runAutonomousEvolutionCycle().then((result) => {
    if (result.status !== 'COLLECTING_EVIDENCE') logger.info({ result }, 'autonomous Evolution worker cycle');
  }).catch((error) => logger.error({ err: error }, 'autonomous Evolution worker failed'));
  execute();
  const timer = setInterval(execute, env.AI_TRADING_EVOLUTION_INTERVAL_MINUTES * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
