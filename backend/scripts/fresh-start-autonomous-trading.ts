import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/database/prisma.js';
import { getTradingEngineSnapshot } from '../src/modules/trading/trading-engine.client.js';

const confirmation = process.argv.find((argument) => argument.startsWith('--confirm='))?.slice('--confirm='.length);
const exchangeChecked = process.argv.includes('--exchange-checked');
const target = Number(process.argv.find((argument) => argument.startsWith('--target='))?.slice('--target='.length) ?? '20');
const startingBalance = new Prisma.Decimal(process.argv.find((argument) => argument.startsWith('--starting-balance='))?.slice('--starting-balance='.length) ?? '100');

if (!Number.isInteger(target) || target < 1 || target > 100) throw new Error('--target must be an integer between 1 and 100.');
if (!startingBalance.isPositive()) throw new Error('--starting-balance must be positive.');

function botPrefix(botId: string) {
  return `ka${createHash('sha256').update(botId).digest('hex').slice(0, 8)}`;
}

function cleanConfiguration(value: Prisma.JsonValue): Prisma.InputJsonValue {
  const configuration = value && !Array.isArray(value) && typeof value === 'object'
    ? { ...(value as Prisma.JsonObject) }
    : {};
  for (const key of [
    'paperFleetRetirementPending', 'paperManualCloseRequested', 'paperManualCloseStopBot',
    'paperManualCloseRequestedAt', 'universeRotationPending',
  ]) delete configuration[key];
  configuration.allocationUsdt = startingBalance.toNumber();
  configuration.paperAlwaysInMarket = true;
  configuration.continuousTraining = true;
  return configuration as Prisma.InputJsonValue;
}

async function ownerPlan(userId: string) {
  const [allBots, keepers, strategies, generations] = await Promise.all([
    prisma.tradingBot.findMany({ where: { userId, type: 'AUTONOMOUS' }, select: { id: true, name: true, mode: true, lifecycleStatus: true, exchangeAccountId: true } }),
    prisma.tradingBot.findMany({
      where: { userId, type: 'AUTONOMOUS', mode: 'PAPER', lifecycleStatus: { not: 'ARCHIVED' } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, configuration: true, strategyVersion: { select: { strategy: { select: { family: true } } } } },
    }),
    prisma.strategy.findMany({ where: { createdById: userId }, select: { id: true } }),
    prisma.generation.findMany({ where: { createdById: userId }, select: { id: true } }),
  ]);
  if (keepers.length !== target) {
    throw new Error(`User ${userId} has ${keepers.length} active PAPER bots; expected exactly ${target}. Reconcile the fleet before fresh start.`);
  }
  const botIds = allBots.map((bot) => bot.id);
  const prefixes = botIds.map(botPrefix);
  const blockingOrders = prefixes.length ? await prisma.tradingOrder.findMany({
    where: {
      userId, source: 'SYSTEM', status: { in: ['SUBMITTING', 'OPEN', 'PARTIALLY_FILLED', 'CANCELING', 'CLOSING', 'RECONCILIATION_REQUIRED'] },
      OR: prefixes.map((prefix) => ({ clientOrderId: { startsWith: prefix } })),
    }, select: { id: true, clientOrderId: true, status: true, symbol: true },
  }) : [];
  if (blockingOrders.length) {
    throw new Error(`User ${userId} has ${blockingOrders.length} non-terminal autonomous TESTNET orders. Reconcile/close them before deleting history.`);
  }
  const demoAccountIds = [...new Set(allBots.filter((bot) => bot.mode === 'DEMO').map((bot) => bot.exchangeAccountId))];
  if (demoAccountIds.length && !exchangeChecked) {
    const accounts = await prisma.exchangeAccount.findMany({
      where: { id: { in: demoAccountIds }, userId },
      select: { id: true, userId: true, provider: true, environment: true, accountType: true },
    });
    for (const account of accounts) {
      const snapshot = await getTradingEngineSnapshot(account);
      const positions = snapshot.positions.filter((position) => Math.abs(Number(position.quantity)) > 0);
      const autonomousOrders = snapshot.orders.filter((order) => prefixes.some((prefix) => order.clientOrderId.startsWith(prefix)));
      if (positions.length || autonomousOrders.length) {
        throw new Error(`Exchange account ${account.id} still has ${positions.length} position(s) and ${autonomousOrders.length} autonomous order(s). Close/reconcile exchange exposure before fresh start.`);
      }
    }
  }
  return {
    userId, allBots, keepers, botIds, prefixes,
    strategyIds: strategies.map((item) => item.id), generationIds: generations.map((item) => item.id),
  };
}

async function resetOwner(plan: Awaited<ReturnType<typeof ownerPlan>>) {
  const keepIds = plan.keepers.map((bot) => bot.id);
  const deleteIds = plan.botIds.filter((id) => !keepIds.includes(id));
  return prisma.$transaction(async (tx) => {
    const autonomousOrders = plan.prefixes.length ? await tx.tradingOrder.findMany({
      where: { userId: plan.userId, source: 'SYSTEM', OR: plan.prefixes.map((prefix) => ({ clientOrderId: { startsWith: prefix } })) },
      select: { id: true, previewId: true },
    }) : [];
    const orderIds = autonomousOrders.map((item) => item.id);
    const previewIds = autonomousOrders.flatMap((item) => item.previewId ? [item.previewId] : []);

    await tx.teacherEvaluation.deleteMany({ where: { OR: [
      { tradingBotId: { in: plan.botIds } }, { strategyId: { in: plan.strategyIds } },
    ] } });
    await tx.championCandidate.deleteMany({ where: { tradingBotId: { in: plan.botIds } } });
    await tx.botMutation.deleteMany({ where: { OR: [
      { parentBotId: { in: plan.botIds } }, { childBotId: { in: plan.botIds } }, { generationId: { in: plan.generationIds } },
    ] } });
    await tx.botCrossover.deleteMany({ where: { OR: [
      { parentABotId: { in: plan.botIds } }, { parentBBotId: { in: plan.botIds } }, { childBotId: { in: plan.botIds } }, { generationId: { in: plan.generationIds } },
    ] } });
    await tx.evolutionRun.deleteMany({ where: { createdById: plan.userId } });
    await tx.researchHypothesis.deleteMany({ where: { createdById: plan.userId } });
    await tx.portfolioAllocation.deleteMany({ where: { userId: plan.userId, mode: { in: ['PAPER', 'DEMO', 'SHADOW'] } } });
    await tx.paperAccountingPeriod.deleteMany({ where: { userId: plan.userId } });

    await tx.tradingBotSignal.deleteMany({ where: { tradingBotId: { in: plan.botIds } } });
    await tx.shadowTrade.deleteMany({ where: { tradingBotId: { in: plan.botIds } } });
    await tx.tradingBotPaperFill.deleteMany({ where: { tradingBotId: { in: plan.botIds } } });
    await tx.tradingBotDecision.deleteMany({ where: { tradingBotId: { in: plan.botIds } } });
    await tx.paperTrade.deleteMany({ where: { tradingBotId: { in: plan.botIds } } });
    await tx.testnetExecutionFill.deleteMany({ where: { tradingBotId: { in: plan.botIds } } });
    await tx.tradingBotPaperPosition.deleteMany({ where: { tradingBotId: { in: plan.botIds } } });
    await tx.botMetric.deleteMany({ where: { tradingBotId: { in: plan.botIds } } });

    if (orderIds.length) {
      await tx.tradingRiskEvent.deleteMany({ where: { tradingOrderId: { in: orderIds } } });
      await tx.tradingOutboxEvent.deleteMany({ where: { aggregateId: { in: orderIds } } });
      await tx.tradingOrder.deleteMany({ where: { id: { in: orderIds } } });
    }
    if (previewIds.length) await tx.manualOrderPreview.deleteMany({ where: { id: { in: previewIds } } });
    await tx.tradingRiskEvent.deleteMany({ where: { userId: plan.userId, source: 'SYSTEM' } });
    await tx.tradingAuditLog.deleteMany({ where: { userId: plan.userId, action: { startsWith: 'AI_' } } });

    await tx.tradingBot.updateMany({
      where: { id: { in: plan.botIds } },
      data: { parentBotId: null, generationId: null, schedulerOwner: null, leaseExpiresAt: null },
    });
    if (deleteIds.length) await tx.tradingBot.deleteMany({ where: { id: { in: deleteIds } } });
    if (plan.generationIds.length) await tx.generation.deleteMany({ where: { id: { in: plan.generationIds } } });

    // Avoid transient unique-name collisions while assigning a clean G1 #001-#020 sequence.
    for (const bot of plan.keepers) {
      await tx.tradingBot.update({ where: { id: bot.id }, data: { name: `Fresh ${bot.id}` } });
    }
    const generation = await tx.generation.create({ data: {
      createdById: plan.userId, number: 1, status: 'RUNNING', populationTarget: target, startedAt: new Date(),
      metadata: { mode: 'PAPER', freshStart: true, productionLive: false, target },
    } });
    const ordered = [...plan.keepers].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
    for (const [index, bot] of ordered.entries()) {
      const family = bot.strategyVersion?.strategy.family ?? 'MOMENTUM';
      const familyName = family.toLowerCase().replace(/(^|_)([a-z])/g, (_match, _prefix, letter: string) => letter.toUpperCase());
      await tx.tradingBot.update({ where: { id: bot.id }, data: {
        name: `AI ${familyName} G1 #${String(index + 1).padStart(3, '0')}`,
        mode: 'PAPER', lifecycleStatus: 'PAPER', state: 'STOPPED', desiredState: 'STOPPED',
        stateReason: 'Fresh autonomous PAPER start; awaiting explicit admin start.',
        configuration: cleanConfiguration(bot.configuration), startingPaperBalance: startingBalance,
        generationId: generation.id, parentBotId: null,
        lastErrorCode: null, lastErrorMessage: null, schedulerOwner: null, leaseExpiresAt: null,
        heartbeatAt: null, lastDecisionAt: null, startedAt: null, stoppedAt: new Date(), version: { increment: 1 },
      } });
    }
    const accounting = await tx.paperAccountingPeriod.create({ data: {
      userId: plan.userId, number: 1, status: 'ACTIVE', baselineStartingCapital: startingBalance.mul(target),
      baselineRealizedPnl: 0, baselineUnrealizedPnl: 0, baselineFees: 0,
      botIds: keepIds, botCount: target, note: 'Fresh autonomous PAPER start.', startedAt: new Date(),
    } });
    await tx.tradingAuditLog.create({ data: {
      userId: plan.userId, action: 'AI_FRESH_START_RESET', entityType: 'AUTONOMOUS_FLEET',
      metadata: { retainedBots: target, deletedBots: deleteIds.length, tradeHistoryDeleted: true, learningEvidenceDeleted: true, startingBalance: startingBalance.toString(), productionLive: false },
    } });
    return { userId: plan.userId, retainedBots: target, deletedBots: deleteIds.length, generationId: generation.id, accountingPeriodId: accounting.id };
  // Decision history can contain millions of rows and its cascading index work
  // legitimately takes several minutes. Services are stopped for this explicit
  // maintenance command, so keep one atomic transaction with a realistic limit.
  }, { maxWait: 20_000, timeout: 900_000 });
}

async function main() {
  if (exchangeChecked && confirmation !== 'RESET_AUTONOMOUS_TRADING_HISTORY') {
    throw new Error('--exchange-checked is only valid with the exact destructive confirmation after a successful dry-run.');
  }
  const owners = await prisma.tradingBot.findMany({ where: { type: 'AUTONOMOUS' }, distinct: ['userId'], select: { userId: true } });
  const plans = await Promise.all(owners.map((owner) => ownerPlan(owner.userId)));
  console.log(JSON.stringify({ target, startingBalance: startingBalance.toString(), owners: plans.map((plan) => ({
    userId: plan.userId, totalBots: plan.allBots.length, retainedBots: plan.keepers.length,
    deletedBots: plan.allBots.length - plan.keepers.length,
    modes: Object.fromEntries(['PAPER', 'SHADOW', 'DEMO'].map((mode) => [mode, plan.allBots.filter((bot) => bot.mode === mode).length])),
  })) }, null, 2));
  if (confirmation !== 'RESET_AUTONOMOUS_TRADING_HISTORY') {
    throw new Error('Dry run only. Re-run with --confirm=RESET_AUTONOMOUS_TRADING_HISTORY to permanently delete autonomous trade and learning history.');
  }
  const results = [];
  for (const plan of plans) results.push(await resetOwner(plan));
  console.log(JSON.stringify({ reset: results }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
