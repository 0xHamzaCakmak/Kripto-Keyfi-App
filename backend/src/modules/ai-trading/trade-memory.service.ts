import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { TradeMemoryQuery, TradeMemoryStatsQuery, TradeMemorySummaryQuery } from './trade-memory.schema.js';

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
  const paperTrades = query.source === 'TESTNET' ? [] : await prisma.paperTrade.findMany({
    where: memoryWhere(userId, query),
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
  const testnetTrades = query.source === 'PAPER' ? [] : await listTestnetClosedTrades(userId, query);
  return [...paperTrades.map((trade) => ({ ...presentTradeMemory(trade), executionMode: 'PAPER' as const })), ...testnetTrades]
    .sort((left, right) => memoryTime(right) - memoryTime(left))
    .slice(0, query.limit);
}

export async function getTradeMemoryStats(userId: string, query: TradeMemoryStatsQuery) {
  const where = memoryWhere(userId, query);
  const [aggregate, wins, losses, testnet] = await Promise.all([
    query.source === 'TESTNET' ? null : prisma.paperTrade.aggregate({ where, _count: { _all: true }, _sum: { realizedPnl: true, fees: true, funding: true, slippageCost: true } }),
    query.source === 'TESTNET' ? 0 : prisma.paperTrade.count({ where: { ...where, realizedPnl: { gt: 0 } } }),
    query.source === 'TESTNET' ? 0 : prisma.paperTrade.count({ where: { ...where, realizedPnl: { lt: 0 } } }),
    query.source === 'PAPER' ? emptyStats() : testnetMemoryStats(userId, query),
  ]);
  const paperCount = aggregate?._count._all ?? 0;
  const paperPnl = Number(aggregate?._sum.realizedPnl ?? 0);
  const paperFees = Number(aggregate?._sum.fees ?? 0);
  const paperFunding = Number(aggregate?._sum.funding ?? 0);
  const paperSlippage = Number(aggregate?._sum.slippageCost ?? 0);
  return {
    tradeCount: paperCount + testnet.tradeCount, wins: wins + testnet.wins, losses: losses + testnet.losses,
    netPnl: decimal(paperPnl + testnet.netPnl), fees: decimal(paperFees + testnet.fees),
    funding: decimal(paperFunding + testnet.funding), slippage: decimal(paperSlippage + testnet.slippage),
  };
}

function memoryWhere(userId: string, query: TradeMemoryStatsQuery): Prisma.PaperTradeWhereInput {
  return {
    tradingBot: { userId, type: 'AUTONOMOUS' }, status: { in: [...closedStatuses] },
    ...(query.botId ? { tradingBotId: query.botId } : {}), ...(query.strategyVersionId ? { strategyVersionId: query.strategyVersionId } : {}),
    ...(query.symbol ? { symbol: query.symbol } : {}), ...(query.side ? { side: query.side } : {}),
    ...(query.regime ? { marketRegimeSnapshot: { regime: query.regime } } : {}),
    ...(query.outcome === 'BEST' ? { realizedPnl: { gt: 0 } } : {}), ...(query.outcome === 'FAILURE' ? { realizedPnl: { lt: 0 } } : {}),
  };
}

async function listTestnetClosedTrades(userId: string, query: TradeMemoryStatsQuery & { limit: number }) {
  const fills = await prisma.testnetExecutionFill.findMany({
    where: testnetWhere(userId, query),
    include: {
      tradingBot: { select: { id: true, name: true, configuration: true } },
      strategyVersion: { select: { id: true, version: true, strategy: { select: { id: true, name: true, family: true } } } },
    },
    orderBy: { occurredAt: 'desc' }, take: Math.min(query.limit * 20, 4_000),
  });
  const [entries, orders] = await Promise.all([
    prisma.testnetExecutionFill.findMany({
      where: { userId, reduceOnly: false, tradingBotId: { in: [...new Set(fills.map((fill) => fill.tradingBotId))] }, symbol: { in: [...new Set(fills.map((fill) => fill.symbol))] } },
      select: { tradingBotId: true, symbol: true, commission: true, commissionAsset: true, occurredAt: true }, orderBy: { occurredAt: 'asc' },
    }),
    prisma.tradingOrder.findMany({
      where: { userId, exchangeOrderId: { in: [...new Set(fills.map((fill) => fill.exchangeOrderId))] } },
      select: { exchangeOrderId: true, leverage: true },
    }),
  ]);
  const leverageByOrder = new Map(orders.filter((order) => order.exchangeOrderId).map((order) => [order.exchangeOrderId!, order.leverage]));
  return groupTestnetClosures(fills, entries, leverageByOrder).filter((trade) => query.outcome === 'BEST' ? Number(trade.realizedPnl) > 0 : query.outcome === 'FAILURE' ? Number(trade.realizedPnl) < 0 : true);
}

async function testnetMemoryStats(userId: string, query: TradeMemoryStatsQuery) {
  const rows = await listTestnetClosedTrades(userId, { ...query, limit: 4_000 });
  return { tradeCount: rows.length, wins: rows.filter((row) => Number(row.realizedPnl) > 0).length, losses: rows.filter((row) => Number(row.realizedPnl) < 0).length,
    netPnl: rows.reduce((sum, row) => sum + Number(row.realizedPnl), 0), fees: rows.reduce((sum, row) => sum + Number(row.fees), 0), funding: 0, slippage: 0 };
}

function testnetWhere(userId: string, query: TradeMemoryStatsQuery): Prisma.TestnetExecutionFillWhereInput {
  return {
    userId, reduceOnly: true,
    ...(query.botId ? { tradingBotId: query.botId } : {}),
    ...(query.strategyVersionId ? { strategyVersionId: query.strategyVersionId } : {}),
    ...(query.symbol ? { symbol: query.symbol } : {}),
    ...(query.side ? { side: query.side === 'BUY' ? 'SELL' : 'BUY' } : {}),
    // TESTNET fills currently do not carry a regime snapshot. A regime filter
    // therefore intentionally returns PAPER evidence only instead of inventing context.
    ...(query.regime ? { id: { lt: 0n } } : {}),
  };
}

type TestnetFillWithRelations = Prisma.TestnetExecutionFillGetPayload<{ include: {
  tradingBot: { select: { id: true; name: true; configuration: true } };
  strategyVersion: { select: { id: true; version: true; strategy: { select: { id: true; name: true; family: true } } } };
} }>;

function groupTestnetClosures(fills: TestnetFillWithRelations[], entries: Array<{ tradingBotId: string; symbol: string; commission: Prisma.Decimal; commissionAsset: string; occurredAt: Date }>, leverageByOrder: Map<string, number>) {
  const groups = new Map<string, TestnetFillWithRelations[]>();
  for (const fill of fills) {
    const key = `${fill.tradingBotId}:${fill.exchangeOrderId}`;
    groups.set(key, [...(groups.get(key) ?? []), fill]);
  }
  const previousClose = new Map<string, Date>();
  return [...groups.values()].sort((left, right) => left[0]!.occurredAt.getTime() - right[0]!.occurredAt.getTime()).map((rows) => {
    const first = rows[0]!;
    const quantity = rows.reduce((sum, row) => sum + Number(row.quantity), 0);
    const quote = rows.reduce((sum, row) => sum + Number(row.price) * Number(row.quantity), 0);
    const exitPrice = quantity > 0 ? quote / quantity : Number(first.price);
    const grossPnl = rows.reduce((sum, row) => sum + Number(row.realizedPnl), 0);
    const closeNetPnl = rows.reduce((sum, row) => sum + Number(row.netRealizedPnl), 0);
    const closeFees = rows.filter((row) => ['USDT', 'USDC'].includes(row.commissionAsset)).reduce((sum, row) => sum + Number(row.commission), 0);
    const originalSide = first.side === 'SELL' ? 'BUY' as const : 'SELL' as const;
    const entryPrice = quantity > 0 ? (originalSide === 'BUY' ? exitPrice - grossPnl / quantity : exitPrice + grossPnl / quantity) : exitPrice;
    const occurredAt = rows.reduce((latest, row) => row.occurredAt > latest ? row.occurredAt : latest, first.occurredAt);
    const positionKey = `${first.tradingBotId}:${first.symbol}`;
    const prior = previousClose.get(positionKey);
    const positionEntries = entries.filter((entry) => entry.tradingBotId === first.tradingBotId && entry.symbol === first.symbol && (!prior || entry.occurredAt > prior) && entry.occurredAt <= occurredAt);
    const openedAt = positionEntries[0]?.occurredAt ?? occurredAt;
    const entryFees = positionEntries.filter((entry) => ['USDT', 'USDC'].includes(entry.commissionAsset)).reduce((sum, entry) => sum + Number(entry.commission), 0);
    const fees = closeFees + entryFees;
    const netPnl = closeNetPnl - entryFees;
    previousClose.set(positionKey, occurredAt);
    return {
      id: `testnet:${first.tradingBotId}:${first.exchangeOrderId}`, executionMode: 'TESTNET' as const,
      tradingBotId: first.tradingBotId, strategyVersionId: first.strategyVersionId, symbol: first.symbol, side: originalSide, status: 'CLOSED' as const,
      entryPrice: decimal(entryPrice), exitPrice: decimal(exitPrice), quantity: decimal(quantity), leverage: leverageByOrder.get(first.exchangeOrderId) ?? configNumber(first.tradingBot.configuration, 'leverage') ?? 1,
      fees: decimal(fees), funding: '0', slippageCost: '0', realizedPnl: decimal(netPnl), grossRealizedPnl: decimal(grossPnl),
      stopLoss: null, takeProfit: null, maxFavorableExcursion: null, maxAdverseExcursion: null,
      marketContext: { exchange: 'BINANCE', environment: 'TESTNET', exchangeOrderId: first.exchangeOrderId, submittedToExchange: true },
      closeReason: closeReason(first.orderType), aiConfidence: null, decisionSummary: 'Binance TESTNET reduce-only fill ile kapanan gerçek Demo pozisyonu.',
      openedAt, closedAt: occurredAt, holdingSeconds: Math.max(0, Math.floor((occurredAt.getTime() - openedAt.getTime()) / 1000)), tradingBot: { id: first.tradingBot.id, name: first.tradingBot.name },
      strategyVersion: first.strategyVersion, marketRegimeSnapshot: null,
    };
  });
}

function closeReason(type: string) { return type === 'TAKE_PROFIT_MARKET' ? 'TAKE_PROFIT' : type === 'STOP_MARKET' ? 'STOP_LOSS' : 'MANUAL_OR_RISK_EXIT'; }
function configNumber(value: unknown, key: string) { if (!value || typeof value !== 'object' || Array.isArray(value)) return null; const parsed = Number((value as Record<string, unknown>)[key]); return Number.isFinite(parsed) ? parsed : null; }
function decimal(value: number) { return Number.isFinite(value) ? value.toFixed(8) : '0'; }
function emptyStats() { return { tradeCount: 0, wins: 0, losses: 0, netPnl: 0, fees: 0, funding: 0, slippage: 0 }; }
function memoryTime(value: object) { const record = value as Record<string, unknown>; return Date.parse(String(record.closedAt ?? record.openedAt)); }

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
