import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import type { RunTeacherInput, TeacherEvaluationsQuery } from './teacher.schema.js';

export type TeacherEvidence = {
  targetType: 'BOT' | 'STRATEGY';
  tradingBotId?: string;
  strategyId?: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  profitFactor: number | null;
  totalPnl: number;
  maxDrawdown: number | null;
  averageHoldingSeconds: number | null;
  score: number | null;
  regimes: Array<{ regime: string; trades: number; totalPnl: number }>;
};

export type TeacherRecommendation = {
  targetType: TeacherEvidence['targetType'];
  tradingBotId?: string;
  strategyId?: string;
  observation: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  metricEvidence: Record<string, unknown>;
  recommendedAction: { type: string; rationale: string; applyAutomatically: false };
};

export interface TeacherAnalysisProvider {
  readonly name: string;
  evaluate(evidence: TeacherEvidence): Promise<TeacherRecommendation[]>;
}

export class RuleBasedTeacherProvider implements TeacherAnalysisProvider {
  readonly name = 'RULE_BASED';

  async evaluate(evidence: TeacherEvidence) {
    return evaluateRules(evidence);
  }
}

export function evaluateRules(evidence: TeacherEvidence): TeacherRecommendation[] {
  const recommendations: TeacherRecommendation[] = [];
  const add = (
    observation: string, severity: TeacherRecommendation['severity'], confidence: number,
    type: string, rationale: string, metricEvidence: Record<string, unknown>,
  ) => recommendations.push({
    targetType: evidence.targetType,
    ...(evidence.tradingBotId ? { tradingBotId: evidence.tradingBotId } : {}),
    ...(evidence.strategyId ? { strategyId: evidence.strategyId } : {}),
    observation, severity, confidence, metricEvidence,
    recommendedAction: { type, rationale, applyAutomatically: false },
  });

  if (evidence.totalTrades < 50) {
    add('Insufficient sample size for a reliable performance conclusion.', 'LOW', 0.98,
      'COLLECT_MORE_EVIDENCE', 'Keep the target in PAPER/SHADOW while gathering more trades.', { totalTrades: evidence.totalTrades, minimumTrades: 50 });
  }
  if (evidence.maxDrawdown !== null && evidence.maxDrawdown >= 0.2) {
    add('Drawdown deterioration exceeds the Teacher review threshold.', 'HIGH', 0.92,
      'REDUCE_POSITION_FACTOR', 'Review a lower position factor in a new candidate version; do not alter risk limits.', { maxDrawdown: evidence.maxDrawdown, threshold: 0.2 });
  }
  if (evidence.totalTrades >= 50 && evidence.profitFactor !== null && evidence.profitFactor < 1) {
    add('Losses outweigh gains at the current decision threshold.', 'MEDIUM', 0.85,
      'INCREASE_CONFIDENCE_THRESHOLD', 'Test a stricter confidence threshold as a separate candidate.', { profitFactor: evidence.profitFactor, winRate: evidence.winRate });
  }
  if (evidence.totalTrades >= 100 && evidence.averageHoldingSeconds !== null && evidence.averageHoldingSeconds <= 300) {
    add('Excessive churn is indicated by short average holding time.', 'MEDIUM', 0.82,
      'INCREASE_COOLDOWN', 'Test a longer cooldown as a separate candidate to reduce turnover costs.', { averageHoldingSeconds: evidence.averageHoldingSeconds, totalTrades: evidence.totalTrades });
  }
  for (const regime of evidence.regimes.filter((item) => item.trades >= 20)) {
    if (regime.totalPnl > 0) {
      add(`Strategy is strong in ${regime.regime} regime.`, 'INFO', 0.8,
        'PRESERVE_REGIME_STRENGTH', 'Retain this behavior in future candidate comparisons.', regime);
    } else if (regime.totalPnl < 0) {
      add(`Strategy is weak in ${regime.regime} regime.`, 'MEDIUM', 0.84,
        'ADD_REGIME_FILTER_CANDIDATE', 'Test a regime filter in a new candidate without changing the live strategy.', regime);
    }
  }
  if (recommendations.length === 0) {
    add('No deterministic Teacher threshold was breached.', 'INFO', 0.7,
      'KEEP_MONITORING', 'Continue PAPER/SHADOW evidence collection without applying changes.', { totalTrades: evidence.totalTrades, score: evidence.score });
  }
  return recommendations;
}

export async function runTeacherEvaluation(
  userId: string, input: RunTeacherInput, ipAddress?: string,
  provider: TeacherAnalysisProvider = new RuleBasedTeacherProvider(),
) {
  const evidence = await loadEvidence(userId, input);
  if ((input.botId || input.strategyId) && evidence.length === 0) {
    throw new ApiError(404, 'Teacher target not found.', 'TEACHER_TARGET_NOT_FOUND');
  }
  const recommendations = (await Promise.all(evidence.map((item) => provider.evaluate(item)))).flat();
  const created = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (const item of recommendations) {
      const row = await tx.teacherEvaluation.create({ data: {
        ...(item.tradingBotId ? { tradingBotId: item.tradingBotId } : {}),
        ...(item.strategyId ? { strategyId: item.strategyId } : {}),
        observation: item.observation, severity: item.severity, confidence: item.confidence,
        metricEvidence: item.metricEvidence as Prisma.InputJsonObject,
        recommendedAction: item.recommendedAction as Prisma.InputJsonObject,
        analyzer: provider.name,
      } });
      rows.push(row);
      await tx.tradingAuditLog.create({ data: {
        userId, action: 'AI_TEACHER_EVALUATED', entityType: item.targetType,
        entityId: item.tradingBotId ?? item.strategyId!,
        metadata: { teacherEvaluationId: row.id.toString(), analyzer: provider.name, analysisAdapter: adapterMetadata(item.metricEvidence), recommendationApplied: false },
        ...(ipAddress ? { ipAddress } : {}),
      } });
    }
    await tx.tradingAuditLog.create({ data: {
      userId, action: 'AI_TEACHER_RUN_COMPLETED', entityType: 'TEACHER_RUN',
      metadata: { analyzer: provider.name, targetsAnalyzed: evidence.length, evaluationsCreated: rows.length, recommendationApplied: false },
      ...(ipAddress ? { ipAddress } : {}),
    } });
    return rows;
  });
  return { analyzer: provider.name, targetsAnalyzed: evidence.length, evaluationsCreated: created.length, recommendationApplied: false };
}

function adapterMetadata(evidence: Record<string, unknown>) {
  const value = evidence.analysisAdapter;
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

export async function listTeacherEvaluations(userId: string, query: TeacherEvaluationsQuery) {
  const rows = await prisma.teacherEvaluation.findMany({
    where: {
      OR: [{ tradingBot: { userId, type: 'AUTONOMOUS' } }, { strategy: { createdById: userId } }],
      ...(query.botId ? { tradingBotId: query.botId } : {}),
      ...(query.strategyId ? { strategyId: query.strategyId } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
    },
    include: { tradingBot: { select: { name: true, symbol: true, symbols: true } }, strategy: { select: { name: true, family: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.limit,
  });
  return rows.map((row) => ({ ...row, id: row.id.toString(), confidence: row.confidence.toNumber() }));
}

type EvidenceRow = {
  targetType: 'BOT' | 'STRATEGY'; targetId: string; totalTrades: bigint; wins: bigint; losses: bigint;
  totalPnl: Prisma.Decimal; grossProfit: Prisma.Decimal; grossLoss: Prisma.Decimal;
  maxDrawdown: Prisma.Decimal | null; averageHoldingSeconds: Prisma.Decimal | null; score: Prisma.Decimal | null;
};
type RegimeRow = { targetType: 'BOT' | 'STRATEGY'; targetId: string; regime: string; trades: bigint; totalPnl: Prisma.Decimal };

async function loadEvidence(userId: string, input: RunTeacherInput) {
  const botRows = input.strategyId ? [] : await prisma.$queryRaw<EvidenceRow[]>(Prisma.sql`
    SELECT 'BOT' AS targetType, b.id AS targetId, COUNT(t.id) AS totalTrades,
      SUM(CASE WHEN t.realizedPnl > 0 THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN t.realizedPnl < 0 THEN 1 ELSE 0 END) AS losses,
      COALESCE(SUM(t.realizedPnl), 0) AS totalPnl,
      COALESCE(SUM(CASE WHEN t.realizedPnl > 0 THEN t.realizedPnl ELSE 0 END), 0) AS grossProfit,
      COALESCE(SUM(CASE WHEN t.realizedPnl < 0 THEN t.realizedPnl ELSE 0 END), 0) AS grossLoss,
      (SELECT m.maxDrawdown FROM bot_metrics m WHERE m.tradingBotId = b.id ORDER BY m.snapshotAt DESC, m.id DESC LIMIT 1) AS maxDrawdown,
      AVG(t.holdingSeconds) AS averageHoldingSeconds,
      (SELECT m.score FROM bot_metrics m WHERE m.tradingBotId = b.id ORDER BY m.snapshotAt DESC, m.id DESC LIMIT 1) AS score
    FROM trading_bots b LEFT JOIN paper_trades t ON t.tradingBotId = b.id AND t.status IN ('CLOSED', 'LIQUIDATED')
    WHERE b.userId = ${userId} AND b.type = 'AUTONOMOUS' ${input.botId ? Prisma.sql`AND b.id = ${input.botId}` : Prisma.empty}
    GROUP BY b.id
  `);
  const strategyRows = input.botId ? [] : await prisma.$queryRaw<EvidenceRow[]>(Prisma.sql`
    SELECT 'STRATEGY' AS targetType, s.id AS targetId, COUNT(t.id) AS totalTrades,
      SUM(CASE WHEN t.realizedPnl > 0 THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN t.realizedPnl < 0 THEN 1 ELSE 0 END) AS losses,
      COALESCE(SUM(t.realizedPnl), 0) AS totalPnl,
      COALESCE(SUM(CASE WHEN t.realizedPnl > 0 THEN t.realizedPnl ELSE 0 END), 0) AS grossProfit,
      COALESCE(SUM(CASE WHEN t.realizedPnl < 0 THEN t.realizedPnl ELSE 0 END), 0) AS grossLoss,
      NULL AS maxDrawdown, AVG(t.holdingSeconds) AS averageHoldingSeconds, NULL AS score
    FROM trading_strategies s
    LEFT JOIN trading_strategy_versions v ON v.strategyId = s.id
    LEFT JOIN paper_trades t ON t.strategyVersionId = v.id AND t.status IN ('CLOSED', 'LIQUIDATED')
    WHERE s.createdById = ${userId} ${input.strategyId ? Prisma.sql`AND s.id = ${input.strategyId}` : Prisma.empty}
    GROUP BY s.id
  `);
  const rows = [...botRows, ...strategyRows];
  const regimes = rows.length === 0 ? [] : await loadRegimes(userId, input);
  return rows.map((row) => presentEvidence(row, regimes));
}

async function loadRegimes(userId: string, input: RunTeacherInput) {
  return prisma.$queryRaw<RegimeRow[]>(Prisma.sql`
    SELECT grouped.targetType, grouped.targetId, grouped.regime, COUNT(*) AS trades, SUM(grouped.realizedPnl) AS totalPnl
    FROM (
      SELECT 'BOT' AS targetType, b.id AS targetId, COALESCE(r.regime, 'UNKNOWN') AS regime, t.realizedPnl
      FROM paper_trades t JOIN trading_bots b ON b.id = t.tradingBotId LEFT JOIN market_regime_snapshots r ON r.id = t.marketRegimeSnapshotId
      WHERE b.userId = ${userId} AND b.type = 'AUTONOMOUS' AND t.status IN ('CLOSED', 'LIQUIDATED')
        ${input.botId ? Prisma.sql`AND b.id = ${input.botId}` : Prisma.empty} ${input.strategyId ? Prisma.sql`AND 1 = 0` : Prisma.empty}
      UNION ALL
      SELECT 'STRATEGY' AS targetType, s.id AS targetId, COALESCE(r.regime, 'UNKNOWN') AS regime, t.realizedPnl
      FROM paper_trades t JOIN trading_strategy_versions v ON v.id = t.strategyVersionId JOIN trading_strategies s ON s.id = v.strategyId
      LEFT JOIN market_regime_snapshots r ON r.id = t.marketRegimeSnapshotId
      WHERE s.createdById = ${userId} AND t.status IN ('CLOSED', 'LIQUIDATED')
        ${input.strategyId ? Prisma.sql`AND s.id = ${input.strategyId}` : Prisma.empty} ${input.botId ? Prisma.sql`AND 1 = 0` : Prisma.empty}
    ) grouped GROUP BY grouped.targetType, grouped.targetId, grouped.regime
  `);
}

function presentEvidence(row: EvidenceRow, regimes: RegimeRow[]): TeacherEvidence {
  const wins = Number(row.wins); const losses = Number(row.losses); const totalTrades = Number(row.totalTrades);
  const grossProfit = row.grossProfit.toNumber(); const grossLoss = Math.abs(row.grossLoss.toNumber());
  return {
    targetType: row.targetType,
    ...(row.targetType === 'BOT' ? { tradingBotId: row.targetId } : { strategyId: row.targetId }),
    totalTrades, wins, losses, winRate: wins + losses === 0 ? null : wins / (wins + losses),
    profitFactor: grossLoss === 0 ? (grossProfit > 0 ? null : 0) : grossProfit / grossLoss,
    totalPnl: row.totalPnl.toNumber(), maxDrawdown: row.maxDrawdown?.toNumber() ?? null,
    averageHoldingSeconds: row.averageHoldingSeconds?.toNumber() ?? null, score: row.score?.toNumber() ?? null,
    regimes: regimes.filter((item) => item.targetType === row.targetType && item.targetId === row.targetId)
      .map((item) => ({ regime: item.regime, trades: Number(item.trades), totalPnl: item.totalPnl.toNumber() })),
  };
}
