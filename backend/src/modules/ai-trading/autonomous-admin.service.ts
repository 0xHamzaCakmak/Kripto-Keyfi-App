import type { Prisma, TradingBotState } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { env } from '../../config/env.js';
import type { BotCapitalInput, NonCriticalBotSettingsInput, PromotionReviewInput, TestnetActivationInput, TriggerPaperGenerationInput } from './autonomous-admin.schema.js';
import { collectLiveEligibilityEvidence } from './live-eligibility.service.js';
import { DEFAULT_LIVE_ELIGIBILITY_CONFIG } from './live-eligibility.schema.js';
import { assessEvolutionReadiness, evolutionConfigForPopulation } from './evolution.service.js';

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
    testnetExecutionAvailable: env.AUTONOMOUS_TESTNET_EXECUTION_ENABLED,
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
    include: {
      _count: { select: { bots: true, mutations: true, crossovers: true } },
      bots: { where: { type: 'AUTONOMOUS', mode: 'PAPER' }, select: {
        id: true, lifecycleStatus: true,
        metrics: { orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }], take: 1, select: { totalTrades: true, score: true } },
      } },
    },
  });
  return autonomousDTO('GENERATION_LIST', rows.map((row) => {
    const config = evolutionConfigForPopulation(row.populationTarget, env.AI_TRADING_EVOLUTION_MIN_TRADES, env.AI_TRADING_MAX_GENERATIONS);
    const evidence = row.bots.map((bot) => ({
      botId: bot.id, lifecycleStatus: bot.lifecycleStatus,
      score: bot.metrics[0]?.score?.toNumber() ?? null, totalTrades: bot.metrics[0]?.totalTrades ?? 0,
    }));
    return {
      id: row.id, number: row.number, status: row.status, populationTarget: row.populationTarget,
      metadata: row.metadata, counts: row._count,
      readiness: assessEvolutionReadiness(evidence, row.populationTarget, config),
      startedAt: row.startedAt, completedAt: row.completedAt, createdAt: row.createdAt, updatedAt: row.updatedAt,
    };
  }));
}

export async function listLiveEligibilityStatus(userId: string) {
  const [bots, currentEvidence] = await Promise.all([prisma.tradingBot.findMany({
    where: { userId, type: 'AUTONOMOUS', lifecycleStatus: { in: ['CHAMPION', 'LIVE_ELIGIBLE'] } },
    select: {
      id: true, name: true, mode: true, lifecycleStatus: true, state: true, updatedAt: true,
      championCandidates: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, status: true, score: true, evidence: true, evaluatedAt: true } },
    },
    orderBy: [{ lifecycleStatus: 'desc' }, { updatedAt: 'desc' }],
  }), collectLiveEligibilityEvidence(userId, DEFAULT_LIVE_ELIGIBILITY_CONFIG)]);
  const evidenceByBot = new Map(currentEvidence.map((item) => [item.botId, item]));
  return autonomousDTO('LIVE_ELIGIBILITY_STATUS', bots.map((bot) => ({
    ...bot, latestCandidate: bot.championCandidates[0] ? {
      ...bot.championCandidates[0], score: bot.championCandidates[0].score?.toNumber() ?? null,
    } : null, championCandidates: undefined, evidence: evidenceByBot.get(bot.id) ?? null,
    liveActivated: false, manualApprovalRequired: bot.lifecycleStatus === 'LIVE_ELIGIBLE',
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
  return updateRuntimeState(userId, id, ['STARTING', 'RUNNING', 'RECONCILING', 'RISK_BLOCKED'], 'PAUSED', 'PAUSED', 'AI_AUTONOMOUS_BOT_PAUSED', ipAddress);
}

export async function startAutonomousBot(userId: string, id: string, ipAddress?: string) {
  const bot = await ownedSafeBot(userId, id);
  if (bot.lifecycleStatus !== 'PAPER') throw new ApiError(409, 'Only PAPER lifecycle bots can start.', 'AUTONOMOUS_LIFECYCLE_NOT_RUNNABLE');
  if (!['DRAFT', 'STOPPED', 'PAUSED'].includes(bot.state)) throw new ApiError(409, 'Autonomous bot runtime transition is invalid.', 'AUTONOMOUS_RUNTIME_TRANSITION_INVALID');
  await assertAutonomousRuntimeReady(userId, bot.exchangeAccountId);
  return persistBotUpdate(userId, bot, { state: 'STARTING', desiredState: 'RUNNING', stateReason: 'Admin start; scheduler lease pending.' }, 'AI_PAPER_BOT_STARTED', ipAddress);
}

export async function resumeAutonomousBot(userId: string, id: string, ipAddress?: string) {
  const bot = await prisma.tradingBot.findFirst({ where: { id, userId, type: 'AUTONOMOUS', mode: { in: ['PAPER', 'SHADOW', 'DEMO'] } }, select: safeBotSelect });
  if (!bot) throw new ApiError(404, 'Autonomous bot not found.', 'AUTONOMOUS_BOT_NOT_FOUND');
  if (bot.state !== 'PAUSED') throw new ApiError(409, 'Only a paused autonomous bot can resume.', 'AUTONOMOUS_BOT_NOT_PAUSED');
  if (!['PAPER', 'CHALLENGER', 'CHAMPION'].includes(bot.lifecycleStatus)) throw new ApiError(409, 'Bot lifecycle is not runnable.', 'AUTONOMOUS_LIFECYCLE_NOT_RUNNABLE');
  if (bot.mode === 'DEMO' && !env.AUTONOMOUS_TESTNET_EXECUTION_ENABLED) throw new ApiError(409, 'Autonomous TESTNET execution feature flag is disabled.', 'AUTONOMOUS_TESTNET_DISABLED');
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

export function configuredCapital(value: Prisma.JsonValue, fallback: number) {
  if (!value || Array.isArray(value) || typeof value !== 'object') return fallback;
  const candidate = Number((value as Prisma.JsonObject).allocationUsdt);
  return Number.isFinite(candidate) && candidate > 0 ? candidate : fallback;
}

export async function configureBotCapital(userId: string, id: string, input: BotCapitalInput, ipAddress?: string) {
  const bot = await prisma.tradingBot.findFirst({
    where: { id, userId, type: 'AUTONOMOUS', mode: { in: ['PAPER', 'DEMO'] }, lifecycleStatus: { notIn: ['LIVE_ELIGIBLE', 'LIVE', 'ARCHIVED'] } },
    select: safeBotSelect,
  });
  if (!bot) throw new ApiError(404, 'PAPER or TESTNET autonomous bot not found.', 'AUTONOMOUS_BOT_NOT_FOUND');
  const previousAllocation = configuredCapital(bot.configuration, bot.startingPaperBalance.toNumber());
  const target = Number((input.action === 'ADD' ? previousAllocation + input.amountUsdt : input.amountUsdt).toFixed(2));
  if (target < previousAllocation) throw new ApiError(409, 'Bot capital cannot be reduced while autonomous execution is enabled.', 'AUTONOMOUS_CAPITAL_REDUCTION_FORBIDDEN');
  if (target < 10 || target > 10_000) throw new ApiError(409, 'Bot capital must remain between 10 and 10,000 USDT.', 'AUTONOMOUS_CAPITAL_LIMIT');
  const source = bot.configuration && !Array.isArray(bot.configuration) && typeof bot.configuration === 'object' ? bot.configuration as Prisma.JsonObject : {};
  const nextStartingBalance = input.action === 'ADD'
    ? Number((bot.startingPaperBalance.toNumber() + input.amountUsdt).toFixed(2))
    : target;

  return prisma.$transaction(async (tx) => {
    const changed = await tx.tradingBot.updateMany({
      where: { id: bot.id, userId, type: 'AUTONOMOUS', version: bot.version },
      data: { configuration: { ...source, allocationUsdt: target }, startingPaperBalance: nextStartingBalance, version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new ApiError(409, 'Bot changed concurrently; refresh and retry.', 'BOT_VERSION_CONFLICT');
    const demoBots = await tx.tradingBot.findMany({
      where: { exchangeAccountId: bot.exchangeAccountId, userId, type: 'AUTONOMOUS', mode: 'DEMO', lifecycleStatus: { not: 'ARCHIVED' } },
      select: { id: true, configuration: true, startingPaperBalance: true },
    });
    const demoAllocation = demoBots.reduce((sum, item) => sum + (item.id === bot.id ? target : configuredCapital(item.configuration, item.startingPaperBalance.toNumber())), 0);
    const profile = await tx.tradingRiskProfile.findUnique({ where: { exchangeAccountId: bot.exchangeAccountId }, select: { id: true, maxAccountOpenNotional: true, maxSymbolOpenNotional: true } });
    if (profile) await tx.tradingRiskProfile.update({ where: { id: profile.id }, data: {
      maxAccountOpenNotional: Math.max(profile.maxAccountOpenNotional.toNumber(), demoAllocation).toFixed(2),
      maxSymbolOpenNotional: Math.max(profile.maxSymbolOpenNotional.toNumber(), target).toFixed(2),
    } });
    const updated = await tx.tradingBot.findUniqueOrThrow({ where: { id: bot.id }, select: safeBotSelect });
    await tx.tradingAuditLog.create({ data: {
      userId, exchangeAccountId: bot.exchangeAccountId,
      action: input.action === 'ADD' ? 'AI_BOT_CAPITAL_ADDED' : 'AI_BOT_CAPITAL_SET', entityType: 'TRADING_BOT', entityId: bot.id,
      metadata: { action: input.action, amountUsdt: input.amountUsdt, previousAllocationUsdt: previousAllocation, allocationUsdt: target,
        previousStartingBalance: bot.startingPaperBalance.toString(), startingBalance: nextStartingBalance, mode: bot.mode,
        sharedTestnetQuota: bot.mode === 'DEMO', note: input.note ?? null, productionLive: false, riskEngineBypassed: false },
      ...(ipAddress ? { ipAddress } : {}),
    } });
    return autonomousDTO('AUTONOMOUS_BOT_CAPITAL', { bot: updated, allocationUsdt: target, maximumAllocationUsdt: 10_000, sharedTestnetQuota: bot.mode === 'DEMO' });
  });
}

export async function activateAutonomousTestnet(userId: string, id: string, input: TestnetActivationInput, ipAddress?: string) {
  if (!env.AUTONOMOUS_TESTNET_EXECUTION_ENABLED) throw new ApiError(409, 'Autonomous TESTNET execution feature flag is disabled.', 'AUTONOMOUS_TESTNET_DISABLED');
  const bot = await prisma.tradingBot.findFirst({ where: { id, userId, type: 'AUTONOMOUS', mode: 'PAPER', lifecycleStatus: 'PAPER' }, select: safeBotSelect });
  if (!bot) throw new ApiError(404, 'PAPER autonomous bot not found.', 'AUTONOMOUS_BOT_NOT_FOUND');
  const [account, profile, control, activeCanaries, activeSymbol, paperPosition] = await Promise.all([
    prisma.exchangeAccount.findFirst({ where: { id: bot.exchangeAccountId, userId }, select: { provider: true, environment: true, executionEngine: true, connectionStatus: true, isActive: true } }),
    prisma.tradingRiskProfile.findUnique({ where: { exchangeAccountId: bot.exchangeAccountId }, select: { enabled: true, accountKillSwitch: true, marginModePolicy: true, stopLossRequired: true } }),
    prisma.tradingRiskControl.findUnique({ where: { id: 'global' }, select: { globalKillSwitch: true } }),
    prisma.tradingBot.count({ where: { userId, type: 'AUTONOMOUS', mode: 'DEMO', desiredState: 'RUNNING' } }),
    prisma.tradingBot.count({ where: { userId, type: 'AUTONOMOUS', mode: 'DEMO', desiredState: 'RUNNING', symbol: bot.symbol } }),
    prisma.tradingBotPaperPosition.findUnique({ where: { tradingBotId: bot.id }, select: { netQuantity: true } }),
  ]);
  if (!account || account.provider !== 'BINANCE' || account.environment !== 'TESTNET' || account.executionEngine !== 'GO' || account.connectionStatus !== 'CONNECTED' || !account.isActive) {
    throw new ApiError(409, 'Bot requires a connected Binance TESTNET account owned by the Go executor.', 'AUTONOMOUS_TESTNET_ACCOUNT_NOT_READY');
  }
  if (!profile?.enabled || profile.accountKillSwitch || (control?.globalKillSwitch ?? true) || !profile.stopLossRequired || profile.marginModePolicy !== 'ISOLATED_ONLY') {
    throw new ApiError(409, 'TESTNET canary risk profile must be enabled, isolated-only and stop-required.', 'AUTONOMOUS_TESTNET_RISK_GATE_CLOSED');
  }
  if (activeCanaries >= 15) throw new ApiError(409, 'The autonomous TESTNET fleet is limited to 15 active bots.', 'AUTONOMOUS_TESTNET_FLEET_LIMIT');
  if (activeSymbol >= 1) throw new ApiError(409, 'Only one TESTNET bot may own a symbol on the shared exchange account.', 'AUTONOMOUS_TESTNET_SYMBOL_IN_USE');
  if (paperPosition && !paperPosition.netQuantity.isZero()) throw new ApiError(409, 'Choose a bot with a flat PAPER position before TESTNET activation.', 'AUTONOMOUS_TESTNET_BOT_NOT_FLAT');
  return persistBotUpdate(userId, bot, { mode: 'DEMO', state: 'STARTING', desiredState: 'RUNNING', stateReason: 'Explicit admin Binance TESTNET canary activation; scheduler lease pending.' }, 'AI_TESTNET_CANARY_ACTIVATED', ipAddress, {
    note: input.note, confirmation: input.confirmation, environment: 'TESTNET', productionLive: false, maxActiveTestnetBots: 15,
  }, true);
}

const safeBotSelect = {
  id: true, exchangeAccountId: true, symbol: true, mode: true, state: true, desiredState: true, lifecycleStatus: true,
  intervalSeconds: true, configuration: true, startingPaperBalance: true, version: true, updatedAt: true,
} satisfies Prisma.TradingBotSelect;

async function ownedSafeBot(userId: string, id: string) {
  const bot = await prisma.tradingBot.findFirst({ where: { id, userId, type: 'AUTONOMOUS', mode: { in: ['PAPER', 'SHADOW'] } }, select: safeBotSelect });
  if (!bot) throw new ApiError(404, 'Safe autonomous bot not found.', 'AUTONOMOUS_BOT_NOT_FOUND');
  return bot;
}

async function updateRuntimeState(userId: string, id: string, allowed: TradingBotState[], state: TradingBotState, desiredState: 'PAUSED', action: string, ipAddress?: string) {
  const bot = await prisma.tradingBot.findFirst({ where: { id, userId, type: 'AUTONOMOUS', mode: { in: ['PAPER', 'SHADOW', 'DEMO'] } }, select: safeBotSelect });
  if (!bot) throw new ApiError(404, 'Autonomous bot not found.', 'AUTONOMOUS_BOT_NOT_FOUND');
  if (!allowed.includes(bot.state)) throw new ApiError(409, 'Autonomous bot runtime transition is invalid.', 'AUTONOMOUS_RUNTIME_TRANSITION_INVALID');
  return persistBotUpdate(userId, bot, { state, desiredState, stateReason: 'Admin requested autonomous runtime pause.' }, action, ipAddress);
}

async function persistBotUpdate(
  userId: string, bot: Prisma.TradingBotGetPayload<{ select: typeof safeBotSelect }>, data: Prisma.TradingBotUpdateInput,
  action: string, ipAddress?: string, metadata: Record<string, unknown> = {},
  testnetActivated = false,
) {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.tradingBot.updateMany({ where: { id: bot.id, userId, type: 'AUTONOMOUS', version: bot.version }, data: { ...data, version: { increment: 1 } } });
    if (changed.count !== 1) throw new ApiError(409, 'Bot changed concurrently; refresh and retry.', 'BOT_VERSION_CONFLICT');
    const updated = await tx.tradingBot.findUniqueOrThrow({ where: { id: bot.id }, select: safeBotSelect });
    await tx.tradingAuditLog.create({ data: {
      userId, exchangeAccountId: bot.exchangeAccountId, action, entityType: 'TRADING_BOT', entityId: bot.id,
      metadata: { ...metadata, from: { state: bot.state, mode: bot.mode, lifecycleStatus: bot.lifecycleStatus }, to: { state: updated.state, mode: updated.mode, lifecycleStatus: updated.lifecycleStatus }, liveActivated: false, testnetActivated },
      ...(ipAddress ? { ipAddress } : {}),
    } });
    return autonomousDTO('AUTONOMOUS_BOT', updated);
  });
}
