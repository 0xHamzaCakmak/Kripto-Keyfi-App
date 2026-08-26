import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';
import { listTestnetBotOperations } from './testnet-operations.service.js';

export const TESTNET_CHALLENGER_MIN_CLOSED_TRADES = 50;

let learningCycleRunning = false;

export function shouldRunLearning(previousTrades: number, currentTrades: number, minimumNewTrades: number) {
  return currentTrades >= previousTrades && currentTrades - previousTrades >= minimumNewTrades;
}

export async function promoteQualifiedTestnetChallengers(
  userId: string,
  minimumClosedTrades = TESTNET_CHALLENGER_MIN_CLOSED_TRADES,
) {
  const closures = await prisma.testnetExecutionFill.groupBy({
    by: ['tradingBotId', 'exchangeOrderId'],
    where: {
      userId,
      reduceOnly: true,
      tradingBot: { type: 'AUTONOMOUS', mode: 'DEMO' },
    },
    _count: { _all: true },
  });
  const tradeCounts = new Map<string, number>();
  for (const closure of closures) {
    tradeCounts.set(closure.tradingBotId, (tradeCounts.get(closure.tradingBotId) ?? 0) + 1);
  }

  const qualifiedIds = [...tradeCounts.entries()]
    .filter(([, count]) => count >= minimumClosedTrades)
    .map(([botId]) => botId);
  if (qualifiedIds.length === 0) return [];

  const bots = await prisma.tradingBot.findMany({
    where: {
      id: { in: qualifiedIds },
      userId,
      type: 'AUTONOMOUS',
      mode: 'DEMO',
      lifecycleStatus: { in: ['DRAFT', 'CANDIDATE', 'TESTING', 'PAPER'] },
    },
    select: {
      id: true,
      exchangeAccountId: true,
      lifecycleStatus: true,
      metrics: { orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }], take: 1, select: { score: true } },
    },
  });
  const promoted: string[] = [];
  for (const bot of bots) {
    const totalTrades = tradeCounts.get(bot.id) ?? 0;
    const changed = await prisma.$transaction(async (tx) => {
      const update = await tx.tradingBot.updateMany({
        where: {
          id: bot.id,
          userId,
          type: 'AUTONOMOUS',
          mode: 'DEMO',
          lifecycleStatus: bot.lifecycleStatus,
        },
        data: { lifecycleStatus: 'CHALLENGER', version: { increment: 1 } },
      });
      if (update.count !== 1) return false;
      const score = bot.metrics[0]?.score;
      await tx.championCandidate.create({
        data: {
          tradingBotId: bot.id,
          status: 'PROMOTED',
          ...(score ? { score } : {}),
          evidence: {
            source: 'BINANCE_TESTNET',
            totalTrades,
            minimumClosedTrades,
            from: bot.lifecycleStatus,
            target: 'CHALLENGER',
            failedGates: [],
          },
          evaluatedAt: new Date(),
          promotedAt: new Date(),
        },
      });
      await tx.tradingAuditLog.create({
        data: {
          userId,
          exchangeAccountId: bot.exchangeAccountId,
          action: 'AI_TESTNET_BOT_PROMOTED_TO_CHALLENGER',
          entityType: 'TRADING_BOT',
          entityId: bot.id,
          metadata: {
            from: bot.lifecycleStatus,
            to: 'CHALLENGER',
            source: 'BINANCE_TESTNET',
            totalTrades,
            minimumClosedTrades,
            liveActivated: false,
            riskEngineBypassed: false,
          },
        },
      });
      return true;
    });
    if (changed) promoted.push(bot.id);
  }
  return promoted;
}

export async function runAutonomousLearningCycle() {
  if (learningCycleRunning) return { status: 'LOCKED' as const };
  learningCycleRunning = true;
  try {
    const owners = await prisma.tradingBot.findMany({
      where: { type: 'AUTONOMOUS', mode: 'DEMO', lifecycleStatus: { not: 'ARCHIVED' } },
      distinct: ['userId'],
      select: { userId: true },
    });
    const results = [];
    for (const owner of owners) {
      await listTestnetBotOperations(owner.userId).catch((error) => {
        logger.warn({ err: error, userId: owner.userId }, 'Binance TESTNET evidence sync skipped for this learning cycle');
      });
      const closures = await prisma.testnetExecutionFill.groupBy({
        by: ['tradingBotId', 'exchangeOrderId'],
        where: {
          userId: owner.userId,
          reduceOnly: true,
          tradingBot: { type: 'AUTONOMOUS', mode: 'DEMO' },
        },
        _count: { _all: true },
      });
      const currentTrades = closures.length;
      const promotedBotIds = await promoteQualifiedTestnetChallengers(owner.userId);
      const checkpoint = await prisma.tradingAuditLog.findFirst({
        where: { userId: owner.userId, action: 'AI_TESTNET_LEARNING_CYCLE_COMPLETED' },
        orderBy: { createdAt: 'desc' },
        select: { metadata: true },
      });
      const previousTrades = jsonNumber(checkpoint?.metadata, 'closedTestnetTrades');
      if (previousTrades === null) {
        await recordCycle(owner.userId, currentTrades, promotedBotIds, true);
        results.push({ userId: owner.userId, status: 'BASELINED' as const, currentTrades, promotedBotIds });
        continue;
      }
      if (!shouldRunLearning(previousTrades, currentTrades, env.AI_TRADING_LEARNING_MIN_NEW_TRADES)) {
        if (promotedBotIds.length > 0) await recordCycle(owner.userId, currentTrades, promotedBotIds, false);
        results.push({ userId: owner.userId, status: 'COLLECTING_EVIDENCE' as const, previousTrades, currentTrades, promotedBotIds });
        continue;
      }
      await recordCycle(owner.userId, currentTrades, promotedBotIds, false);
      results.push({ userId: owner.userId, status: 'ANALYZED' as const, previousTrades, currentTrades, promotedBotIds });
    }
    return { status: 'COMPLETED' as const, results };
  } finally {
    learningCycleRunning = false;
  }
}

async function recordCycle(userId: string, closedTestnetTrades: number, promotedBotIds: string[], baseline: boolean) {
  await prisma.tradingAuditLog.create({
    data: {
      userId,
      action: 'AI_TESTNET_LEARNING_CYCLE_COMPLETED',
      entityType: 'LEARNING_CYCLE',
      metadata: {
        closedTestnetTrades,
        evidenceModes: ['BINANCE_TESTNET'],
        minimumNewTrades: env.AI_TRADING_LEARNING_MIN_NEW_TRADES,
        challengerMinimumClosedTrades: TESTNET_CHALLENGER_MIN_CLOSED_TRADES,
        promotedBotIds,
        baseline,
        recommendationApplied: false,
        candidateCreated: promotedBotIds.length > 0,
        liveChanged: false,
        riskEngineBypassed: false,
      },
    },
  });
}

function jsonNumber(value: unknown, key: string) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const candidate = Number((value as Record<string, unknown>)[key]);
  return Number.isFinite(candidate) && candidate >= 0 ? candidate : null;
}

export function scheduleAutonomousLearning() {
  const execute = () => void runAutonomousLearningCycle()
    .then((result) => logger.info({ result }, 'autonomous TESTNET learning cycle'))
    .catch((error) => logger.error({ err: error }, 'autonomous TESTNET learning cycle failed'));
  execute();
  const timer = setInterval(execute, env.AI_TRADING_LEARNING_INTERVAL_MINUTES * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
