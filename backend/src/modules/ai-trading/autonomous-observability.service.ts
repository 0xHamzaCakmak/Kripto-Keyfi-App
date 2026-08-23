import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { AutonomousAuditQuery } from './autonomous-observability.schema.js';

const WINDOW_MINUTES = 5;
const DAY_MS = 86_400_000;

type DecimalRow = { value: Prisma.Decimal | null };

export type AutonomousHealthMetrics = {
  activeBots: number;
  arena: { decisionsLast5m: number; throughputPerMinute: number };
  marketData: { latestObservedAt: Date | null; lagMs: number | null; source: 'REGIME_SNAPSHOT' | 'AUTONOMOUS_DECISION' | 'NONE' };
  strategyExecution: { averagePersistenceLatencyMs: number | null };
  paperOrders: { total: number; last24h: number };
  riskRejectsLast24h: number;
  exchangeErrorsLast24h: number;
  aiProviderErrorsLast24h: number;
  generations: Record<string, number>;
  teacherRunsLast24h: number;
  researcherRunsLast24h: number;
  memory: { decisionsTotal: number; decisionsLast24h: number; paperTradesTotal: number; growthLast24h: number };
  pnlCalculationErrors: number;
  emergencyStop: boolean;
};

export async function getAutonomousSystemHealth(userId: string, now = new Date()) {
  const fiveMinutesAgo = new Date(now.getTime() - WINDOW_MINUTES * 60_000);
  const dayAgo = new Date(now.getTime() - DAY_MS);
  const autonomousBot = { userId, type: 'AUTONOMOUS' as const };
  const [
    activeBots, decisionsLast5m, latestMarket, latestDecision, latencyRows, paperTradesTotal, paperTradesLast24h,
    riskRejectsLast24h, exchangeErrorsLast24h, aiProviderErrorsLast24h, generations,
    teacherRunsLast24h, researcherRunsLast24h, decisionsTotal, decisionsLast24h, pnlCalculationErrors, riskControl,
  ] = await Promise.all([
    prisma.tradingBot.count({ where: { ...autonomousBot, state: 'RUNNING', desiredState: 'RUNNING' } }),
    prisma.tradingBotDecision.count({ where: { userId, occurredAt: { gte: fiveMinutesAgo } } }),
    prisma.marketRegimeSnapshot.findFirst({ orderBy: [{ observedAt: 'desc' }, { id: 'desc' }], select: { observedAt: true } }),
    prisma.tradingBotDecision.findFirst({
      where: { userId, type: 'AUTONOMOUS' }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], select: { occurredAt: true },
    }),
    prisma.$queryRaw<DecimalRow[]>(Prisma.sql`SELECT AVG(CAST(JSON_UNQUOTE(JSON_EXTRACT(metrics, '$.strategyExecutionLatencyMs')) AS DECIMAL(20,6))) AS value
      FROM trading_bot_decisions WHERE userId = ${userId} AND occurredAt >= ${fiveMinutesAgo}`),
    prisma.paperTrade.count({ where: { tradingBot: autonomousBot } }),
    prisma.paperTrade.count({ where: { tradingBot: autonomousBot, openedAt: { gte: dayAgo } } }),
    prisma.tradingRiskEvent.count({ where: { userId, decision: { in: ['REJECTED', 'RISK_BLOCKED', 'SYSTEM_BLOCKED'] }, occurredAt: { gte: dayAgo } } }),
    prisma.tradingOrder.count({ where: { userId, status: { in: ['FAILED', 'RECONCILIATION_REQUIRED'] }, createdAt: { gte: dayAgo } } }),
    prisma.tradingAuditLog.count({ where: {
      userId, action: { in: ['AI_TEACHER_EVALUATED', 'AI_RESEARCH_HYPOTHESIS_CREATED'] }, createdAt: { gte: dayAgo },
      metadata: { path: '$.analysisAdapter.fallbackUsed', equals: true },
    } }),
    prisma.generation.groupBy({ by: ['status'], where: { createdById: userId }, _count: { _all: true } }),
    prisma.tradingAuditLog.count({ where: { userId, action: 'AI_TEACHER_RUN_COMPLETED', createdAt: { gte: dayAgo } } }),
    prisma.tradingAuditLog.count({ where: { userId, action: 'AI_RESEARCH_RUN_COMPLETED', createdAt: { gte: dayAgo } } }),
    prisma.tradingBotDecision.count({ where: { userId } }),
    prisma.tradingBotDecision.count({ where: { userId, occurredAt: { gte: dayAgo } } }),
    prisma.tradingBot.count({ where: { ...autonomousBot, lastErrorCode: { startsWith: 'PNL_' } } }),
    prisma.tradingRiskControl.findUnique({ where: { id: 'global' }, select: { globalKillSwitch: true } }),
  ]);
  const marketData = resolveAutonomousMarketDataEvidence(now, latestMarket?.observedAt ?? null, latestDecision?.occurredAt ?? null);
  const metrics: AutonomousHealthMetrics = {
    activeBots,
    arena: { decisionsLast5m, throughputPerMinute: decisionsLast5m / WINDOW_MINUTES },
    marketData,
    strategyExecution: { averagePersistenceLatencyMs: latencyRows[0]?.value?.toNumber() ?? null },
    paperOrders: { total: paperTradesTotal, last24h: paperTradesLast24h },
    riskRejectsLast24h, exchangeErrorsLast24h, aiProviderErrorsLast24h,
    generations: Object.fromEntries(generations.map((item) => [item.status, item._count._all])),
    teacherRunsLast24h, researcherRunsLast24h,
    memory: { decisionsTotal, decisionsLast24h, paperTradesTotal, growthLast24h: decisionsLast24h + paperTradesLast24h },
    pnlCalculationErrors,
    emergencyStop: riskControl?.globalKillSwitch ?? true,
  };
  return { status: assessAutonomousHealth(metrics), checkedAt: now, windowMinutes: WINDOW_MINUTES, metrics };
}

export function resolveAutonomousMarketDataEvidence(now: Date, regimeObservedAt: Date | null, decisionOccurredAt: Date | null): AutonomousHealthMetrics['marketData'] {
  const regimeTime = regimeObservedAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  const decisionTime = decisionOccurredAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  const latestObservedAt = regimeTime >= decisionTime ? regimeObservedAt : decisionOccurredAt;
  const source = latestObservedAt === null ? 'NONE' : regimeTime >= decisionTime ? 'REGIME_SNAPSHOT' : 'AUTONOMOUS_DECISION';
  return { latestObservedAt, lagMs: latestObservedAt ? Math.max(0, now.getTime() - latestObservedAt.getTime()) : null, source };
}

export function assessAutonomousHealth(metrics: AutonomousHealthMetrics): 'HEALTHY' | 'DEGRADED' | 'EMERGENCY_STOPPED' {
  if (metrics.emergencyStop) return 'EMERGENCY_STOPPED';
  if (metrics.marketData.lagMs === null || metrics.marketData.lagMs > 5 * 60_000
    || metrics.exchangeErrorsLast24h > 0 || metrics.aiProviderErrorsLast24h > 0
    || metrics.pnlCalculationErrors > 0 || (metrics.generations.FAILED ?? 0) > 0) return 'DEGRADED';
  return 'HEALTHY';
}

export async function listAutonomousAudit(userId: string, query: AutonomousAuditQuery) {
  return prisma.tradingAuditLog.findMany({
    where: { userId, action: { startsWith: 'AI_' } },
    select: { id: true, action: true, entityType: true, entityId: true, metadata: true, createdAt: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.limit,
  });
}
