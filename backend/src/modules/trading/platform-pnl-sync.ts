import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { adapterFor, exchangeCall, ownedAccount } from './exchange-account.service.js';
import { BOT_PNL_ACCOUNTING_START, recordBotPnl, type PnlEntry } from './bot-pnl.service.js';
import type { ExchangeTrade } from './exchanges/exchange-adapter.js';
import { logger } from '../../utils/logger.js';

export type PnlSyncStatus = { state: 'syncing' | 'ready' | 'error' | 'unsupported'; message?: string; failedReads?: Array<{ symbol: string; stage: string; code: string }> };
let scheduledSyncRunning = false;

function istanbulDate(offsetDays = 0) {
  return new Date(Date.now() + 3 * 3600000 + offsetDays * 86400000).toISOString().slice(0, 10);
}

export function schedulePlatformPnlSync() {
  const execute = async () => {
    if (scheduledSyncRunning) return;
    scheduledSyncRunning = true;
    try {
      const accounts = await prisma.exchangeAccount.findMany({
        where: { isActive: true, provider: 'BINANCE', accountType: 'USDT_M' },
        select: { id: true, userId: true },
      });
      const start = istanbulDate(-1), end = istanbulDate();
      for (const account of accounts) {
        const status = await syncPlatformPnlHistory(account.userId, account.id, start, end);
        if (status.state === 'error') logger.warn({ accountId: account.id, failedReads: status.failedReads }, 'platform PnL history sync incomplete');
      }
    } catch (error) { logger.error({ err: error }, 'platform PnL history sync failed'); }
    finally { scheduledSyncRunning = false; }
  };
  const startup = setTimeout(() => void execute(), 5_000);
  const timer = setInterval(() => void execute(), 60_000);
  startup.unref(); timer.unref();
  return () => { clearTimeout(startup); clearInterval(timer); };
}

type OrderMeta = { leverage: number; source: string };
export function platformFillEntries(trades: ExchangeTrade[], orderKeys: Map<string, OrderMeta>): PnlEntry[] {
  const unique = new Map<string, PnlEntry>();
  for (const trade of trades) {
    const meta = orderKeys.get(`${trade.symbol}:${trade.exchangeOrderId}`);
    if (!meta) continue;
    const stableFee = ['USDT', 'USDC'].includes(trade.commissionAsset);
    const fee = new Prisma.Decimal(trade.commission);
    const sourceId = `fill:${trade.symbol}:${trade.tradeId}`;
    unique.set(sourceId, {
      sourceId, botId: '', occurredAt: new Date(trade.occurredAt),
      net: new Prisma.Decimal(trade.realizedPnl).sub(stableFee ? fee : 0).toFixed(),
      feesComplete: fee.isZero() || stableFee,
      symbol: trade.symbol, leverage: meta.leverage, tradeNotional: trade.quoteQuantity, source: meta.source,
    });
  }
  return [...unique.values()];
}

// Split saturated windows: neither the most recent 1000 fills nor one global order limit
// can silently hide older/manual executions. Inclusive millisecond boundaries do not overlap.
export async function readTradeWindow(read: (start: number, end: number) => Promise<ExchangeTrade[]>, start: number, end: number): Promise<ExchangeTrade[]> {
  const rows = await read(start, end);
  if (rows.length < 1000) return rows;
  if (start === end) throw new Error('Trade history window saturated');
  const middle = Math.floor((start + end) / 2);
  return [...await readTradeWindow(read, start, middle), ...await readTradeWindow(read, middle + 1, end)];
}

export async function syncPlatformPnlHistory(userId: string, accountId: string, start: string, end: string): Promise<PnlSyncStatus> {
  const account = await ownedAccount(userId, accountId);
  if (account.provider !== 'BINANCE' || account.accountType !== 'USDT_M') return {
    state: 'unsupported', message: 'Bu hesapta manuel işlem geçmişi aktarımı henüz desteklenmiyor. Kayıtlı grid sonuçları gösteriliyor.',
  };
  const from = Math.max(BOT_PNL_ACCOUNTING_START.getTime(), Date.parse(`${start}T00:00:00+03:00`));
  const to = Math.min(Date.now(), Date.parse(`${end}T00:00:00+03:00`) + 86400000 - 1);
  if (from > to) return { state: 'ready' };
  const orders = await prisma.tradingOrder.findMany({
    where: { userId, exchangeAccountId: accountId, source: { not: 'GRID_BOT' }, exchangeOrderId: { not: null }, createdAt: { lte: new Date(to) }, OR: [{ updatedAt: { gte: new Date(from) } }, { status: { in: ['OPEN', 'PARTIALLY_FILLED', 'RECONCILIATION_REQUIRED', 'CANCELING', 'CLOSING'] } }] },
    select: { symbol: true, exchangeOrderId: true, clientOrderId: true, type: true, createdAt: true, status: true, leverage: true, source: true },
  });
  const adapter = adapterFor(account);
  if (!adapter.getUserTrades) throw new Error('Trade history unavailable');
  const keys = new Map(orders.map(order => [`${order.symbol}:${order.exchangeOrderId}`, { leverage: order.leverage, source: order.source }]));
  let incomplete = false;
  const failedReads: NonNullable<PnlSyncStatus['failedReads']> = [];
  const failed = (symbol: string, stage: string, error: unknown) => {
    incomplete = true;
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'HISTORY_UNAVAILABLE';
    if (!failedReads.some(item => item.symbol === symbol && item.stage === stage && item.code === code)) failedReads.push({ symbol, stage, code });
  };
  const symbols = [...new Set(orders.map(order => order.symbol))];
  for (let i = 0; i < symbols.length; i += 3) {
    await Promise.all(symbols.slice(i, i + 3).map(async symbol => {
      try {
        const local = orders.filter(order => order.symbol === symbol);
        const trades: ExchangeTrade[] = [];
        const earliest = Math.max(from, Math.min(...local.map(order => order.createdAt.getTime())) - 86400000);
        for (let cursor = earliest; cursor <= to; cursor += 7 * 86400000) {
          const until = Math.min(to, cursor + 7 * 86400000 - 1);
          trades.push(...await readTradeWindow((a, b) => exchangeCall(() => adapter.getUserTrades!(symbol, 1000, { startTime: a, endTime: b })), cursor, until));
        }
        const filledOrderIds = new Set(trades.map(trade => trade.exchangeOrderId));
        for (const order of local.filter(order => !['CANCELED', 'FAILED', 'REJECTED', 'EXPIRED'].includes(order.status) && ['STOP_MARKET', 'TAKE_PROFIT_MARKET', 'STOP', 'TAKE_PROFIT'].includes(order.type))) {
          // Reconciliation may already have replaced the algo ID with its actual execution ID.
          if (filledOrderIds.has(order.exchangeOrderId!)) continue;
          if (!adapter.getConditionalExecutionOrderId) continue;
          try {
            const actual = await exchangeCall(() => adapter.getConditionalExecutionOrderId!(order.exchangeOrderId!, symbol, order.clientOrderId));
            if (actual) keys.set(`${symbol}:${actual}`, { leverage: order.leverage, source: order.source });
          } catch (error) { failed(symbol, 'conditional-order', error); }
        }
        const entries = platformFillEntries(trades, keys);
        for (let offset = 0; offset < entries.length; offset += 100) await recordBotPnl(userId, accountId, entries.slice(offset, offset + 100));
      } catch (error) { failed(symbol, 'fills', error); }
    }));
  }
  return incomplete ? { state: 'error', failedReads, message: 'Borsa geçmişinin bir bölümü doğrulanamadı. Aktarılan sonuçlar gösteriliyor; eksik işlemler olabilir.' } : { state: 'ready' };
}
