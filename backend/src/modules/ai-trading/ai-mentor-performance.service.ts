import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';

type Row = {
  id: bigint; action: 'HOLD' | 'BUY' | 'SELL'; status: string; modelProvider: string | null;
  agreement: number; fillCount: bigint; closeFillCount: bigint; netPnl: string;
};

export async function getAIMentorPerformance(userId: string, days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT s.id, s.action, s.status, s.modelProvider,
      CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(s.features, '$.agreement')) = 'true' THEN 1 ELSE 0 END AS agreement,
      COUNT(f.id) AS fillCount,
      SUM(CASE WHEN f.reduceOnly = true THEN 1 ELSE 0 END) AS closeFillCount,
      COALESCE(SUM(CAST(f.netRealizedPnl AS DECIMAL(36,18))), 0) AS netPnl
    FROM trading_bot_signals s
    LEFT JOIN testnet_execution_fills f ON f.decisionId = s.decisionId
    WHERE s.userId = ${userId} AND s.source = 'AI_MODEL' AND s.createdAt >= ${since}
    GROUP BY s.id, s.action, s.status, s.modelProvider, agreement
    ORDER BY s.id DESC
  `);
  const directional = rows.filter((row) => row.action !== 'HOLD');
  const closed = directional.filter((row) => Number(row.closeFillCount) > 0);
  const executed = directional.filter((row) => Number(row.fillCount) > 0);
  const totalPnl = closed.reduce((sum, row) => sum + Number(row.netPnl), 0);
  const ratio = (value: number, total: number) => total > 0 ? value / total : 0;
  return {
    period: { days, since }, recommendations: rows.length, directionalRecommendations: directional.length,
    acceptedRecommendations: rows.filter((row) => row.status === 'ACCEPTED').length,
    executedRecommendations: executed.length, closedOutcomes: closed.length,
    wins: closed.filter((row) => Number(row.netPnl) > 0).length,
    directionalAccuracy: ratio(closed.filter((row) => Number(row.netPnl) > 0).length, closed.length),
    ruleAgreementRate: ratio(rows.filter((row) => Number(row.agreement) === 1).length, rows.length),
    totalNetPnl: totalPnl.toFixed(8), averageNetPnl: (closed.length ? totalPnl / closed.length : 0).toFixed(8),
    note: 'Accuracy is calculated only from directional mentor decisions whose TESTNET position was closed.',
  };
}
