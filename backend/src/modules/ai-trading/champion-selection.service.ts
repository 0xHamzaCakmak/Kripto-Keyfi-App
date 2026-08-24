import { Prisma, type AutonomousTradingStatus } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { ChampionSelectionConfig } from './champion-selection.schema.js';

export type PromotionEvidence = {
  botId: string;
  lifecycleStatus: AutonomousTradingStatus;
  evidenceAt: string;
  evidenceVersion: string;
  score: number | null;
  totalTrades: number;
  paperDurationDays: number;
  profitFactor: number | null;
  maxDrawdown: number;
  regimeCoverage: number;
  openPaperTrades: number;
};

export type SelectionDecision = PromotionEvidence & {
  eligible: boolean;
  failedGates: string[];
  rank: number | null;
  targetStatus: AutonomousTradingStatus;
};

type EvidenceRow = {
  botId: string;
  lifecycleStatus: AutonomousTradingStatus;
  score: Prisma.Decimal | null;
  totalTrades: number;
  maxDrawdown: Prisma.Decimal;
  metrics: Prisma.JsonValue | null;
  firstTradeAt: Date | null;
  lastTradeAt: Date | null;
  regimeCoverage: bigint;
  openPaperTrades: bigint;
  evidenceAt: Date;
};

export function selectChampions(evidence: PromotionEvidence[], config: ChampionSelectionConfig): SelectionDecision[] {
  const evaluated = evidence.map((item) => {
    const failedGates: string[] = [];
    if (item.totalTrades < config.minTrades) failedGates.push('MIN_TRADES');
    if (item.paperDurationDays < config.minPaperDurationDays) failedGates.push('MIN_PAPER_DURATION');
    if (item.profitFactor === null || item.profitFactor < config.minProfitFactor) failedGates.push('MIN_PROFIT_FACTOR');
    if (item.maxDrawdown > config.maxDrawdown) failedGates.push('MAX_DRAWDOWN');
    if (item.score === null || item.score < config.minBotScore) failedGates.push('MIN_BOT_SCORE');
    if (item.regimeCoverage < config.minRegimeCoverage) failedGates.push('MIN_REGIME_COVERAGE');
    if (item.openPaperTrades > 0) failedGates.push('OPEN_PAPER_POSITION');
    return { ...item, eligible: failedGates.length === 0, failedGates };
  });
  const ranked = evaluated.filter((item) => item.eligible).sort((left, right) =>
    (right.score ?? 0) - (left.score ?? 0) || right.profitFactor! - left.profitFactor! || left.botId.localeCompare(right.botId));
  const ranks = new Map(ranked.map((item, index) => [item.botId, index + 1]));
  return evaluated.map((item) => {
    const rank = ranks.get(item.botId) ?? null;
    let targetStatus = item.lifecycleStatus;
    if (rank !== null && rank <= config.topChampions) {
      targetStatus = item.lifecycleStatus === 'PAPER' ? 'CHALLENGER' : 'CHAMPION';
    }
    else if (rank !== null && rank <= config.topChallengers) targetStatus = 'CHALLENGER';
    else if (item.lifecycleStatus === 'CHAMPION' || item.lifecycleStatus === 'CHALLENGER') targetStatus = 'PAPER';
    return { ...item, rank, targetStatus };
  });
}

export async function runChampionSelection(userId: string, config: ChampionSelectionConfig, ipAddress?: string) {
  const decisions = selectChampions((await loadEvidence(userId)).map(presentEvidence), config);
  const latestRows = await prisma.championCandidate.findMany({
    where: { tradingBotId: { in: decisions.map((item) => item.botId) } },
    select: { tradingBotId: true, evidence: true },
    orderBy: [{ evaluatedAt: 'desc' }, { createdAt: 'desc' }],
  });
  const latestEvaluation = new Map<string, string | null>();
  for (const row of latestRows) {
    if (!latestEvaluation.has(row.tradingBotId)) latestEvaluation.set(row.tradingBotId, evidenceVersion(row.evidence));
  }
  const pending = decisions.filter((decision) => shouldPersistEvaluation(latestEvaluation.get(decision.botId), decision.evidenceVersion));
  await prisma.$transaction(async (tx) => {
    for (const decision of pending) {
      const changed = decision.targetStatus !== decision.lifecycleStatus;
      await tx.championCandidate.create({ data: {
        tradingBotId: decision.botId,
        status: candidateStatus(decision),
        ...(decision.score === null ? {} : { score: decision.score }),
        evidence: {
          totalTrades: decision.totalTrades, paperDurationDays: decision.paperDurationDays,
          profitFactor: decision.profitFactor, maxDrawdown: decision.maxDrawdown,
          regimeCoverage: decision.regimeCoverage, openPaperTrades: decision.openPaperTrades,
          evidenceAt: decision.evidenceAt, evidenceVersion: decision.evidenceVersion, failedGates: decision.failedGates,
          rank: decision.rank, from: decision.lifecycleStatus, target: decision.targetStatus,
        },
        evaluatedAt: new Date(),
        ...(decision.targetStatus === 'CHAMPION' ? { promotedAt: new Date() } : {}),
      } });
      if (!changed) continue;
      await tx.tradingBot.update({ where: { id: decision.botId }, data: {
        lifecycleStatus: decision.targetStatus,
        ...(decision.targetStatus === 'CHAMPION' ? {
          mode: 'SHADOW', state: 'STARTING', desiredState: 'RUNNING', schedulerOwner: null,
          leaseExpiresAt: null, heartbeatAt: null, stateReason: 'Champion promoted to execution-disabled SHADOW validation.',
        } : decision.lifecycleStatus === 'CHAMPION' ? {
          mode: 'PAPER', state: 'STARTING', desiredState: 'RUNNING', schedulerOwner: null,
          leaseExpiresAt: null, heartbeatAt: null, stateReason: 'Champion evidence no longer qualifies; returned to PAPER validation.',
        } : {}),
        version: { increment: 1 },
      } });
      const promoted = statusLevel(decision.targetStatus) > statusLevel(decision.lifecycleStatus);
      await tx.tradingAuditLog.create({ data: {
        userId,
        action: promoted ? 'AI_BOT_PROMOTED' : 'AI_BOT_DEMOTED',
        entityType: 'TRADING_BOT', entityId: decision.botId,
        metadata: { from: decision.lifecycleStatus, to: decision.targetStatus, rank: decision.rank, evidence: decision, liveActivated: false },
        ...(ipAddress ? { ipAddress } : {}),
      } });
    }
  }, { maxWait: 5_000, timeout: 20_000 });
  return { config, evaluated: decisions.length, persisted: pending.length, decisions, liveActivated: false };
}

export function shouldPersistEvaluation(latestVersion: string | null | undefined, currentVersion: string) {
  return latestVersion !== currentVersion;
}

export async function listChampionCandidates(userId: string) {
  return prisma.championCandidate.findMany({
    where: { tradingBot: { userId, type: 'AUTONOMOUS' } },
    include: { tradingBot: { select: { name: true, lifecycleStatus: true, strategyVersionId: true } } },
    orderBy: [{ evaluatedAt: 'desc' }, { score: 'desc' }], take: 500,
  });
}

async function loadEvidence(userId: string) {
  return prisma.$queryRaw<EvidenceRow[]>(Prisma.sql`
    SELECT b.id AS botId, b.lifecycleStatus, latest.score, latest.totalTrades, latest.maxDrawdown, latest.metrics,
      latest.snapshotAt AS evidenceAt,
      MIN(t.openedAt) AS firstTradeAt, MAX(COALESCE(t.closedAt, t.openedAt)) AS lastTradeAt,
      COUNT(DISTINCT snapshot.regime) AS regimeCoverage,
      SUM(CASE WHEN t.status = 'OPEN' THEN 1 ELSE 0 END) AS openPaperTrades
    FROM trading_bots b
    JOIN bot_metrics latest ON latest.id = (
      SELECT metric.id FROM bot_metrics metric WHERE metric.tradingBotId = b.id
      ORDER BY metric.snapshotAt DESC, metric.id DESC LIMIT 1
    )
    LEFT JOIN paper_trades t ON t.tradingBotId = b.id
    LEFT JOIN market_regime_snapshots snapshot ON snapshot.id = t.marketRegimeSnapshotId
    WHERE b.userId = ${userId} AND b.type = 'AUTONOMOUS'
      AND b.lifecycleStatus IN ('PAPER', 'CHALLENGER', 'CHAMPION')
    GROUP BY b.id, b.lifecycleStatus, latest.score, latest.totalTrades, latest.maxDrawdown, latest.metrics, latest.snapshotAt
  `);
}

function presentEvidence(row: EvidenceRow): PromotionEvidence {
  const presented = {
    botId: row.botId, lifecycleStatus: row.lifecycleStatus, evidenceAt: row.evidenceAt.toISOString(),
    score: row.score?.toNumber() ?? null,
    totalTrades: row.totalTrades,
    paperDurationDays: row.firstTradeAt && row.lastTradeAt
      ? Math.max(0, (row.lastTradeAt.getTime() - row.firstTradeAt.getTime()) / 86_400_000) : 0,
    profitFactor: jsonNumber(row.metrics, 'profitFactor'), maxDrawdown: row.maxDrawdown.toNumber(),
    regimeCoverage: Number(row.regimeCoverage), openPaperTrades: Number(row.openPaperTrades),
  };
  return { ...presented, evidenceVersion: JSON.stringify([
    presented.totalTrades, row.lastTradeAt?.toISOString() ?? null, presented.score,
    presented.profitFactor, presented.maxDrawdown, presented.regimeCoverage, presented.openPaperTrades,
  ]) };
}

export async function loadCurrentPromotionEvidence(userId: string) {
  return (await loadEvidence(userId)).map(presentEvidence);
}

function evidenceVersion(value: Prisma.JsonValue | null) {
  if (value === null || Array.isArray(value) || typeof value !== 'object') return null;
  const candidate = (value as Prisma.JsonObject).evidenceVersion;
  return typeof candidate === 'string' ? candidate : null;
}

function jsonNumber(value: Prisma.JsonValue | null, key: string) {
  if (value === null || Array.isArray(value) || typeof value !== 'object') return null;
  const result = (value as Prisma.JsonObject)[key];
  return typeof result === 'number' && Number.isFinite(result) ? result : null;
}
function statusLevel(status: AutonomousTradingStatus) {
  const levels: Partial<Record<AutonomousTradingStatus, number>> = { PAPER: 1, CHALLENGER: 2, CHAMPION: 3 };
  return levels[status] ?? 0;
}
function candidateStatus(decision: SelectionDecision) {
  if (statusLevel(decision.targetStatus) > statusLevel(decision.lifecycleStatus)) return 'PROMOTED' as const;
  if (statusLevel(decision.targetStatus) < statusLevel(decision.lifecycleStatus)) return 'DEMOTED' as const;
  return decision.eligible ? 'ELIGIBLE' as const : 'REJECTED' as const;
}
