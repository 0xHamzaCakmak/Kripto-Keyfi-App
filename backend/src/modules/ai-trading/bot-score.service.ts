import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';

export type ScoreRow = {
  metricId: bigint;
  tradingBotId: string;
  botName: string;
  strategyVersionId: string | null;
  score: Prisma.Decimal;
  metrics: Prisma.JsonValue | null;
  snapshotAt: Date;
};

export type RankedScore = {
  metricId: string;
  tradingBotId: string;
  botName: string;
  strategyVersionId: string | null;
  score: number;
  breakdown: Prisma.JsonValue | null;
  snapshotAt: Date;
  rank: number;
};

export async function getBotLeaderboard(userId: string, limit: number) {
  return rankLeaderboardRows(await loadScoreRows(userId)).slice(0, limit);
}

export async function getBotScore(userId: string, botId: string) {
  const score = rankLeaderboardRows(await loadScoreRows(userId)).find((row) => row.tradingBotId === botId);
  if (!score) throw new ApiError(404, 'Bot score not found.', 'BOT_SCORE_NOT_FOUND');
  return score;
}

async function loadScoreRows(userId: string) {
  return prisma.$queryRaw<ScoreRow[]>(Prisma.sql`
    SELECT m.id AS metricId, m.tradingBotId, b.name AS botName, m.strategyVersionId,
      m.score, m.metrics, m.snapshotAt
    FROM bot_metrics m
    JOIN trading_bots b ON b.id = m.tradingBotId
    WHERE b.userId = ${userId} AND b.type = 'AUTONOMOUS' AND m.score IS NOT NULL
      AND m.id = (
        SELECT latest.id FROM bot_metrics latest
        WHERE latest.tradingBotId = m.tradingBotId
        ORDER BY latest.snapshotAt DESC, latest.id DESC LIMIT 1
      )
    ORDER BY m.score DESC, m.snapshotAt DESC, m.tradingBotId ASC
  `);
}

export function rankLeaderboardRows(rows: ScoreRow[]): RankedScore[] {
  const sorted = [...rows].sort((left, right) => {
    const scoreDifference = right.score.toNumber() - left.score.toNumber();
    if (scoreDifference !== 0) return scoreDifference;
    const timeDifference = right.snapshotAt.getTime() - left.snapshotAt.getTime();
    return timeDifference !== 0 ? timeDifference : left.tradingBotId.localeCompare(right.tradingBotId);
  });
  let previousScore: number | undefined;
  let rank = 0;
  return sorted.map((row, index) => {
    const score = row.score.toNumber();
    if (previousScore === undefined || score !== previousScore) rank = index + 1;
    previousScore = score;
    return {
      metricId: row.metricId.toString(),
      tradingBotId: row.tradingBotId,
      botName: row.botName,
      strategyVersionId: row.strategyVersionId,
      score,
      breakdown: scoreBreakdown(row.metrics),
      snapshotAt: row.snapshotAt,
      rank,
    };
  });
}

function scoreBreakdown(metrics: Prisma.JsonValue | null): Prisma.JsonValue | null {
  if (metrics === null || Array.isArray(metrics) || typeof metrics !== 'object') return null;
  const breakdown = (metrics as Prisma.JsonObject).scoreBreakdown;
  return breakdown ?? null;
}
