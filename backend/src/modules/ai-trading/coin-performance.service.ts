import { Prisma, type MarketRegime } from '@prisma/client';
import { prisma } from '../../database/prisma.js';

export type CoinPerformanceRow = {
  tradingBotId: string; botName: string; strategyVersionId: string | null; symbol: string; regime: MarketRegime;
  tradeCount: bigint; wins: bigint; losses: bigint; netPnl: Prisma.Decimal; grossProfit: Prisma.Decimal; grossLoss: Prisma.Decimal; latestTradeAt: Date;
};

export type CoinPerformance = ReturnType<typeof presentCoinPerformance>;

export async function getCoinPerformance(userId: string, options: { symbol?: string; regime?: MarketRegime; limit?: number } = {}) {
  const rows = await prisma.$queryRaw<CoinPerformanceRow[]>(Prisma.sql`
    SELECT t.tradingBotId, b.name AS botName, t.strategyVersionId, t.symbol,
      t.regime, COUNT(*) AS tradeCount,
      SUM(CASE WHEN t.realizedPnl > 0 THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN t.realizedPnl < 0 THEN 1 ELSE 0 END) AS losses,
      MAX(t.closedAt) AS latestTradeAt,
      COALESCE(SUM(t.realizedPnl), 0) AS netPnl,
      COALESCE(SUM(CASE WHEN t.realizedPnl > 0 THEN t.realizedPnl ELSE 0 END), 0) AS grossProfit,
      COALESCE(SUM(CASE WHEN t.realizedPnl < 0 THEN -t.realizedPnl ELSE 0 END), 0) AS grossLoss
    FROM (
      SELECT p.tradingBotId, p.strategyVersionId, p.symbol, COALESCE(r.regime, 'UNKNOWN') AS regime, p.realizedPnl, p.closedAt
      FROM paper_trades p LEFT JOIN market_regime_snapshots r ON r.id = p.marketRegimeSnapshotId
      WHERE p.status IN ('CLOSED', 'LIQUIDATED')
      UNION ALL
      SELECT f.tradingBotId, f.strategyVersionId, f.symbol, 'UNKNOWN' AS regime, SUM(f.netRealizedPnl) AS realizedPnl, MAX(f.occurredAt) AS closedAt
      FROM testnet_execution_fills f WHERE f.reduceOnly = true
      GROUP BY f.tradingBotId, f.strategyVersionId, f.symbol, f.exchangeOrderId
    ) t
    JOIN trading_bots b ON b.id = t.tradingBotId
    WHERE b.userId = ${userId} AND b.type = 'AUTONOMOUS'
      ${options.symbol ? Prisma.sql`AND t.symbol = ${options.symbol}` : Prisma.empty}
      ${options.regime ? Prisma.sql`AND t.regime = ${options.regime}` : Prisma.empty}
    GROUP BY t.tradingBotId, b.name, t.strategyVersionId, t.symbol, t.regime
  `);
  return rows.map(presentCoinPerformance).sort((left, right) => right.score - left.score || right.tradeCount - left.tradeCount).slice(0, options.limit ?? 100);
}

export function presentCoinPerformance(row: CoinPerformanceRow) {
  const tradeCount = Number(row.tradeCount); const wins = Number(row.wins); const losses = Number(row.losses);
  const grossProfit = row.grossProfit.toNumber(); const grossLoss = row.grossLoss.toNumber(); const netPnl = row.netPnl.toNumber();
  const winRate = tradeCount ? wins / tradeCount : 0; const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 3 : 0;
  const evidenceFactor = Math.min(1, tradeCount / 20);
  const rawScore = 35 + winRate * 30 + Math.min(profitFactor, 3) * 8 + Math.tanh(netPnl / Math.max(grossLoss, 1)) * 11;
  return { tradingBotId: row.tradingBotId, botName: row.botName, strategyVersionId: row.strategyVersionId, symbol: row.symbol, regime: row.regime,
    tradeCount, wins, losses, winRate, profitFactor, netPnl, latestTradeAt: row.latestTradeAt,
    score: Math.max(0, Math.min(100, rawScore * evidenceFactor)), evidenceVersion: 'COIN_STRATEGY_REGIME_V1' };
}
