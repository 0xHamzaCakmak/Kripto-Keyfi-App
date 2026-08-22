import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';
import { runResearcher } from './researcher.service.js';
import { runTeacherEvaluation } from './teacher.service.js';

let learningCycleRunning = false;

export function shouldRunLearning(previousTrades: number, currentTrades: number, minimumNewTrades: number) {
  return currentTrades >= previousTrades && currentTrades - previousTrades >= minimumNewTrades;
}

export async function runAutonomousLearningCycle() {
  if (learningCycleRunning) return { status: 'LOCKED' as const };
  learningCycleRunning = true;
  try {
    const owners = await prisma.tradingBot.findMany({ where: { type: 'AUTONOMOUS', mode: 'PAPER' }, distinct: ['userId'], select: { userId: true } });
    const results = [];
    for (const owner of owners) {
      const currentTrades = await prisma.paperTrade.count({ where: { tradingBot: { userId: owner.userId, type: 'AUTONOMOUS', mode: 'PAPER' }, status: { in: ['CLOSED', 'LIQUIDATED'] } } });
      const checkpoint = await prisma.tradingAuditLog.findFirst({
        where: { userId: owner.userId, action: 'AI_LEARNING_CYCLE_COMPLETED' }, orderBy: { createdAt: 'desc' }, select: { metadata: true },
      });
      const previousTrades = jsonNumber(checkpoint?.metadata, 'closedPaperTrades');
      if (previousTrades === null) {
        await recordCycle(owner.userId, currentTrades, { baseline: true, teacher: null, researcher: null });
        results.push({ userId: owner.userId, status: 'BASELINED' as const, currentTrades });
        continue;
      }
      if (!shouldRunLearning(previousTrades, currentTrades, env.AI_TRADING_LEARNING_MIN_NEW_TRADES)) {
        results.push({ userId: owner.userId, status: 'COLLECTING_EVIDENCE' as const, previousTrades, currentTrades });
        continue;
      }
      const teacher = await runTeacherEvaluation(owner.userId, {});
      const researcher = await runResearcher(owner.userId, { minimumTrades: 50 });
      await recordCycle(owner.userId, currentTrades, { baseline: false, teacher, researcher });
      results.push({ userId: owner.userId, status: 'ANALYZED' as const, previousTrades, currentTrades, teacher, researcher });
    }
    return { status: 'COMPLETED' as const, results };
  } finally {
    learningCycleRunning = false;
  }
}

async function recordCycle(userId: string, closedPaperTrades: number, result: Record<string, unknown>) {
  await prisma.tradingAuditLog.create({ data: {
    userId, action: 'AI_LEARNING_CYCLE_COMPLETED', entityType: 'LEARNING_CYCLE',
    metadata: { closedPaperTrades, minimumNewTrades: env.AI_TRADING_LEARNING_MIN_NEW_TRADES, ...result,
      recommendationApplied: false, candidateCreated: false, liveChanged: false, riskEngineBypassed: false },
  } });
}

function jsonNumber(value: unknown, key: string) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const candidate = Number((value as Record<string, unknown>)[key]);
  return Number.isFinite(candidate) && candidate >= 0 ? candidate : null;
}

export function scheduleAutonomousLearning() {
  const execute = () => void runAutonomousLearningCycle().then((result) => logger.info({ result }, 'autonomous Teacher/Researcher cycle'))
    .catch((error) => logger.error({ err: error }, 'autonomous Teacher/Researcher cycle failed'));
  execute();
  const timer = setInterval(execute, env.AI_TRADING_LEARNING_INTERVAL_MINUTES * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
