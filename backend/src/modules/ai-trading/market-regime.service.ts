import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { rankLeaderboardRows, type ScoreRow } from './bot-score.service.js';
import type { MarketRegime } from './core-domain.js';

export async function getRegimeLeaderboard(userId: string, regime: MarketRegime, limit: number) {
  const rows = await prisma.$queryRaw<ScoreRow[]>(Prisma.sql`
    SELECT m.id AS metricId, m.tradingBotId, b.name AS botName, m.strategyVersionId,
      m.score, m.metrics, m.snapshotAt
    FROM bot_metrics m
    JOIN trading_bots b ON b.id = m.tradingBotId
    JOIN market_regime_snapshots snapshot ON snapshot.id = m.marketRegimeSnapshotId
    WHERE b.userId = ${userId} AND b.type = 'AUTONOMOUS' AND snapshot.regime = ${regime}
      AND m.score IS NOT NULL
      AND m.id = (
        SELECT latest.id
        FROM bot_metrics latest
        JOIN market_regime_snapshots latest_snapshot ON latest_snapshot.id = latest.marketRegimeSnapshotId
        WHERE latest.tradingBotId = m.tradingBotId AND latest_snapshot.regime = ${regime}
        ORDER BY latest.snapshotAt DESC, latest.id DESC LIMIT 1
      )
    ORDER BY m.score DESC, m.snapshotAt DESC, m.tradingBotId ASC
  `);
  return rankLeaderboardRows(rows).slice(0, limit).map((row) => ({ ...row, regime }));
}
