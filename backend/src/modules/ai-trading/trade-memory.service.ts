import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { TradeMemoryQuery, TradeMemorySummaryQuery } from './trade-memory.schema.js';

type SummaryRow = {
  groupKey: string;
  tradeCount: bigint;
  wins: bigint;
  losses: bigint;
  totalPnl: Prisma.Decimal;
  grossProfit: Prisma.Decimal;
  grossLoss: Prisma.Decimal;
  averagePnl: Prisma.Decimal;
};

const closedStatuses = ['CLOSED', 'LIQUIDATED'] as const;

export async function listTradeMemory(userId: string, query: TradeMemoryQuery) {
  const trades = await prisma.paperTrade.findMany({
    where: {
      tradingBot: { userId, type: 'AUTONOMOUS' },
      status: { in: [...closedStatuses] },
      ...(query.botId ? { tradingBotId: query.botId } : {}),
      ...(query.strategyVersionId ? { strategyVersionId: query.strategyVersionId } : {}),
      ...(query.symbol ? { symbol: query.symbol } : {}),
      ...(query.side ? { side: query.side } : {}),
      ...(query.regime ? { marketRegimeSnapshot: { regime: query.regime } } : {}),
      ...(query.outcome === 'BEST' ? { realizedPnl: { gt: 0 } } : {}),
      ...(query.outcome === 'FAILURE' ? { realizedPnl: { lt: 0 } } : {}),
    },
    include: {
      tradingBot: { select: { id: true, name: true } },
      strategyVersion: { select: { id: true, version: true, strategy: { select: { id: true, name: true, family: true } } } },
      marketRegimeSnapshot: { select: { id: true, regime: true, confidence: true, timeframe: true, features: true, observedAt: true } },
    },
    orderBy: query.outcome === 'BEST'
      ? [{ realizedPnl: 'desc' }, { closedAt: 'desc' }]
      : query.outcome === 'FAILURE'
        ? [{ realizedPnl: 'asc' }, { closedAt: 'desc' }]
        : [{ closedAt: 'desc' }, { openedAt: 'desc' }],
    take: query.limit,
  });
  return trades.map(presentTradeMemory);
}

export async function summarizeTradeMemory(userId: string, query: TradeMemorySummaryQuery) {
  const groupExpression = summaryGroupExpression(query.groupBy);
  const rows = await prisma.$queryRaw<SummaryRow[]>(Prisma.sql`
    SELECT ${groupExpression} AS groupKey,
      COUNT(*) AS tradeCount,
      SUM(CASE WHEN t.realizedPnl > 0 THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN t.realizedPnl < 0 THEN 1 ELSE 0 END) AS losses,
      COALESCE(SUM(t.realizedPnl), 0) AS totalPnl,
      COALESCE(SUM(CASE WHEN t.realizedPnl > 0 THEN t.realizedPnl ELSE 0 END), 0) AS grossProfit,
      COALESCE(SUM(CASE WHEN t.realizedPnl < 0 THEN t.realizedPnl ELSE 0 END), 0) AS grossLoss,
      COALESCE(AVG(t.realizedPnl), 0) AS averagePnl
    FROM paper_trades t
    JOIN trading_bots b ON b.id = t.tradingBotId
    LEFT JOIN market_regime_snapshots r ON r.id = t.marketRegimeSnapshotId
    WHERE b.userId = ${userId} AND b.type = 'AUTONOMOUS'
      AND t.status IN ('CLOSED', 'LIQUIDATED')
      ${query.botId ? Prisma.sql`AND t.tradingBotId = ${query.botId}` : Prisma.empty}
      ${query.strategyVersionId ? Prisma.sql`AND t.strategyVersionId = ${query.strategyVersionId}` : Prisma.empty}
      ${query.symbol ? Prisma.sql`AND t.symbol = ${query.symbol}` : Prisma.empty}
      ${query.regime ? Prisma.sql`AND r.regime = ${query.regime}` : Prisma.empty}
    GROUP BY ${groupExpression}
    ORDER BY totalPnl DESC, tradeCount DESC
    LIMIT ${query.limit}
  `);
  return rows.map(presentSummary);
}

function summaryGroupExpression(groupBy: TradeMemorySummaryQuery['groupBy']) {
  switch (groupBy) {
    case 'BOT': return Prisma.sql`t.tradingBotId`;
    case 'STRATEGY': return Prisma.sql`COALESCE(t.strategyVersionId, 'UNASSIGNED')`;
    case 'REGIME': return Prisma.sql`COALESCE(r.regime, 'UNKNOWN')`;
    case 'SYMBOL': return Prisma.sql`t.symbol`;
  }
}

export function presentSummary(row: SummaryRow) {
  const grossProfit = row.grossProfit.toNumber();
  const grossLoss = Math.abs(row.grossLoss.toNumber());
  return {
    groupKey: row.groupKey,
    tradeCount: Number(row.tradeCount), wins: Number(row.wins), losses: Number(row.losses),
    totalPnl: row.totalPnl.toString(), averagePnl: row.averagePnl.toString(),
    grossProfit: row.grossProfit.toString(), grossLoss: row.grossLoss.toString(),
    profitFactor: grossLoss === 0 ? (grossProfit > 0 ? null : 0) : grossProfit / grossLoss,
  };
}

function presentTradeMemory(trade: Awaited<ReturnType<typeof prisma.paperTrade.findMany>>[number] & Record<string, unknown>) {
  const decimalFields = [
    'entryPrice', 'exitPrice', 'quantity', 'fees', 'funding', 'slippageCost', 'realizedPnl',
    'stopLoss', 'takeProfit', 'maxFavorableExcursion', 'maxAdverseExcursion', 'aiConfidence',
  ] as const;
  const result: Record<string, unknown> = { ...trade };
  for (const field of decimalFields) {
    const value = trade[field];
    result[field] = value instanceof Prisma.Decimal ? value.toString() : value;
  }
  const openedAt = trade.openedAt as Date;
  const closedAt = trade.closedAt as Date | null;
  result.holdingSeconds = trade.holdingSeconds ?? (closedAt ? Math.max(0, Math.floor((closedAt.getTime() - openedAt.getTime()) / 1000)) : null);
  return result;
}
