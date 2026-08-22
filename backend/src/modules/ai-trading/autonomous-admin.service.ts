import type { Prisma, TradingBotState } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import type { NonCriticalBotSettingsInput, PromotionReviewInput, TriggerPaperGenerationInput } from './autonomous-admin.schema.js';

export const AUTONOMOUS_ADMIN_API_VERSION = 'v1' as const;

export function autonomousDTO<T>(kind: string, data: T) {
  return { apiVersion: AUTONOMOUS_ADMIN_API_VERSION, kind, data, liveTradingEnabled: false as const };
}

export async function getAutonomousOverview(userId: string) {
  const [bots, strategies, generations, paperTrades, champions, liveEligible, globalRisk] = await Promise.all([
    prisma.tradingBot.count({ where: { userId, type: 'AUTONOMOUS' } }),
    prisma.strategy.count({ where: { createdById: userId } }),
    prisma.generation.count({ where: { createdById: userId } }),
    prisma.paperTrade.count({ where: { tradingBot: { userId, type: 'AUTONOMOUS' } } }),
    prisma.tradingBot.count({ where: { userId, type: 'AUTONOMOUS', lifecycleStatus: 'CHAMPION' } }),
    prisma.tradingBot.count({ where: { userId, type: 'AUTONOMOUS', lifecycleStatus: 'LIVE_ELIGIBLE' } }),
    prisma.tradingRiskControl.findUnique({ where: { id: 'global' }, select: { globalKillSwitch: true } }),
  ]);
  return autonomousDTO('AUTONOMOUS_OVERVIEW', {
    bots, strategies, generations, paperTrades, champions, liveEligible,
    globalKillSwitch: globalRisk?.globalKillSwitch ?? true,
    safeModes: ['PAPER', 'SHADOW'] as const, liveActivationAvailable: false,
  });
}

export async function getArenaStatus(userId: string) {
  const since = new Date(Date.now() - 5 * 60_000);
  const [states, modes, decisions, latest] = await Promise.all([
    prisma.tradingBot.groupBy({ by: ['state'], where: { userId, type: 'AUTONOMOUS' }, _count: { _all: true } }),
    prisma.tradingBot.groupBy({ by: ['mode'], where: { userId, type: 'AUTONOMOUS' }, _count: { _all: true } }),
    prisma.tradingBotDecision.count({ where: { userId, type: 'AUTONOMOUS', occurredAt: { gte: since } } }),
    prisma.tradingBotDecision.findFirst({ where: { userId, type: 'AUTONOMOUS' }, orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } }),
  ]);
  return autonomousDTO('ARENA_STATUS', {
    states: Object.fromEntries(states.map((item) => [item.state, item._count._all])),
    modes: Object.fromEntries(modes.map((item) => [item.mode, item._count._all])),
    decisionsLast5m: decisions, throughputPerMinute: decisions / 5,
    latestDecisionAt: latest?.occurredAt ?? null, executionMode: 'SIMULATION_ONLY',
  });
}

export async function listGenerations(userId: string, limit: number) {
  const rows = await prisma.generation.findMany({
    where: { createdById: userId }, orderBy: [{ number: 'desc' }, { createdAt: 'desc' }], take: limit,
    include: { _count: { select: { bots: true, mutations: true, crossovers: true } } },
  });
  return autonomousDTO('GENERATION_LIST', rows.map((row) => ({
    id: row.id, number: row.number, status: row.status, populationTarget: row.populationTarget,
    metadata: row.metadata, counts: row._count, startedAt: row.startedAt, completedAt: row.completedAt,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  })));
}

export async function listLiveEligibilityStatus(userId: string) {
  const bots = await prisma.tradingBot.findMany({
    where: { userId, type: 'AUTONOMOUS', lifecycleStatus: { in: ['CHAMPION', 'LIVE_ELIGIBLE'] } },
    select: {
      id: true, name: true, mode: true, lifecycleStatus: true, state: true, updatedAt: true,
      championCandidates: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, score: true, evidence: true, evaluatedAt: true } },
    },
    orderBy: [{ lifecycleStatus: 'desc' }, { updatedAt: 'desc' }],
  });
  return autonomousDTO('LIVE_ELIGIBILITY_STATUS', bots.map((bot) => ({
    ...bot, latestCandidate: bot.championCandidates[0] ? {
      ...bot.championCandidates[0], score: bot.championCandidates[0].score?.toNumber() ?? null,
    } : null, championCandidates: undefined, liveActivated: false, manualApprovalRequired: bot.lifecycleStatus === 'LIVE_ELIGIBLE',
  })));
}

export async function triggerPaperGeneration(userId: string, input: TriggerPaperGenerationInput, ipAddress?: string) {
  return prisma.$transaction(async (tx) => {
    const running = await tx.generation.findFirst({ where: { createdById: userId, status: { in: ['RUNNING', 'EVALUATING'] } }, select: { id: true } });
    if (running) throw new ApiError(409, 'A paper generation is already active.', 'PAPER_GENERATION_ALREADY_ACTIVE');
    const maximum = await tx.generation.aggregate({ where: { createdById: userId }, _max: { number: true } });
    const generation = await tx.generation.create({ data: {
      createdById: userId, number: (maximum._max.number ?? 0) + 1, status: 'RUNNING',
      populationTarget: input.populationTarget, startedAt: new Date(),
      metadata: { mode: 'PAPER', liveEnabled: false, orderExecutionAllowed: false, trigger: 'ADMIN', note: input.note ?? null },
    } });
    await tx.tradingAuditLog.create({ data: {
      userId, action: 'AI_PAPER_GENERATION_TRIGGERED', entityType: 'GENERATION', entityId: generation.id,
      metadata: { number: generation.number, populationTarget: generation.populationTarget, mode: 'PAPER', liveEnabled: false },
      ...(ipAddress ? { ipAddress } : {}),
    } });
    return autonomousDTO('PAPER_GENERATION', generation);
  });
}

export async function pauseAutonomousBot(userId: string, id: string, ipAddress?: string) {
  return updateRuntimeState(userId, id, ['STARTING', 'RUNNING', 'RECONCILING', 'RISK_BLOCKED'], 'PAUSED', 'PAUSED', 'AI_PAPER_BOT_PAUSED', ipAddress);
}

export async function startAutonomousBot(userId: string, id: string, ipAddress?: string) {
  const bot = await ownedSafeBot(userId, id);
  if (bot.lifecycleStatus !== 'PAPER') throw new ApiError(409, 'Only PAPER lifecycle bots can start.', 'AUTONOMOUS_LIFECYCLE_NOT_RUNNABLE');
  if (!['DRAFT', 'STOPPED', 'PAUSED'].includes(bot.state)) throw new ApiError(409, 'Autonomous bot runtime transition is invalid.', 'AUTONOMOUS_RUNTIME_TRANSITION_INVALID');
  await assertAutonomousRuntimeReady(userId, bot.exchangeAccountId);
  return persistBotUpdate(userId, bot, { state: 'STARTING', desiredState: 'RUNNING', stateReason: 'Admin start; scheduler lease pending.' }, 'AI_PAPER_BOT_STARTED', ipAddress);
}

export async function resumeAutonomousBot(userId: string, id: string, ipAddress?: string) {
  const bot = await ownedSafeBot(userId, id);
  if (bot.state !== 'PAUSED') throw new ApiError(409, 'Only a paused autonomous bot can resume.', 'AUTONOMOUS_BOT_NOT_PAUSED');
  if (!['PAPER', 'CHALLENGER', 'CHAMPION'].includes(bot.lifecycleStatus)) throw new ApiError(409, 'Bot lifecycle is not runnable.', 'AUTONOMOUS_LIFECYCLE_NOT_RUNNABLE');
  await assertAutonomousRuntimeReady(userId, bot.exchangeAccountId);
  return persistBotUpdate(userId, bot, { state: 'STARTING', desiredState: 'RUNNING', stateReason: 'Admin resume; scheduler lease pending.' }, 'AI_PAPER_BOT_RESUMED', ipAddress);
}

async function assertAutonomousRuntimeReady(userId: string, exchangeAccountId: string) {
  const [account, profile, control] = await Promise.all([
    prisma.exchangeAccount.findFirst({ where: { id: exchangeAccountId, userId, environment: { in: ['TESTNET', 'DEMO'] } }, select: { isActive: true, connectionStatus: true } }),
    prisma.tradingRiskProfile.findUnique({ where: { exchangeAccountId }, select: { enabled: true, accountKillSwitch: true } }),
    prisma.tradingRiskControl.findUnique({ where: { id: 'global' }, select: { globalKillSwitch: true } }),
  ]);
  if (!account?.isActive || account.connectionStatus !== 'CONNECTED' || !profile?.enabled || profile.accountKillSwitch || (control?.globalKillSwitch ?? true)) {
    throw new ApiError(409, 'Autonomous bot failed account or Risk Engine readiness checks.', 'AUTONOMOUS_RISK_GATE_CLOSED');
  }
}

export async function archiveCandidate(userId: string, id: string, ipAddress?: string) {
  const bot = await ownedSafeBot(userId, id);
  if (!['DRAFT', 'CANDIDATE', 'TESTING', 'REJECTED'].includes(bot.lifecycleStatus)) {
    throw new ApiError(409, 'Only non-promoted candidates can be archived here.', 'CANDIDATE_ARCHIVE_FORBIDDEN');
  }
  return persistBotUpdate(userId, bot, { lifecycleStatus: 'ARCHIVED', state: 'STOPPED', desiredState: 'STOPPED' }, 'AI_CANDIDATE_ARCHIVED', ipAddress);
}

export async function reviewPromotion(userId: string, id: string, input: PromotionReviewInput, ipAddress?: string) {
  const bot = await prisma.tradingBot.findFirst({ where: { id, userId, type: 'AUTONOMOUS', lifecycleStatus: 'LIVE_ELIGIBLE' }, select: safeBotSelect });
  if (!bot) throw new ApiError(404, 'LIVE_ELIGIBLE promotion target not found.', 'PROMOTION_TARGET_NOT_FOUND');
  if (input.decision === 'REJECT') {
    const updated = await persistBotUpdate(userId, bot, { lifecycleStatus: 'PAUSED', state: 'PAUSED', desiredState: 'PAUSED' }, 'AI_LIVE_PROMOTION_REJECTED', ipAddress, { note: input.note });
    return autonomousDTO('PROMOTION_REVIEW', { decision: 'REJECTED', bot: updated.data, liveActivated: false });
  }
  await prisma.tradingAuditLog.create({ data: {
    userId, exchangeAccountId: bot.exchangeAccountId, action: 'AI_LIVE_PROMOTION_APPROVED', entityType: 'TRADING_BOT', entityId: bot.id,
    metadata: { note: input.note, status: 'LIVE_ELIGIBLE', liveActivated: false, activationRequired: true, orderSubmitted: false },
    ...(ipAddress ? { ipAddress } : {}),
  } });
  return autonomousDTO('PROMOTION_REVIEW', { decision: 'APPROVED_PENDING_ACTIVATION', botId: bot.id, lifecycleStatus: 'LIVE_ELIGIBLE', liveActivated: false, activationRequired: true });
}

export async function configureNonCriticalBotSettings(userId: string, id: string, input: NonCriticalBotSettingsInput, ipAddress?: string) {
  const bot = await ownedSafeBot(userId, id);
  if (bot.lifecycleStatus === 'LIVE_ELIGIBLE') throw new ApiError(409, 'Freeze settings before manual live review.', 'LIVE_ELIGIBLE_SETTINGS_FROZEN');
  return persistBotUpdate(userId, bot, { intervalSeconds: input.intervalSeconds }, 'AI_NON_CRITICAL_SETTINGS_UPDATED', ipAddress, input);
}

const safeBotSelect = {
  id: true, exchangeAccountId: true, mode: true, state: true, desiredState: true, lifecycleStatus: true,
  intervalSeconds: true, version: true, updatedAt: true,
} satisfies Prisma.TradingBotSelect;

async function ownedSafeBot(userId: string, id: string) {
  const bot = await prisma.tradingBot.findFirst({ where: { id, userId, type: 'AUTONOMOUS', mode: { in: ['PAPER', 'SHADOW'] } }, select: safeBotSelect });
  if (!bot) throw new ApiError(404, 'Safe autonomous bot not found.', 'AUTONOMOUS_BOT_NOT_FOUND');
  return bot;
}

async function updateRuntimeState(userId: string, id: string, allowed: TradingBotState[], state: TradingBotState, desiredState: 'PAUSED', action: string, ipAddress?: string) {
  const bot = await ownedSafeBot(userId, id);
  if (!allowed.includes(bot.state)) throw new ApiError(409, 'Autonomous bot runtime transition is invalid.', 'AUTONOMOUS_RUNTIME_TRANSITION_INVALID');
  return persistBotUpdate(userId, bot, { state, desiredState, stateReason: 'Admin requested safe PAPER/SHADOW pause.' }, action, ipAddress);
}

async function persistBotUpdate(
  userId: string, bot: Prisma.TradingBotGetPayload<{ select: typeof safeBotSelect }>, data: Prisma.TradingBotUpdateInput,
  action: string, ipAddress?: string, metadata: Record<string, unknown> = {},
) {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.tradingBot.updateMany({ where: { id: bot.id, userId, type: 'AUTONOMOUS', version: bot.version }, data: { ...data, version: { increment: 1 } } });
    if (changed.count !== 1) throw new ApiError(409, 'Bot changed concurrently; refresh and retry.', 'BOT_VERSION_CONFLICT');
    const updated = await tx.tradingBot.findUniqueOrThrow({ where: { id: bot.id }, select: safeBotSelect });
    await tx.tradingAuditLog.create({ data: {
      userId, exchangeAccountId: bot.exchangeAccountId, action, entityType: 'TRADING_BOT', entityId: bot.id,
      metadata: { ...metadata, from: { state: bot.state, lifecycleStatus: bot.lifecycleStatus }, to: { state: updated.state, lifecycleStatus: updated.lifecycleStatus }, liveActivated: false },
      ...(ipAddress ? { ipAddress } : {}),
    } });
    return autonomousDTO('AUTONOMOUS_BOT', updated);
  });
}
