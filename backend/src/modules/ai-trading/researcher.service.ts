import { Prisma, type StrategyFamily } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { ResearchHypothesesQuery, RunResearcherInput } from './researcher.schema.js';

export type ResearchDataset = {
  strategyFamily: StrategyFamily;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number | null;
  profitFactor: number | null;
  totalPnl: number;
  averageFunding: number | null;
  averageHoldingSeconds: number | null;
  averageBotScore: number | null;
  regimes: Array<{ regime: string; trades: number; totalPnl: number }>;
  teacherActions: Array<{ type: string; count: number }>;
};

export type ProposedHypothesis = {
  hypothesis: string;
  evidence: Record<string, unknown>;
  targetStrategyFamily: StrategyFamily;
  suggestedChange: { type: string; parameters: Record<string, unknown>; createCandidateOnly: true };
  confidence: number;
};

export interface ResearchHypothesisProvider {
  readonly name: string;
  propose(dataset: ResearchDataset, minimumTrades: number): Promise<ProposedHypothesis[]>;
}

export interface ResearchCandidateFactory {
  createCandidateFromHypothesis(input: {
    hypothesisId: string;
    targetStrategyFamily: StrategyFamily;
    suggestedChange: Prisma.JsonValue;
    lifecycleStatus: 'CANDIDATE';
  }): Promise<{ candidateId: string }>;
}

export class RuleTemplateResearchProvider implements ResearchHypothesisProvider {
  readonly name = 'RULE_TEMPLATE';
  async propose(dataset: ResearchDataset, minimumTrades: number) {
    return proposeRuleTemplates(dataset, minimumTrades);
  }
}

export function proposeRuleTemplates(dataset: ResearchDataset, minimumTrades: number): ProposedHypothesis[] {
  if (dataset.totalTrades < minimumTrades) return [];
  const proposals: ProposedHypothesis[] = [];
  const add = (hypothesis: string, type: string, parameters: Record<string, unknown>, confidence: number, evidence: Record<string, unknown>) => {
    if (proposals.some((item) => item.suggestedChange.type === type && JSON.stringify(item.suggestedChange.parameters) === JSON.stringify(parameters))) return;
    proposals.push({ hypothesis, targetStrategyFamily: dataset.strategyFamily, confidence, evidence,
      suggestedChange: { type, parameters, createCandidateOnly: true } });
  };
  if (dataset.profitFactor !== null && dataset.profitFactor < 1) {
    add(`${dataset.strategyFamily} may improve by filtering low-confidence entries because losses outweigh gains.`,
      'CONFIDENCE_THRESHOLD_FILTER', { direction: 'INCREASE', requiresValidation: true }, 0.82,
      { totalTrades: dataset.totalTrades, profitFactor: dataset.profitFactor, winRate: dataset.winRate, totalPnl: dataset.totalPnl });
  }
  if (dataset.averageHoldingSeconds !== null && dataset.averageHoldingSeconds <= 300) {
    add(`${dataset.strategyFamily} may be overtrading when holding periods are five minutes or shorter.`,
      'COOLDOWN_FILTER', { direction: 'INCREASE', requiresValidation: true }, 0.78,
      { totalTrades: dataset.totalTrades, averageHoldingSeconds: dataset.averageHoldingSeconds });
  }
  if (dataset.averageFunding !== null && dataset.averageFunding > 0 && dataset.totalPnl < 0) {
    add(`${dataset.strategyFamily} underperformance may be reduced by rejecting entries with unfavorable funding context.`,
      'FUNDING_CONTEXT_FILTER', { unfavorableFunding: 'REJECT', requiresValidation: true }, 0.76,
      { totalTrades: dataset.totalTrades, averageFunding: dataset.averageFunding, totalPnl: dataset.totalPnl });
  }
  for (const regime of dataset.regimes.filter((item) => item.trades >= 20 && item.totalPnl < 0)) {
    add(`${dataset.strategyFamily} underperforms in ${regime.regime}; a regime-aware entry filter should be tested.`,
      'REGIME_ENTRY_FILTER', { regime: regime.regime, behavior: 'AVOID', requiresValidation: true }, 0.84,
      { ...regime, totalTrades: dataset.totalTrades });
  }
  for (const action of dataset.teacherActions.filter((item) => item.count >= 2)) {
    add(`Repeated Teacher evidence suggests testing ${action.type} for ${dataset.strategyFamily}.`,
      'TEACHER_ACTION_CANDIDATE', { teacherAction: action.type, requiresValidation: true }, 0.74,
      { teacherAction: action.type, occurrences: action.count, averageBotScore: dataset.averageBotScore });
  }
  return proposals;
}

export async function runResearcher(
  userId: string, input: RunResearcherInput, ipAddress?: string,
  provider: ResearchHypothesisProvider = new RuleTemplateResearchProvider(),
) {
  const datasets = await loadResearchDatasets(userId, input.strategyFamily);
  const proposals = (await Promise.all(datasets.map((dataset) => provider.propose(dataset, input.minimumTrades)))).flat();
  const created = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (const proposal of proposals) {
      const row = await tx.researchHypothesis.create({ data: {
        createdById: userId, hypothesis: proposal.hypothesis,
        evidence: proposal.evidence as Prisma.InputJsonObject,
        targetStrategyFamily: proposal.targetStrategyFamily,
        suggestedChange: proposal.suggestedChange as Prisma.InputJsonObject,
        confidence: proposal.confidence, status: 'DRAFT', provider: provider.name,
      } });
      rows.push(row);
      await tx.tradingAuditLog.create({ data: {
        userId, action: 'AI_RESEARCH_HYPOTHESIS_CREATED', entityType: 'RESEARCH_HYPOTHESIS', entityId: row.id,
        metadata: { targetStrategyFamily: proposal.targetStrategyFamily, analysisAdapter: adapterMetadata(proposal.evidence), candidateCreated: false, liveChanged: false },
        ...(ipAddress ? { ipAddress } : {}),
      } });
    }
    await tx.tradingAuditLog.create({ data: {
      userId, action: 'AI_RESEARCH_RUN_COMPLETED', entityType: 'RESEARCH_RUN',
      metadata: { provider: provider.name, datasetsAnalyzed: datasets.length, hypothesesCreated: rows.length, candidateCreated: false, liveChanged: false },
      ...(ipAddress ? { ipAddress } : {}),
    } });
    return rows;
  });
  return { provider: provider.name, datasetsAnalyzed: datasets.length, hypothesesCreated: created.length, candidateCreated: false, liveChanged: false };
}

function adapterMetadata(evidence: Record<string, unknown>) {
  const value = evidence.analysisAdapter;
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

export async function listResearchHypotheses(userId: string, query: ResearchHypothesesQuery) {
  const rows = await prisma.researchHypothesis.findMany({
    where: { createdById: userId, ...(query.strategyFamily ? { targetStrategyFamily: query.strategyFamily } : {}), ...(query.status ? { status: query.status } : {}) },
    orderBy: [{ createdAt: 'desc' }, { confidence: 'desc' }], take: query.limit,
  });
  return rows.map((row) => ({ ...row, confidence: row.confidence.toNumber() }));
}

type PerformanceRow = { strategyFamily: StrategyFamily; totalTrades: bigint; wins: bigint; losses: bigint; totalPnl: Prisma.Decimal; grossProfit: Prisma.Decimal; grossLoss: Prisma.Decimal; averageFunding: Prisma.Decimal | null; averageHoldingSeconds: Prisma.Decimal | null };
type RegimeRow = { strategyFamily: StrategyFamily; regime: string; trades: bigint; totalPnl: Prisma.Decimal };
type ScoreRow = { strategyFamily: StrategyFamily; averageBotScore: Prisma.Decimal | null };

async function loadResearchDatasets(userId: string, family?: StrategyFamily) {
  const performance = await prisma.$queryRaw<PerformanceRow[]>(Prisma.sql`
    SELECT s.family AS strategyFamily, COUNT(t.id) AS totalTrades,
      SUM(CASE WHEN t.realizedPnl > 0 THEN 1 ELSE 0 END) AS wins, SUM(CASE WHEN t.realizedPnl < 0 THEN 1 ELSE 0 END) AS losses,
      COALESCE(SUM(t.realizedPnl), 0) AS totalPnl,
      COALESCE(SUM(CASE WHEN t.realizedPnl > 0 THEN t.realizedPnl ELSE 0 END), 0) AS grossProfit,
      COALESCE(SUM(CASE WHEN t.realizedPnl < 0 THEN t.realizedPnl ELSE 0 END), 0) AS grossLoss,
      AVG(t.funding) AS averageFunding, AVG(t.holdingSeconds) AS averageHoldingSeconds
    FROM trading_strategies s LEFT JOIN trading_strategy_versions v ON v.strategyId = s.id
    LEFT JOIN (
      SELECT strategyVersionId, realizedPnl, funding, holdingSeconds FROM paper_trades WHERE status IN ('CLOSED', 'LIQUIDATED')
      UNION ALL
      SELECT strategyVersionId, SUM(netRealizedPnl) AS realizedPnl, 0 AS funding, NULL AS holdingSeconds
      FROM testnet_execution_fills WHERE reduceOnly = true AND strategyVersionId IS NOT NULL GROUP BY strategyVersionId, tradingBotId, exchangeOrderId
    ) t ON t.strategyVersionId = v.id
    WHERE s.createdById = ${userId} ${family ? Prisma.sql`AND s.family = ${family}` : Prisma.empty}
    GROUP BY s.family
  `);
  const regimes = await prisma.$queryRaw<RegimeRow[]>(Prisma.sql`
    SELECT combined.strategyFamily, combined.regime, COUNT(*) AS trades, SUM(combined.realizedPnl) AS totalPnl
    FROM (
      SELECT s.family AS strategyFamily, COALESCE(r.regime, 'UNKNOWN') AS regime, t.realizedPnl
      FROM paper_trades t JOIN trading_strategy_versions v ON v.id = t.strategyVersionId JOIN trading_strategies s ON s.id = v.strategyId
      LEFT JOIN market_regime_snapshots r ON r.id = t.marketRegimeSnapshotId
      WHERE s.createdById = ${userId} AND t.status IN ('CLOSED', 'LIQUIDATED') ${family ? Prisma.sql`AND s.family = ${family}` : Prisma.empty}
      UNION ALL
      SELECT s.family AS strategyFamily, 'UNKNOWN' AS regime, grouped.realizedPnl
      FROM (
        SELECT strategyVersionId, tradingBotId, exchangeOrderId, SUM(netRealizedPnl) AS realizedPnl
        FROM testnet_execution_fills WHERE reduceOnly = true AND strategyVersionId IS NOT NULL GROUP BY strategyVersionId, tradingBotId, exchangeOrderId
      ) grouped JOIN trading_strategy_versions v ON v.id = grouped.strategyVersionId JOIN trading_strategies s ON s.id = v.strategyId
      WHERE s.createdById = ${userId} ${family ? Prisma.sql`AND s.family = ${family}` : Prisma.empty}
    ) combined GROUP BY combined.strategyFamily, combined.regime
  `);
  const scores = await prisma.$queryRaw<ScoreRow[]>(Prisma.sql`
    SELECT s.family AS strategyFamily, AVG(m.score) AS averageBotScore
    FROM bot_metrics m JOIN trading_bots b ON b.id = m.tradingBotId
    JOIN trading_strategy_versions v ON v.id = b.strategyVersionId JOIN trading_strategies s ON s.id = v.strategyId
    WHERE b.userId = ${userId} AND b.type = 'AUTONOMOUS' AND m.score IS NOT NULL
      AND m.id = (SELECT latest.id FROM bot_metrics latest WHERE latest.tradingBotId = b.id ORDER BY latest.snapshotAt DESC, latest.id DESC LIMIT 1)
      ${family ? Prisma.sql`AND s.family = ${family}` : Prisma.empty}
    GROUP BY s.family
  `);
  const teacherRows = await prisma.teacherEvaluation.findMany({
    where: { OR: [{ strategy: { createdById: userId } }, { tradingBot: { userId, type: 'AUTONOMOUS' } }] },
    select: { recommendedAction: true, strategy: { select: { family: true } }, tradingBot: { select: { strategyVersion: { select: { strategy: { select: { family: true } } } } } } },
    orderBy: { createdAt: 'desc' }, take: 2_000,
  });
  return performance.map((row) => {
    const wins = Number(row.wins); const losses = Number(row.losses); const grossProfit = row.grossProfit.toNumber(); const grossLoss = Math.abs(row.grossLoss.toNumber());
    const actions = new Map<string, number>();
    for (const teacher of teacherRows) {
      const teacherFamily = teacher.strategy?.family ?? teacher.tradingBot?.strategyVersion?.strategy.family;
      const action = jsonString(teacher.recommendedAction, 'type');
      if (teacherFamily === row.strategyFamily && action) actions.set(action, (actions.get(action) ?? 0) + 1);
    }
    return {
      strategyFamily: row.strategyFamily, totalTrades: Number(row.totalTrades), wins, losses,
      winRate: wins + losses === 0 ? null : wins / (wins + losses),
      profitFactor: grossLoss === 0 ? (grossProfit > 0 ? null : 0) : grossProfit / grossLoss,
      totalPnl: row.totalPnl.toNumber(), averageFunding: row.averageFunding?.toNumber() ?? null,
      averageHoldingSeconds: row.averageHoldingSeconds?.toNumber() ?? null,
      averageBotScore: scores.find((item) => item.strategyFamily === row.strategyFamily)?.averageBotScore?.toNumber() ?? null,
      regimes: regimes.filter((item) => item.strategyFamily === row.strategyFamily).map((item) => ({ regime: item.regime, trades: Number(item.trades), totalPnl: item.totalPnl.toNumber() })),
      teacherActions: [...actions].map(([type, count]) => ({ type, count })),
    } satisfies ResearchDataset;
  });
}

function jsonString(value: Prisma.JsonValue, key: string) {
  if (value === null || Array.isArray(value) || typeof value !== 'object') return null;
  const result = (value as Prisma.JsonObject)[key];
  return typeof result === 'string' ? result : null;
}
