import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ account: vi.fn(), orders: vi.fn(), trades: vi.fn(), record: vi.fn(), resolve: vi.fn() }));
vi.mock('../src/database/prisma.js', () => ({ prisma: { tradingOrder: { findMany: m.orders } } }));
vi.mock('../src/modules/trading/exchange-account.service.js', () => ({ ownedAccount: m.account, adapterFor: () => ({ getUserTrades: m.trades, getConditionalExecutionOrderId: m.resolve }), exchangeCall: (fn: () => unknown) => fn() }));
vi.mock('../src/modules/trading/bot-pnl.service.js', () => ({ BOT_PNL_ACCOUNTING_START: new Date('2026-07-01T00:00:00+03:00'), recordBotPnl: m.record }));
import { platformFillEntries, readTradeWindow, syncPlatformPnlHistory } from '../src/modules/trading/platform-pnl-sync.js';
import type { ExchangeTrade } from '../src/modules/trading/exchanges/exchange-adapter.js';
const fill = (extra: Partial<ExchangeTrade> = {}): ExchangeTrade => ({ symbol: 'ETHUSDT', tradeId: '1', exchangeOrderId: 'manual', side: 'SELL', price: '2500', quantity: '1', quoteQuantity: '2500', realizedPnl: '10.1', commission: '0.2', commissionAsset: 'USDT', maker: false, occurredAt: '2026-09-14T10:00:00Z', ...extra });
beforeEach(() => { vi.clearAllMocks(); m.account.mockResolvedValue({ provider: 'BINANCE', accountType: 'USDT_M' }); m.orders.mockResolvedValue([{ symbol: 'ETHUSDT', exchangeOrderId: 'manual', type: 'MARKET', status: 'FILLED', createdAt: new Date('2026-09-01') }]); m.trades.mockResolvedValue([fill()]); });
it('includes manual and bulk fills, entry fees and partial closes without counting external orders or duplicates', () => {
  const close = fill();
  const entries = platformFillEntries([close, close, fill({ tradeId: '2', realizedPnl: '-3', exchangeOrderId: 'bulk' }), fill({ tradeId: '3', realizedPnl: '0' }), fill({ tradeId: '4', exchangeOrderId: 'external' })], new Map([['ETHUSDT:manual', { leverage: 5, source: 'MANUAL' }], ['ETHUSDT:bulk', { leverage: 10, source: 'MANUAL' }]]));
  expect(entries.map(e => e.net)).toEqual(['9.9', '-3.2', '-0.2']);
  expect(entries[0]!.sourceId).toBe('fill:ETHUSDT:1');
});
it('never assumes a non-stablecoin fee is zero', () => {
  expect(platformFillEntries([fill({ commissionAsset: 'BNB' })], new Map([['ETHUSDT:manual', { leverage: 5, source: 'MANUAL' }]]))[0]!.feesComplete).toBe(false);
});
it('imports history with no bot dependency and excludes grid orders from the separate ledger', async () => {
  expect(await syncPlatformPnlHistory('u', 'a', '2026-09-01', '2026-09-14')).toEqual({ state: 'ready' });
  expect(m.orders.mock.calls[0]![0].where).toMatchObject({ userId: 'u', exchangeAccountId: 'a', source: { not: 'GRID_BOT' } });
  expect(m.record).toHaveBeenCalled();
  expect(m.trades.mock.calls.every(c => c[2].endTime - c[2].startTime < 7 * 86400000)).toBe(true);
});
it('splits saturated pages without skipping boundary fills', async () => {
  const read = vi.fn(async (a: number, b: number) => a === 0 && b === 9 ? Array(1000).fill(fill()) : [fill({ tradeId: String(a) })]);
  expect((await readTradeWindow(read, 0, 9)).map(row => row.tradeId)).toEqual(['0', '5']);
  expect(read.mock.calls).toEqual([[0, 9], [0, 4], [5, 9]]);
});
it('reports a history failure instead of pretending an empty account', async () => {
  m.trades.mockRejectedValue(new Error('offline'));
  expect((await syncPlatformPnlHistory('u', 'a', '2026-09-01', '2026-09-14')).state).toBe('error');
  expect(m.record).not.toHaveBeenCalled();
});
it('checks ownership before history reads', async () => {
  m.account.mockRejectedValue(new Error('not owned'));
  await expect(syncPlatformPnlHistory('u', 'other', '2026-09-01', '2026-09-14')).rejects.toThrow('not owned');
  expect(m.trades).not.toHaveBeenCalled();
});
it('matches triggered TP/SL to the actual order and skips already reconciled execution IDs', async () => {
  m.orders.mockResolvedValue([{ symbol: 'ETHUSDT', exchangeOrderId: 'algo', clientOrderId: 'protect', type: 'TAKE_PROFIT_MARKET', status: 'FILLED', createdAt: new Date('2026-09-14') }]);
  m.resolve.mockResolvedValue('manual');
  expect((await syncPlatformPnlHistory('u', 'a', '2026-09-14', '2026-09-14')).state).toBe('ready');
  expect(m.record.mock.calls[0]![2][0].net).toBe('9.9');
  expect(m.resolve).toHaveBeenCalledWith('algo', 'ETHUSDT', 'protect');
  m.resolve.mockClear();
  m.orders.mockResolvedValue([{ symbol: 'ETHUSDT', exchangeOrderId: 'manual', type: 'STOP_MARKET', status: 'FILLED', createdAt: new Date('2026-09-14') }]);
  await syncPlatformPnlHistory('u', 'a', '2026-09-14', '2026-09-14');
  expect(m.resolve).not.toHaveBeenCalled();
});
