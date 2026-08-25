import { Prisma } from '@prisma/client';
import { prisma } from '../src/database/prisma.js';
import { fleetLeverage, paperTrainingConfiguration } from '../src/modules/ai-trading/universe.worker.js';

const TARGET_FLAG = '--target=';
const CONFIRMATION = 'RECONCILE_PAPER_FLEET';
const DRAIN_FLAG = '--drain-open';

function targetFromArguments() {
  const raw = process.argv.find((value) => value.startsWith(TARGET_FLAG))?.slice(TARGET_FLAG.length) ?? '20';
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error('--target must be an integer between 1 and 100.');
  return value;
}

function numberFromConfiguration(value: Prisma.JsonValue, key: string) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const candidate = Number((value as Prisma.JsonObject)[key]);
  return Number.isFinite(candidate) ? candidate : null;
}

async function main() {
  const target = targetFromArguments();
  const confirmed = process.argv.includes(`--confirm=${CONFIRMATION}`);
  const drainOpen = process.argv.includes(DRAIN_FLAG);
  const owners = await prisma.tradingBot.findMany({
    where: { type: 'AUTONOMOUS', mode: 'PAPER', lifecycleStatus: { not: 'ARCHIVED' } },
    distinct: ['userId'], select: { userId: true }, orderBy: { userId: 'asc' },
  });
  const results = [];

  for (const owner of owners) {
    const bots = await prisma.tradingBot.findMany({
      where: { userId: owner.userId, type: 'AUTONOMOUS', mode: 'PAPER', lifecycleStatus: { not: 'ARCHIVED' } },
      include: {
        paperPosition: { select: { netQuantity: true } },
        paperTrades: { where: { status: 'OPEN' }, select: { id: true }, take: 1 },
        metrics: { orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }], select: { score: true, totalTrades: true, netPnl: true }, take: 1 },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    const hasExposure = (bot: typeof bots[number]) => Boolean(bot.paperPosition && !bot.paperPosition.netQuantity.isZero()) || bot.paperTrades.length > 0;
    const protectedCount = bots.filter(hasExposure).length;
    if (protectedCount > target && !drainOpen) throw new Error(`User ${owner.userId} has ${protectedCount} PAPER bots with open exposure. Re-run with ${DRAIN_FLAG} to close retiring PAPER trades through the normal fee/PnL lifecycle.`);
    const ranked = [...bots].sort((left, right) => {
      const exposureDifference = Number(hasExposure(right)) - Number(hasExposure(left));
      if (exposureDifference !== 0) return exposureDifference;
      const leftMetric = left.metrics[0]; const rightMetric = right.metrics[0];
      const scoreDifference = (rightMetric?.score?.toNumber() ?? Number.NEGATIVE_INFINITY) - (leftMetric?.score?.toNumber() ?? Number.NEGATIVE_INFINITY);
      if (scoreDifference !== 0) return scoreDifference;
      const tradeDifference = (rightMetric?.totalTrades ?? 0) - (leftMetric?.totalTrades ?? 0);
      if (tradeDifference !== 0) return tradeDifference;
      const pnlDifference = (rightMetric?.netPnl?.toNumber() ?? 0) - (leftMetric?.netPnl?.toNumber() ?? 0);
      if (pnlDifference !== 0) return pnlDifference;
      return left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
    });
    const keep = ranked.slice(0, target);
    const retire = ranked.slice(target);
    const drain = retire.filter(hasExposure);
    const archiveNow = retire.filter((bot) => !hasExposure(bot));
    const plan = { userId: owner.userId, before: bots.length, target, protectedOpenPositions: protectedCount,
      keep: keep.map((bot) => ({ id: bot.id, name: bot.name, symbol: bot.symbol })), retireCount: retire.length,
      drainingOpenTrades: drain.length, archiveImmediately: archiveNow.length };
    if (!confirmed) { results.push({ ...plan, status: 'DRY_RUN' }); continue; }

    const updates: Prisma.PrismaPromise<unknown>[] = keep.map((bot, index) => {
      const configuredLeverage = numberFromConfiguration(bot.configuration, 'leverage');
      const leverage = configuredLeverage && configuredLeverage >= 5 && configuredLeverage <= 20
        ? Math.round(configuredLeverage) : fleetLeverage(index, keep.length);
      return prisma.tradingBot.update({ where: { id: bot.id }, data: {
        intervalSeconds: 5, configuration: paperTrainingConfiguration(bot.configuration, leverage),
        desiredState: 'RUNNING',
        ...(['PAUSED', 'STOPPED', 'ERROR', 'DRAFT'].includes(bot.state)
          ? { state: 'STARTING' as const, schedulerOwner: null, leaseExpiresAt: null, heartbeatAt: null,
              lastErrorCode: null, lastErrorMessage: null, stateReason: `PAPER fleet reconciled to ${target}; scheduler lease pending.` }
          : {}),
        version: { increment: 1 },
      } });
    });
    for (const bot of drain) {
      const source = bot.configuration && !Array.isArray(bot.configuration) && typeof bot.configuration === 'object'
        ? bot.configuration as Prisma.JsonObject : {};
      updates.push(prisma.tradingBot.update({ where: { id: bot.id }, data: {
        intervalSeconds: 1, configuration: { ...source, paperAlwaysInMarket: false, paperFleetRetirementPending: true },
        state: 'RUNNING', desiredState: 'RUNNING', stateReason: `PAPER fleet drain to ${target}; risk-reducing close pending.`,
        lastErrorCode: null, lastErrorMessage: null, version: { increment: 1 },
      } }));
    }
    if (archiveNow.length > 0) updates.push(prisma.tradingBot.updateMany({
      where: { id: { in: archiveNow.map((bot) => bot.id) }, userId: owner.userId, type: 'AUTONOMOUS', mode: 'PAPER' },
      data: { lifecycleStatus: 'ARCHIVED', state: 'STOPPED', desiredState: 'STOPPED', schedulerOwner: null,
        leaseExpiresAt: null, heartbeatAt: null, stateReason: `Retained with full history after PAPER fleet reduction to ${target}.`, version: { increment: 1 } },
    }));
    updates.push(prisma.generation.updateMany({
      where: { createdById: owner.userId, status: { in: ['RUNNING', 'EVALUATING'] } }, data: { populationTarget: target },
    }));
    updates.push(prisma.tradingAuditLog.create({ data: {
      userId: owner.userId, action: 'AI_PAPER_FLEET_RECONCILED', entityType: 'TRADING_BOT', entityId: keep[0]?.id ?? owner.userId,
      metadata: { target, before: bots.length, activeBotIds: keep.map((bot) => bot.id), retiringBotIds: retire.map((bot) => bot.id),
        drainingBotIds: drain.map((bot) => bot.id), archivedBotIds: archiveNow.map((bot) => bot.id), protectedOpenPositions: protectedCount,
        historyDeleted: false, liveChanged: false },
    } }));
    await prisma.$transaction(updates);
    results.push({ ...plan, status: 'RECONCILED', historyDeleted: false, liveChanged: false });
  }
  console.log(JSON.stringify({ target, drainOpen, confirmed, confirmationRequired: confirmed ? null : CONFIRMATION, results }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
