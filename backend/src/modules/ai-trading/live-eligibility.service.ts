import type { AutonomousTradingStatus, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { summarizeShadowPerformance } from './shadow-trading.service.js';
import type { LiveEligibilityConfig, RunLiveEligibilityInput } from './live-eligibility.schema.js';

export type LiveEligibilityEvidence = {
  botId: string;
  lifecycleStatus: AutonomousTradingStatus;
  mode: string;
  paperTrades: number;
  paperDurationDays: number;
  maxDrawdown: number;
  profitFactor: number | null;
  riskAdjustedScore: number | null;
  regimeCoverage: number;
  shadowDurationDays: number;
  shadowCloseTrades: number;
  shadowProfitFactor: number | null;
  shadowMaxDrawdown: number;
  criticalRiskViolations: number;
};

export function evaluateLiveEligibility(evidence: LiveEligibilityEvidence, config: LiveEligibilityConfig) {
  const failedGates: string[] = [];
  if (!['CHAMPION', 'LIVE_ELIGIBLE'].includes(evidence.lifecycleStatus)) failedGates.push('CHAMPION_REQUIRED');
  if (evidence.paperTrades < config.minPaperTrades) failedGates.push('MIN_PAPER_TRADES');
  if (evidence.paperDurationDays < config.minPaperDurationDays) failedGates.push('MIN_PAPER_DURATION');
  if (evidence.maxDrawdown > config.maxDrawdown) failedGates.push('MAX_DRAWDOWN');
  if (evidence.profitFactor === null || evidence.profitFactor < config.minProfitFactor) failedGates.push('MIN_PROFIT_FACTOR');
  if (evidence.riskAdjustedScore === null || evidence.riskAdjustedScore < config.minRiskAdjustedScore) failedGates.push('MIN_RISK_ADJUSTED_SCORE');
  if (evidence.regimeCoverage < config.minRegimeCoverage) failedGates.push('MIN_REGIME_COVERAGE');
  if (evidence.mode !== 'SHADOW') failedGates.push('SHADOW_MODE_REQUIRED');
  if (evidence.shadowDurationDays < config.minShadowDurationDays) failedGates.push('MIN_SHADOW_DURATION');
  if (evidence.shadowCloseTrades < config.minShadowCloseTrades) failedGates.push('MIN_SHADOW_CLOSE_TRADES');
  if (evidence.shadowProfitFactor === null || evidence.shadowProfitFactor < config.minShadowProfitFactor) failedGates.push('MIN_SHADOW_PROFIT_FACTOR');
  if (evidence.shadowMaxDrawdown > config.maxShadowDrawdown) failedGates.push('MAX_SHADOW_DRAWDOWN');
  if (evidence.criticalRiskViolations > 0) failedGates.push('RECENT_CRITICAL_RISK_VIOLATION');
  return {
    ...evidence, eligible: failedGates.length === 0, failedGates,
    targetStatus: failedGates.length === 0 ? 'LIVE_ELIGIBLE' as const : evidence.lifecycleStatus,
    liveActivated: false, orderSubmitted: false,
  };
}

export async function runLiveEligibility(userId: string, input: RunLiveEligibilityInput, ipAddress?: string) {
  const decisions = await collectLiveEligibilityEvidence(userId, input.config, input.botId);
  if (input.botId && decisions.length === 0) throw new ApiError(404, 'Champion bot not found.', 'CHAMPION_BOT_NOT_FOUND');
  const promoted: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (const decision of decisions) {
      if (!decision.eligible || decision.lifecycleStatus !== 'CHAMPION') continue;
      const changed = await tx.tradingBot.updateMany({
        where: { id: decision.botId, userId, type: 'AUTONOMOUS', lifecycleStatus: 'CHAMPION', mode: 'SHADOW' },
        data: { lifecycleStatus: 'LIVE_ELIGIBLE', version: { increment: 1 } },
      });
      if (changed.count !== 1) throw new ApiError(409, 'Bot lifecycle changed concurrently.', 'BOT_VERSION_CONFLICT');
      await tx.tradingAuditLog.create({ data: {
        userId, action: 'AI_BOT_LIVE_ELIGIBLE', entityType: 'TRADING_BOT', entityId: decision.botId,
        metadata: { from: 'CHAMPION', to: 'LIVE_ELIGIBLE', evidence: decision, config: input.config,
          liveActivated: false, orderSubmitted: false, adminLiveApprovalRequired: true } as unknown as Prisma.InputJsonObject,
        ...(ipAddress ? { ipAddress } : {}),
      } });
      promoted.push(decision.botId);
    }
  });
  return { config: input.config, evaluated: decisions.length, promoted, decisions, liveActivated: false, orderSubmitted: false };
}

export async function collectLiveEligibilityEvidence(userId: string, config: LiveEligibilityConfig, botId?: string) {
  const bots = await prisma.tradingBot.findMany({
    where: { userId, type: 'AUTONOMOUS', lifecycleStatus: { in: ['CHAMPION', 'LIVE_ELIGIBLE'] }, ...(botId ? { id: botId } : {}) },
    include: {
      paperTrades: {
        orderBy: [{ openedAt: 'asc' }, { id: 'asc' }],
        select: { realizedPnl: true, openedAt: true, closedAt: true, marketRegimeSnapshot: { select: { regime: true } } },
      },
      metrics: { orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }], take: 1 },
      shadowTrades: {
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }], take: 5_000,
        select: { action: true, fee: true, realizedPnl: true, cumulativePnl: true, totalFees: true, occurredAt: true },
      },
    },
    orderBy: { id: 'asc' },
  });
  const since = new Date(Date.now() - config.criticalRiskLookbackHours * 3_600_000);
  const decisions = await Promise.all(bots.map(async (bot) => {
    const metric = bot.metrics[0];
    const metrics = jsonObject(metric?.metrics ?? null);
    const closedPaper = bot.paperTrades.filter((trade) => trade.closedAt !== null);
    const paperFirst = bot.paperTrades[0]?.openedAt ?? null;
    const paperLast = bot.paperTrades.at(-1)?.closedAt ?? bot.paperTrades.at(-1)?.openedAt ?? null;
    const shadow = summarizeShadowPerformance(bot.shadowTrades.map((trade) => ({
      ...trade, fee: trade.fee.toNumber(), realizedPnl: trade.realizedPnl.toNumber(),
      cumulativePnl: trade.cumulativePnl.toNumber(), totalFees: trade.totalFees.toNumber(),
    })), bot.startingPaperBalance.toNumber());
    const [riskEvents, riskAudits] = await Promise.all([
      prisma.tradingRiskEvent.count({ where: {
        exchangeAccountId: bot.exchangeAccountId, occurredAt: { gte: since }, decision: { in: ['RISK_BLOCKED', 'SYSTEM_BLOCKED'] },
      } }),
      prisma.tradingAuditLog.count({ where: {
        entityType: 'TRADING_BOT', entityId: bot.id, createdAt: { gte: since }, action: 'AUTONOMOUS_RISK_BLOCKED',
      } }),
    ]);
    return evaluateLiveEligibility({
      botId: bot.id, lifecycleStatus: bot.lifecycleStatus, mode: bot.mode,
      paperTrades: closedPaper.length,
      paperDurationDays: paperFirst && paperLast ? Math.max(0, (paperLast.getTime() - paperFirst.getTime()) / 86_400_000) : 0,
      maxDrawdown: metric?.maxDrawdown.toNumber() ?? 1,
      profitFactor: jsonNumber(metrics, 'profitFactor'), riskAdjustedScore: metric?.score?.toNumber() ?? null,
      regimeCoverage: new Set(bot.paperTrades.map((trade) => trade.marketRegimeSnapshot?.regime).filter(Boolean)).size,
      shadowDurationDays: shadow.shadowDurationDays, shadowCloseTrades: shadow.wouldClose,
      shadowProfitFactor: shadow.profitFactor, shadowMaxDrawdown: shadow.maxDrawdown,
      criticalRiskViolations: riskEvents + riskAudits,
    }, config);
  }));
  return decisions;
}

function jsonObject(value: Prisma.JsonValue | null) {
  return value !== null && !Array.isArray(value) && typeof value === 'object' ? value as Prisma.JsonObject : {};
}
function jsonNumber(value: Prisma.JsonObject, key: string) {
  const result = value[key];
  return typeof result === 'number' && Number.isFinite(result) ? result : null;
}
