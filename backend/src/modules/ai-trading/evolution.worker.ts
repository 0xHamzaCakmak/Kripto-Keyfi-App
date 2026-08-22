import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';
import { DEFAULT_CHAMPION_SELECTION_CONFIG } from './champion-selection.schema.js';
import { runChampionSelection } from './champion-selection.service.js';
import { runEvolution } from './evolution.service.js';

let evolutionCycleRunning = false;

export async function runAutonomousEvolutionCycle() {
  if (evolutionCycleRunning) return { status: 'LOCKED' as const };
  evolutionCycleRunning = true;
  try {
    const generation = await prisma.generation.findFirst({
      where: { status: { in: ['RUNNING', 'EVALUATING'] } }, orderBy: [{ number: 'asc' }, { createdAt: 'asc' }],
      include: { bots: { where: { type: 'AUTONOMOUS', mode: 'PAPER' }, select: { id: true, metrics: { orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }], take: 1, select: { totalTrades: true } } } } },
    });
    if (!generation) return { status: 'IDLE' as const };
    const alreadyRun = await prisma.evolutionRun.findFirst({ where: { sourceGenerationId: generation.id, status: { in: ['RUNNING', 'COMPLETED'] } }, select: { id: true } });
    if (alreadyRun) return { status: 'ALREADY_PROCESSED' as const, generationId: generation.id };
    const ready = generation.bots.length === generation.populationTarget
      && generation.bots.every((bot) => (bot.metrics[0]?.totalTrades ?? 0) >= env.AI_TRADING_EVOLUTION_MIN_TRADES);
    if (!ready) {
      const minimum = generation.bots.reduce((value, bot) => Math.min(value, bot.metrics[0]?.totalTrades ?? 0), Number.MAX_SAFE_INTEGER);
      return { status: 'COLLECTING_EVIDENCE' as const, generationId: generation.id, bots: generation.bots.length, minimumTrades: Number.isSafeInteger(minimum) ? minimum : 0 };
    }
    await prisma.generation.update({ where: { id: generation.id }, data: { status: 'EVALUATING' } });
    await runChampionSelection(generation.createdById, DEFAULT_CHAMPION_SELECTION_CONFIG).catch((error) => {
      logger.warn({ err: error, generationId: generation.id }, 'champion evaluation deferred while Evolution continues');
    });
    const result = await runEvolution(generation.createdById, {
      sourceGenerationId: generation.id,
      config: {
        populationSize: 100, survivorCount: 20, mutationCount: 60, crossoverCount: 20,
        researcherCandidateCount: 0, minimumTrades: env.AI_TRADING_EVOLUTION_MIN_TRADES,
        maxGenerations: env.AI_TRADING_MAX_GENERATIONS,
      },
    });
    logger.info({ result }, 'autonomous PAPER generation evolved');
    return { status: 'EVOLVED' as const, result };
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
