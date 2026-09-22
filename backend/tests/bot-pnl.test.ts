import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ account: vi.fn(), sync: vi.fn(), execute: vi.fn(), query: vi.fn(), rootQuery: vi.fn(), update: vi.fn(), audit: vi.fn(), tx: vi.fn() }));
vi.mock('../src/database/prisma.js', () => ({ prisma: { $transaction: m.tx, $executeRaw: m.execute, $queryRaw: m.rootQuery } }));
vi.mock('../src/modules/trading/exchange-account.service.js', () => ({ ownedAccount: m.account }));
vi.mock('../src/modules/ai-trading/testnet-operations.service.js', () => ({ syncTestnetBotPnlHistory: m.sync }));
import { getBotPnl, getPnlDayDetails, recordBotPnl, resetBotPnl, summarizePnl } from '../src/modules/trading/bot-pnl.service.js';
import { gridPnlEntries } from '../src/modules/trading/grid-pnl.js';
import { pnlQuery } from '../src/modules/trading/bot-pnl.routes.js';
beforeEach(() => {
  vi.clearAllMocks(); m.account.mockResolvedValue({ id: 'a' }); m.query.mockResolvedValue([{ resetAt: null }]); m.rootQuery.mockResolvedValue([]); m.sync.mockResolvedValue(true);
  m.tx.mockImplementation(fn => fn({ exchangeAccount: { update: m.update }, $executeRaw: m.execute, $queryRaw: m.query, tradingAuditLog: { create: m.audit } }));
});
describe('bot PnL calendar', () => {
  it('returns the database report without requesting exchange history', async () => {
    m.account.mockResolvedValue({ id: 'a', provider: 'BINANCE', accountType: 'USDT_M', environment: 'TESTNET' });
    m.rootQuery.mockImplementation(async sql => sql.join('').includes('bot_pnl_entries') ? [{ sourceId: 'x', botId: 'b', occurredAt: new Date('2026-09-01T10:00:00Z'), net: '5', feesComplete: true }] : []);
    const report = await getBotPnl('u', 'a', '2026-09-01', '2026-09-01');
    expect(report.totalNet).toBe('5'); expect(m.sync).not.toHaveBeenCalled(); expect(m.execute).not.toHaveBeenCalled();
  });
  it('sums positive and negative values exactly, preserves zero trade days and empty days', () => {
    const entries = ['0.1', '0.2', '-0.3'].map((net, i) => ({ sourceId: String(i), botId: 'b', occurredAt: new Date('2026-09-01T10:00:00Z'), net, feesComplete: true }));
    const result = summarizePnl('2026-09-01', '2026-09-02', entries);
    expect(result.totalNet).toBe('0'); expect(result.days[0]).toMatchObject({ count: 3, profit: '0.3', loss: '-0.3', net: '0' });
    expect(result.days[1]).toMatchObject({ count: 0, net: '0' });
  });
  it('uses Istanbul midnight and refuses a known net when fees are missing', () => {
    const result = summarizePnl('2026-09-01', '2026-09-02', [{ sourceId: 'x', botId: 'b', occurredAt: new Date('2026-09-01T21:00:00Z'), net: '7', feesComplete: false }]);
    expect(result.days[0]!.count).toBe(0); expect(result.days[1]!.net).toBeNull(); expect(result.totalNet).toBeNull();
  });
  it('splits daily details into profit and loss and returns requested totals', async () => {
    m.rootQuery.mockResolvedValue([
      { sourceId: 'a', botId: '', occurredAt: new Date('2026-09-14T10:00:00Z'), net: '4', feesComplete: true, symbol: 'BTCUSDT', leverage: 5, tradeNotional: '100', source: 'MANUAL' },
      { sourceId: 'b', botId: '', occurredAt: new Date('2026-09-14T11:00:00Z'), net: '-2', feesComplete: true, symbol: 'ETHUSDT', leverage: 10, tradeNotional: '200', source: 'MANUAL' },
    ]);
    const detail = await getPnlDayDetails('u', 'a', '2026-09-14');
    expect(detail.profits).toHaveLength(1); expect(detail.losses).toHaveLength(1);
    expect(detail.summary).toEqual({ totalTrades: 2, totalNotional: '300', totalProfit: '4', totalLoss: '-2', totalNet: '2' });
  });
  it('validates real dates and bounded ordered ranges', () => {
    for (const [start, end] of [['2026-02-30', '2026-03-01'], ['2026-09-02', '2026-09-01'], ['2020-01-01', '2026-01-01']]) expect(pnlQuery.safeParse({ exchangeAccountId: 'a', start, end }).success).toBe(false);
    expect(pnlQuery.safeParse({ exchangeAccountId: 'a', start: '2024-02-29', end: '2024-03-01' }).success).toBe(true);
  });
  it('reset deletes only the owned account ledger and atomically stores a new start', async () => {
    await resetBotPnl('u', 'a'); expect(m.account).toHaveBeenCalledWith('u', 'a');
    const deletion = m.execute.mock.calls.find(call => call[0].join('').includes('DELETE FROM'));
    expect(deletion?.slice(1)).toEqual(['u', 'a']); expect(m.audit).toHaveBeenCalled(); expect(m.tx).toHaveBeenCalledTimes(1);
  });
  it('does not restore old fills after reset, including fills arriving late', async () => {
    m.query.mockResolvedValue([{ resetAt: new Date('2026-09-02T10:00:00Z') }]);
    await recordBotPnl('u', 'a', ['2026-09-01T10:00:00Z', '2026-09-02T10:00:01Z'].map((d, i) => ({ sourceId: String(i), botId: 'b', occurredAt: new Date(d), net: '1', feesComplete: true })));
    const inserts = m.execute.mock.calls.filter(call => call[0].join('').includes('INSERT INTO bot_pnl_entries'));
    expect(inserts).toHaveLength(1); expect(inserts[0]!.slice(1, 5)).toEqual(['a', '1', 'u', 'b']);
    expect(inserts[0]![0].join('')).toContain('ON DUPLICATE KEY UPDATE');
  });
  it('does not record results before the 1 July 2026 accounting start', async () => {
    await recordBotPnl('u', 'a', [{ sourceId: 'old', botId: 'b', occurredAt: new Date('2026-06-30T20:59:59Z'), net: '1', feesComplete: true }]);
    expect(m.execute.mock.calls.some(call => call[0].join('').includes('INSERT INTO bot_pnl_entries'))).toBe(false);
  });
  it('rejects reset before any mutation for an inaccessible account', async () => {
    m.account.mockRejectedValue(new Error('not owned')); await expect(resetBotPnl('u', 'other')).rejects.toThrow('not owned'); expect(m.tx).not.toHaveBeenCalled();
  });
  it('assigns partial grid exits to actual exchange execution dates and honors exchange realized PnL', () => {
    const entry = { status: 'FILLED', executed: '2', quote: '200', fee: '2', baseFee: '0', feesComplete: true };
    const result = gridPnlEntries('bot', 'ETHUSDT', 'LONG', entry, [{ ...entry, executions: [{ id: 'a', time: Date.parse('2026-09-01T20:59:00Z'), quantity: '1', quote: '120', fee: '1', feesComplete: true, realizedPnl: '15' }, { id: 'b', time: Date.parse('2026-09-01T21:01:00Z'), quantity: '1', quote: '90', fee: '1', feesComplete: true, realizedPnl: '-5' }] }]);
    expect(result.map(r => r.net)).toEqual(['13', '-7']);
    expect(summarizePnl('2026-09-01', '2026-09-02', result).days.map(d => d.net)).toEqual(['13', '-7']);
  });
});
