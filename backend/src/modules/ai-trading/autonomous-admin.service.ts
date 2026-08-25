import { Prisma, type TradingBotState } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { env } from '../../config/env.js';
import type { BotCapitalInput, ClosePaperPositionInput, NonCriticalBotSettingsInput, PaperFleetActivationInput, PromotionReviewInput, ResetPaperAccountingInput, TestnetActivationInput, TestnetFleetActivationInput, TriggerPaperGenerationInput } from './autonomous-admin.schema.js';
import { collectLiveEligibilityEvidence } from './live-eligibility.service.js';
import { DEFAULT_LIVE_ELIGIBILITY_CONFIG } from './live-eligibility.schema.js';
import { assessEvolutionReadiness, evolutionConfigForPopulation } from './evolution.service.js';
import { getBinanceFuturesPublicSymbols } from '../trading/exchanges/binance-futures.adapter.js';
import { getEnabledTradingSymbols } from './trading-universe.service.js';
import { getTradingEngineSnapshot } from '../trading/trading-engine.client.js';
import { fleetLeverage, PAPER_TRAINING_INTERVAL_SECONDS, paperTrainingConfiguration, testnetExecutionConfiguration } from './universe.worker.js';

export const AUTONOMOUS_ADMIN_API_VERSION = 'v1' as const;

export function autonomousDTO<T>(kind: string, data: T) {
  return { apiVersion: AUTONOMOUS_ADMIN_API_VERSION, kind, data, liveTradingEnabled: false as const };
}

export async function getAutonomousOverview(userId: string) {
  const [bots, strategies, generations, paperTrades, champions, liveEligible, globalRisk] = await Promise.all([
    prisma.tradingBot.count({ where: { userId, type: 'AUTONOMOUS', lifecycleStatus: { not: 'ARCHIVED' } } }),
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
    prisma.tradingBot.groupBy({ by: ['state'], where: { userId, type: 'AUTONOMOUS', lifecycleStatus: { not: 'ARCHIVED' } }, _count: { _all: true } }),
    prisma.tradingBot.groupBy({ by: ['mode'], where: { userId, type: 'AUTONOMOUS', lifecycleStatus: { not: 'ARCHIVED' } }, _count: { _all: true } }),
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

export async function getPaperAccountingStatus(userId: string) {
  const [active, periods] = await Promise.all([
    prisma.paperAccountingPeriod.findFirst({ where: { userId, status: 'ACTIVE' }, orderBy: { startedAt: 'desc' } }),
    prisma.paperAccountingPeriod.findMany({ where: { userId }, orderBy: { number: 'desc' }, take: 20 }),
  ]);
  const fallbackBots = active ? [] : await activePaperBotIds(prisma, userId);
  const botIds = active ? jsonStringArray(active.botIds) : fallbackBots;
  const current = await paperFinancialSnapshot(prisma, botIds);
  return autonomousDTO('PAPER_ACCOUNTING', {
    active: active ? paperPeriodResult(active, current) : null,
    currentWithoutPeriod: active ? null : serializePaperSnapshot(current),
    periods: periods.map((period) => ({ id: period.id, number: period.number, status: period.status, botCount: period.botCount,
      note: period.note, startedAt: period.startedAt, closedAt: period.closedAt })),
    tradeHistoryPreserved: true,
  });
}

export async function resetPaperAccounting(userId: string, input: ResetPaperAccountingInput, ipAddress?: string) {
  return prisma.$transaction(async (tx) => {
    const botIds = await activePaperBotIds(tx, userId);
    if (botIds.length === 0) throw new ApiError(409, 'Yeni PAPER dönemi için çalışan PAPER botu bulunamadı.', 'PAPER_ACCOUNTING_NO_ACTIVE_BOTS');
    const snapshot = await paperFinancialSnapshot(tx, botIds);
    const now = new Date();
    await tx.paperAccountingPeriod.updateMany({ where: { userId, status: 'ACTIVE' }, data: { status: 'CLOSED', closedAt: now } });
    const maximum = await tx.paperAccountingPeriod.aggregate({ where: { userId }, _max: { number: true } });
    const period = await tx.paperAccountingPeriod.create({ data: {
      userId, number: (maximum._max.number ?? 0) + 1, status: 'ACTIVE',
      baselineStartingCapital: snapshot.startingCapital, baselineRealizedPnl: snapshot.realizedPnl,
      baselineUnrealizedPnl: snapshot.unrealizedPnl, baselineFees: snapshot.fees,
      botIds, botCount: botIds.length, note: input.note, startedAt: now,
    } });
    await tx.tradingAuditLog.create({ data: {
      userId, action: 'AI_PAPER_ACCOUNTING_PERIOD_RESET', entityType: 'PAPER_ACCOUNTING_PERIOD', entityId: period.id,
      metadata: { periodNumber: period.number, botCount: botIds.length, confirmation: input.confirmation,
        tradeHistoryPreserved: true, positionsPreserved: true, ordersCanceled: false, productionLive: false },
      ...(ipAddress ? { ipAddress } : {}),
    } });
    return autonomousDTO('PAPER_ACCOUNTING_RESET', paperPeriodResult(period, snapshot));
  });
}

type PaperSnapshot = { startingCapital: Prisma.Decimal; realizedPnl: Prisma.Decimal; unrealizedPnl: Prisma.Decimal; fees: Prisma.Decimal; netPnl: Prisma.Decimal };
type PaperClient = Pick<Prisma.TransactionClient, 'tradingBot' | 'tradingBotPaperPosition'>;

async function activePaperBotIds(client: PaperClient, userId: string) {
  const bots = await client.tradingBot.findMany({
    where: { userId, type: 'AUTONOMOUS', mode: 'PAPER', desiredState: 'RUNNING', lifecycleStatus: { not: 'ARCHIVED' } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true },
  });
  return bots.map((bot) => bot.id);
}

async function paperFinancialSnapshot(client: PaperClient, botIds: string[]): Promise<PaperSnapshot> {
  if (botIds.length === 0) {
    const zero = new Prisma.Decimal(0);
    return { startingCapital: zero, realizedPnl: zero, unrealizedPnl: zero, fees: zero, netPnl: zero };
  }
  const [capital, ledger] = await Promise.all([
    client.tradingBot.aggregate({ where: { id: { in: botIds } }, _sum: { startingPaperBalance: true } }),
    client.tradingBotPaperPosition.aggregate({ where: { tradingBotId: { in: botIds } },
      _sum: { realizedPnl: true, unrealizedPnl: true, totalFees: true } }),
  ]);
  const startingCapital = capital._sum.startingPaperBalance ?? new Prisma.Decimal(0);
  const realizedPnl = ledger._sum.realizedPnl ?? new Prisma.Decimal(0);
  const unrealizedPnl = ledger._sum.unrealizedPnl ?? new Prisma.Decimal(0);
  const fees = ledger._sum.totalFees ?? new Prisma.Decimal(0);
  return { startingCapital, realizedPnl, unrealizedPnl, fees, netPnl: realizedPnl.add(unrealizedPnl).sub(fees) };
}

function paperPeriodResult(period: { id: string; number: number; status: string; botCount: number; note: string | null; startedAt: Date; closedAt: Date | null;
  baselineStartingCapital: Prisma.Decimal; baselineRealizedPnl: Prisma.Decimal; baselineUnrealizedPnl: Prisma.Decimal; baselineFees: Prisma.Decimal }, current: PaperSnapshot) {
  const baselineNetPnl = period.baselineRealizedPnl.add(period.baselineUnrealizedPnl).sub(period.baselineFees);
  const periodNetPnl = current.netPnl.sub(baselineNetPnl);
  return { id: period.id, number: period.number, status: period.status, botCount: period.botCount, note: period.note,
    startedAt: period.startedAt, closedAt: period.closedAt, startingCapital: current.startingCapital.toString(),
    periodNetPnl: periodNetPnl.toString(), periodEquity: current.startingCapital.add(periodNetPnl).toString(),
    current: serializePaperSnapshot(current), baseline: {
      startingCapital: period.baselineStartingCapital.toString(), realizedPnl: period.baselineRealizedPnl.toString(),
      unrealizedPnl: period.baselineUnrealizedPnl.toString(), fees: period.baselineFees.toString(), netPnl: baselineNetPnl.toString(),
    }, tradeHistoryPreserved: true };
}

function serializePaperSnapshot(value: PaperSnapshot) {
  return { startingCapital: value.startingCapital.toString(), realizedPnl: value.realizedPnl.toString(),
    unrealizedPnl: value.unrealizedPnl.toString(), fees: value.fees.toString(), netPnl: value.netPnl.toString() };
}

function jsonStringArray(value: Prisma.JsonValue): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export async function listGenerations(userId: string, limit: number) {
  const rows = await prisma.generation.findMany({
    where: { createdById: userId }, orderBy: [{ number: 'desc' }, { createdAt: 'desc' }], take: limit,
    include: {
      _count: { select: { bots: true, mutations: true, crossovers: true } },
      bots: { where: { type: 'AUTONOMOUS', mode: 'PAPER', lifecycleStatus: { not: 'ARCHIVED' } }, select: {
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
      // Archived bots remain linked to the generation so their trades, PnL and
      // lineage history are preserved.  Runtime/UI population must only count
      // active PAPER bots, otherwise a drained fleet still appears as 100.
      metadata: row.metadata, counts: { ...row._count, bots: evidence.length },
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

export async function requestPaperPositionClose(userId: string, id: string, input: ClosePaperPositionInput, ipAddress?: string) {
  return prisma.$transaction(async (tx) => {
    const bot = await tx.tradingBot.findFirst({
      where: { id, userId, type: 'AUTONOMOUS', mode: 'PAPER', lifecycleStatus: { not: 'ARCHIVED' } },
      select: safeBotSelect,
    });
    if (!bot) throw new ApiError(404, 'Active PAPER bot not found.', 'AUTONOMOUS_BOT_NOT_FOUND');
    const openTrade = await tx.paperTrade.findFirst({ where: { tradingBotId: id, status: 'OPEN' }, select: { id: true, symbol: true } });
    if (!openTrade) throw new ApiError(409, 'Bot has no open PAPER position.', 'PAPER_POSITION_NOT_OPEN');
    const configuration = bot.configuration && !Array.isArray(bot.configuration) && typeof bot.configuration === 'object'
      ? { ...(bot.configuration as Prisma.JsonObject) }
      : {};
    configuration.paperManualCloseRequested = true;
    configuration.paperManualCloseStopBot = input.stopBot;
    configuration.paperManualCloseRequestedAt = new Date().toISOString();
    const changed = await tx.tradingBot.updateMany({
      where: { id, userId, type: 'AUTONOMOUS', version: bot.version },
      data: {
        configuration: configuration as Prisma.InputJsonValue,
        // A paused/stopped bot must briefly return to the scheduler so the
        // position is closed through the canonical PAPER fill/PnL lifecycle.
        ...(!['STARTING', 'RUNNING', 'RECONCILING', 'RISK_BLOCKED'].includes(bot.state)
          ? { state: 'STARTING' as const, desiredState: 'RUNNING' as const, stateReason: 'Admin PAPER close requested; scheduler close pending.' }
          : {}),
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new ApiError(409, 'Bot changed concurrently; refresh and retry.', 'BOT_VERSION_CONFLICT');
    await tx.tradingAuditLog.create({ data: {
      userId, exchangeAccountId: bot.exchangeAccountId, action: 'AI_PAPER_POSITION_CLOSE_REQUESTED', entityType: 'PAPER_TRADE', entityId: openTrade.id,
      metadata: { botId: id, symbol: openTrade.symbol, stopBot: input.stopBot, note: input.note ?? null, productionLive: false, historyDeleted: false },
      ...(ipAddress ? { ipAddress } : {}),
    } });
    return autonomousDTO('PAPER_POSITION_CLOSE_REQUEST', { botId: id, tradeId: openTrade.id, symbol: openTrade.symbol, stopBot: input.stopBot, status: 'QUEUED' });
  });
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
    prisma.tradingRiskProfile.findUnique({ where: { exchangeAccountId: bot.exchangeAccountId }, select: { enabled: true, accountKillSwitch: true, marginModePolicy: true, stopLossRequired: true, minLeverage: true, maxLeverage: true, testnetBotAllocationUsdt: true, testnetMinInitialMarginUsdt: true } }),
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
  if (activeCanaries >= env.AI_TRADING_FIXED_FLEET_SIZE) throw new ApiError(409, `The autonomous TESTNET fleet is limited to ${env.AI_TRADING_FIXED_FLEET_SIZE} active bots.`, 'AUTONOMOUS_TESTNET_FLEET_LIMIT');
  if (activeSymbol >= 1) throw new ApiError(409, 'Only one TESTNET bot may own a symbol on the shared exchange account.', 'AUTONOMOUS_TESTNET_SYMBOL_IN_USE');
  if (paperPosition && !paperPosition.netQuantity.isZero()) throw new ApiError(409, 'Choose a bot with a flat PAPER position before TESTNET activation.', 'AUTONOMOUS_TESTNET_BOT_NOT_FLAT');
  const leverage = Math.max(profile.minLeverage, Math.min(profile.maxLeverage, Math.round(Number((bot.configuration as Prisma.JsonObject | null)?.leverage) || profile.minLeverage)));
  return persistBotUpdate(userId, bot, { mode: 'DEMO', timeframe: '15m', intervalSeconds: PAPER_TRAINING_INTERVAL_SECONDS, configuration: testnetExecutionConfiguration(bot.configuration, leverage, { allocationUsdt: profile.testnetBotAllocationUsdt.toNumber(), minimumInitialMarginUsdt: profile.testnetMinInitialMarginUsdt.toNumber(), leverageMin: profile.minLeverage, leverageMax: profile.maxLeverage }), startingPaperBalance: profile.testnetBotAllocationUsdt, state: 'STARTING', desiredState: 'RUNNING', stateReason: 'Explicit admin Binance TESTNET canary activation; scheduler lease pending.' }, 'AI_TESTNET_CANARY_ACTIVATED', ipAddress, {
    note: input.note, confirmation: input.confirmation, environment: 'TESTNET', productionLive: false, maxActiveTestnetBots: env.AI_TRADING_FIXED_FLEET_SIZE,
  }, true);
}

export async function activateAutonomousTestnetFleet(userId: string, input: TestnetFleetActivationInput, ipAddress?: string) {
  if (!env.AUTONOMOUS_TESTNET_EXECUTION_ENABLED) throw new ApiError(409, 'Autonomous TESTNET execution feature flag is disabled.', 'AUTONOMOUS_TESTNET_DISABLED');
  const bots = await prisma.tradingBot.findMany({
    where: { userId, type: 'AUTONOMOUS', lifecycleStatus: { not: 'ARCHIVED' }, mode: { in: ['PAPER', 'DEMO'] } },
    select: { ...safeBotSelect, name: true, paperPosition: { select: { netQuantity: true } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (bots.length !== env.AI_TRADING_FIXED_FLEET_SIZE) {
    throw new ApiError(409, `Bulk TESTNET activation requires exactly ${env.AI_TRADING_FIXED_FLEET_SIZE} active autonomous bots; found ${bots.length}.`, 'AUTONOMOUS_FIXED_FLEET_MISMATCH');
  }
  const accountIds = [...new Set(bots.map((bot) => bot.exchangeAccountId))];
  if (accountIds.length !== 1) throw new ApiError(409, 'All fleet bots must use the same Binance TESTNET account.', 'AUTONOMOUS_TESTNET_ACCOUNT_MISMATCH');
  const exchangeAccountId = accountIds[0]!;
  const [account, profile, control, configuredSymbols, exchangeSymbols] = await Promise.all([
    prisma.exchangeAccount.findFirst({ where: { id: exchangeAccountId, userId }, select: { provider: true, environment: true, executionEngine: true, connectionStatus: true, isActive: true } }),
    prisma.tradingRiskProfile.findUnique({ where: { exchangeAccountId }, select: { id: true, enabled: true, accountKillSwitch: true, marginModePolicy: true, stopLossRequired: true, minLeverage: true, maxLeverage: true, maxOrderNotional: true, maxInitialMargin: true, maxAccountOpenNotional: true, maxSymbolOpenNotional: true, testnetBotAllocationUsdt: true, testnetMinInitialMarginUsdt: true } }),
    prisma.tradingRiskControl.findUnique({ where: { id: 'global' }, select: { globalKillSwitch: true } }),
    getEnabledTradingSymbols(userId),
    getBinanceFuturesPublicSymbols(),
  ]);
  if (!account || account.provider !== 'BINANCE' || account.environment !== 'TESTNET' || account.executionEngine !== 'GO' || account.connectionStatus !== 'CONNECTED' || !account.isActive) {
    throw new ApiError(409, 'Fleet requires a connected Binance TESTNET USD-M account owned by the Go executor.', 'AUTONOMOUS_TESTNET_ACCOUNT_NOT_READY');
  }
  if (!profile?.enabled || profile.accountKillSwitch || (control?.globalKillSwitch ?? true) || !profile.stopLossRequired || profile.marginModePolicy !== 'ISOLATED_ONLY') {
    throw new ApiError(409, 'TESTNET fleet risk profile must be enabled, isolated-only and stop-required.', 'AUTONOMOUS_TESTNET_RISK_GATE_CLOSED');
  }
  const nonFlatPaper = bots.filter((bot) => bot.mode === 'PAPER' && bot.paperPosition && !bot.paperPosition.netQuantity.isZero());
  if (nonFlatPaper.length > 0) throw new ApiError(409, `${nonFlatPaper.length} PAPER bot still has an open position. Close it before TESTNET fleet activation.`, 'AUTONOMOUS_TESTNET_FLEET_NOT_FLAT');
  const available = new Set(exchangeSymbols.filter((item) => item.status === 'TRADING' && item.quoteAsset === 'USDT').map((item) => item.symbol));
  const validUniverse = configuredSymbols.filter((symbol) => available.has(symbol));
  const existingDemoSymbols = new Set(bots.filter((bot) => bot.mode === 'DEMO').map((bot) => bot.symbol));
  const assignable = validUniverse.filter((symbol) => !existingDemoSymbols.has(symbol));
  const paperBots = bots.filter((bot) => bot.mode === 'PAPER');
  if (new Set(validUniverse).size < bots.length || assignable.length < paperBots.length) {
    throw new ApiError(409, `At least ${bots.length} different enabled Binance Futures symbols are required for this shared TESTNET fleet.`, 'AUTONOMOUS_TESTNET_UNIVERSE_TOO_SMALL');
  }
  const assignments = new Map(paperBots.map((bot, index) => [bot.id, assignable[index]!]));
  const allocations = bots.map(() => profile.testnetBotAllocationUsdt.toNumber());
  const fleetAllocation = allocations.reduce((sum, value) => sum + value, 0);
  const maximumBotAllocation = Math.max(...allocations);
  const leveragedAllocations = bots.map((_, index) => allocations[index]! * fleetLeverage(index, bots.length));
  const fleetNotionalCapacity = leveragedAllocations.reduce((sum, value) => sum + value, 0);
  const maximumBotNotional = Math.max(...leveragedAllocations);
  const result = await prisma.$transaction(async (tx) => {
    await tx.tradingRiskProfile.update({ where: { id: profile.id }, data: {
      // This account is verified above as Binance TESTNET. PAPER uses its
      // separate paperMaxOpenPositions field; no mainnet profile is changed.
      maxOpenPositions: env.AI_TRADING_FIXED_FLEET_SIZE,
      maxOrderNotional: Math.max(profile.maxOrderNotional.toNumber(), maximumBotNotional).toFixed(2),
      maxInitialMargin: Math.max(profile.maxInitialMargin.toNumber(), maximumBotAllocation).toFixed(2),
      maxAccountOpenNotional: Math.max(profile.maxAccountOpenNotional.toNumber(), fleetNotionalCapacity).toFixed(2),
      maxSymbolOpenNotional: Math.max(profile.maxSymbolOpenNotional.toNumber(), maximumBotNotional).toFixed(2),
      allowedSymbols: bots.map((bot) => assignments.get(bot.id) ?? bot.symbol),
    } });
    for (let index = 0; index < bots.length; index += 1) {
      const bot = bots[index]!;
      const target = assignments.get(bot.id) ?? bot.symbol;
      const changed = await tx.tradingBot.updateMany({
        where: { id: bot.id, userId, type: 'AUTONOMOUS', version: bot.version },
        data: {
          mode: 'DEMO', symbol: target, symbols: [target], timeframe: '15m', intervalSeconds: PAPER_TRAINING_INTERVAL_SECONDS, configuration: testnetExecutionConfiguration(bot.configuration, fleetLeverage(index, bots.length, profile.minLeverage, profile.maxLeverage), { allocationUsdt: allocations[index]!, minimumInitialMarginUsdt: profile.testnetMinInitialMarginUsdt.toNumber(), leverageMin: profile.minLeverage, leverageMax: profile.maxLeverage }), startingPaperBalance: allocations[index]!, state: 'STARTING', desiredState: 'RUNNING',
          schedulerOwner: null, leaseExpiresAt: null, heartbeatAt: null,
          stateReason: 'Explicit admin bulk Binance TESTNET activation; scheduler lease pending.', version: { increment: 1 },
        },
      });
      if (changed.count !== 1) throw new ApiError(409, 'Fleet changed concurrently; refresh and retry.', 'BOT_VERSION_CONFLICT');
    }
    await tx.tradingAuditLog.create({ data: {
      userId, exchangeAccountId, action: 'AI_TESTNET_FLEET_ACTIVATED', entityType: 'AUTONOMOUS_FLEET', entityId: exchangeAccountId,
      metadata: { note: input.note, confirmation: input.confirmation, botCount: bots.length, symbols: bots.map((bot) => assignments.get(bot.id) ?? bot.symbol), fleetAllocationUsdt: fleetAllocation, minimumInitialMarginUsdt: profile.testnetMinInitialMarginUsdt.toString(), fleetNotionalCapacity, maxOpenPositions: env.AI_TRADING_FIXED_FLEET_SIZE, environment: 'TESTNET', executionEngine: 'GO', productionLive: false, liveChanged: false, riskEngineBypassed: false },
      ...(ipAddress ? { ipAddress } : {}),
    } });
    return bots.map((bot) => ({ botId: bot.id, name: bot.name, symbol: assignments.get(bot.id) ?? bot.symbol, mode: 'DEMO' as const, desiredState: 'RUNNING' as const }));
  });
  return autonomousDTO('TESTNET_FLEET_ACTIVATION', { botCount: result.length, bots: result, environment: 'TESTNET', productionLive: false });
}

export async function activateAutonomousPaperFleet(userId: string, input: PaperFleetActivationInput, ipAddress?: string) {
  const bots = await prisma.tradingBot.findMany({
    where: { userId, type: 'AUTONOMOUS', lifecycleStatus: { not: 'ARCHIVED' }, mode: { in: ['PAPER', 'DEMO'] } },
    select: safeBotSelect, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (bots.length !== env.AI_TRADING_FIXED_FLEET_SIZE) throw new ApiError(409, `PAPER fleet requires exactly ${env.AI_TRADING_FIXED_FLEET_SIZE} active autonomous bots.`, 'AUTONOMOUS_FIXED_FLEET_MISMATCH');
  const demoBots = bots.filter((bot) => bot.mode === 'DEMO');
  if (demoBots.length > 0) {
    const accountIds = [...new Set(demoBots.map((bot) => bot.exchangeAccountId))];
    if (accountIds.length !== 1) throw new ApiError(409, 'TESTNET fleet account mismatch.', 'AUTONOMOUS_TESTNET_ACCOUNT_MISMATCH');
    const account = await prisma.exchangeAccount.findFirst({ where: { id: accountIds[0]!, userId, provider: 'BINANCE', environment: 'TESTNET', executionEngine: 'GO', isActive: true } });
    if (!account) throw new ApiError(409, 'Connected Binance TESTNET account is required for flat-position verification.', 'AUTONOMOUS_TESTNET_ACCOUNT_NOT_READY');
    const snapshot = await getTradingEngineSnapshot(account);
    const demoSymbols = new Set(demoBots.map((bot) => bot.symbol));
    const exposure = snapshot.positions.filter((position) => demoSymbols.has(position.symbol) && Number(position.quantity) !== 0);
    const workingOrders = snapshot.orders.filter((order) => demoSymbols.has(order.symbol));
    if (exposure.length > 0 || workingOrders.length > 0) {
      throw new ApiError(409, `PAPER mode is blocked until Binance TESTNET is flat and has no working fleet orders (${exposure.length} positions, ${workingOrders.length} orders).`, 'AUTONOMOUS_TESTNET_NOT_FLAT');
    }
  }
  const result = await prisma.$transaction(async (tx) => {
    for (let index = 0; index < bots.length; index += 1) {
      const bot = bots[index]!;
      const changed = await tx.tradingBot.updateMany({ where: { id: bot.id, userId, version: bot.version }, data: {
        mode: 'PAPER', intervalSeconds: PAPER_TRAINING_INTERVAL_SECONDS, configuration: paperTrainingConfiguration(bot.configuration, fleetLeverage(index, bots.length)), state: 'STARTING', desiredState: 'RUNNING', schedulerOwner: null, leaseExpiresAt: null, heartbeatAt: null,
        stateReason: 'Explicit admin fixed PAPER fleet start; scheduler lease pending.', version: { increment: 1 },
      } });
      if (changed.count !== 1) throw new ApiError(409, 'Fleet changed concurrently; refresh and retry.', 'BOT_VERSION_CONFLICT');
    }
    await tx.tradingAuditLog.create({ data: {
      userId, action: 'AI_PAPER_FLEET_ACTIVATED', entityType: 'AUTONOMOUS_FLEET',
      metadata: { note: input.note, confirmation: input.confirmation, botCount: bots.length, mode: 'PAPER', submittedToExchange: false, productionLive: false, riskEngineBypassed: false },
      ...(ipAddress ? { ipAddress } : {}),
    } });
    return bots.length;
  });
  return autonomousDTO('PAPER_FLEET_ACTIVATION', { botCount: result, mode: 'PAPER', submittedToExchange: false, productionLive: false });
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
