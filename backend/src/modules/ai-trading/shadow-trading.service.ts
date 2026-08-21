import type { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { ShadowSummaryQuery, ShadowTradesQuery } from './shadow-trading.schema.js';

export type ShadowPerformanceTrade = {
  action: string;
  fee: number;
  realizedPnl: number;
  cumulativePnl: number;
  totalFees: number;
  occurredAt: Date;
};

export function summarizeShadowPerformance(trades: ShadowPerformanceTrade[], startingBalance: number) {
  const ordered = [...trades].sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime());
  let peak = startingBalance; let maxDrawdown = 0; let grossProfit = 0; let grossLoss = 0;
  for (const trade of ordered) {
    const equity = startingBalance + trade.cumulativePnl - trade.totalFees;
    peak = Math.max(peak, equity);
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, (peak - equity) / peak);
    if (trade.action === 'WOULD_CLOSE') {
      const net = trade.realizedPnl - trade.fee;
      if (net > 0) grossProfit += net;
      if (net < 0) grossLoss += Math.abs(net);
    }
  }
  const first = ordered[0]?.occurredAt ?? null; const last = ordered.at(-1)?.occurredAt ?? null;
  const latest = ordered.at(-1);
  const closeTrades = ordered.filter((trade) => trade.action === 'WOULD_CLOSE');
  const wins = closeTrades.filter((trade) => trade.realizedPnl - trade.fee > 0).length;
  return {
    totalActions: ordered.length,
    wouldOpen: ordered.filter((trade) => trade.action === 'WOULD_OPEN').length,
    wouldClose: closeTrades.length,
    wouldMoveStop: ordered.filter((trade) => trade.action === 'WOULD_MOVE_STOP').length,
    wins, losses: closeTrades.filter((trade) => trade.realizedPnl - trade.fee < 0).length,
    winRate: closeTrades.length > 0 ? wins / closeTrades.length : null,
    realizedPnl: latest?.cumulativePnl ?? 0, totalFees: latest?.totalFees ?? 0,
    netPnl: (latest?.cumulativePnl ?? 0) - (latest?.totalFees ?? 0),
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0,
    maxDrawdown, startedAt: first, lastActionAt: last,
    shadowDurationDays: first && last ? Math.max(0, (last.getTime() - first.getTime()) / 86_400_000) : 0,
  };
}

export async function listShadowTrades(userId: string, query: ShadowTradesQuery) {
  const rows = await prisma.shadowTrade.findMany({
    where: {
      tradingBot: { userId, mode: 'SHADOW' },
      ...(query.botId ? { tradingBotId: query.botId } : {}),
      ...(query.symbol ? { tradingBot: { userId, mode: 'SHADOW', symbol: query.symbol } } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.from || query.to ? { occurredAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}),
    },
    include: { tradingBot: { select: { name: true, symbol: true, lifecycleStatus: true } } },
    orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: query.limit,
  });
  return rows.map(presentShadowTrade);
}

export async function getShadowPerformance(userId: string, query: ShadowSummaryQuery) {
  const bots = await prisma.tradingBot.findMany({
    where: { userId, mode: 'SHADOW', ...(query.botId ? { id: query.botId } : {}) },
    select: {
      id: true, name: true, symbol: true, lifecycleStatus: true, startingPaperBalance: true,
      metrics: { where: { score: { not: null } }, orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }], take: 1, select: { score: true } },
      shadowTrades: {
        where: query.from || query.to ? { occurredAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {},
        orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }], take: 5_000,
        select: { action: true, fee: true, realizedPnl: true, cumulativePnl: true, totalFees: true, occurredAt: true },
      },
    },
    orderBy: { id: 'asc' },
  });
  return bots.map((bot) => ({
    botId: bot.id, botName: bot.name, symbol: bot.symbol, lifecycleStatus: bot.lifecycleStatus,
    riskAdjustedScore: bot.metrics[0]?.score?.toNumber() ?? null,
    ...summarizeShadowPerformance(bot.shadowTrades.map((trade) => ({
      ...trade, fee: trade.fee.toNumber(), realizedPnl: trade.realizedPnl.toNumber(),
      cumulativePnl: trade.cumulativePnl.toNumber(), totalFees: trade.totalFees.toNumber(),
    })), bot.startingPaperBalance.toNumber()),
    paperIncluded: false, orderSubmitted: false, liveActivated: false,
  }));
}

function presentShadowTrade(row: {
  id: bigint; decisionId: bigint; tradingBotId: string; action: string; side: string | null;
  quantity: Prisma.Decimal | null; markPrice: Prisma.Decimal; simulatedFillPrice: Prisma.Decimal | null;
  notional: Prisma.Decimal | null; fee: Prisma.Decimal; realizedPnl: Prisma.Decimal; netQuantity: Prisma.Decimal;
  avgEntryPrice: Prisma.Decimal; cumulativePnl: Prisma.Decimal; totalFees: Prisma.Decimal; unrealizedPnl: Prisma.Decimal;
  slippageBps: Prisma.Decimal | null; feeBps: Prisma.Decimal | null; stopPrice: Prisma.Decimal | null;
  occurredAt: Date; createdAt: Date; tradingBot: { name: string; symbol: string; lifecycleStatus: string };
}) {
  return {
    ...row, id: row.id.toString(), decisionId: row.decisionId.toString(),
    quantity: row.quantity?.toString() ?? null, markPrice: row.markPrice.toString(),
    simulatedFillPrice: row.simulatedFillPrice?.toString() ?? null, notional: row.notional?.toString() ?? null,
    fee: row.fee.toString(), realizedPnl: row.realizedPnl.toString(), netQuantity: row.netQuantity.toString(),
    avgEntryPrice: row.avgEntryPrice.toString(), cumulativePnl: row.cumulativePnl.toString(),
    totalFees: row.totalFees.toString(), unrealizedPnl: row.unrealizedPnl.toString(),
    slippageBps: row.slippageBps?.toString() ?? null, feeBps: row.feeBps?.toString() ?? null,
    stopPrice: row.stopPrice?.toString() ?? null, paperIncluded: false, submittedToExchange: false,
  };
}
