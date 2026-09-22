import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ account: vi.fn(), symbols: vi.fn(), price: vi.fn(), snapshot: vi.fn(), universe: vi.fn(),
  batchCreate: vi.fn(), batchFind: vi.fn(), claim: vi.fn(), createPreview: vi.fn(), submit: vi.fn(), orderFind: vi.fn(),
  orderRequired: vi.fn(), orderList: vi.fn(), cancel: vi.fn(), audit: vi.fn() }));
vi.mock('../src/database/prisma.js', () => ({ prisma: {
  tradingUniverseAsset: { findMany: m.universe }, manualOrderBatch: { create: m.batchCreate, findFirst: m.batchFind,
    findUniqueOrThrow: m.batchFind, updateMany: m.claim },
  tradingOrder: { findUnique: m.orderFind, findUniqueOrThrow: m.orderRequired, findMany: m.orderList },
  tradingAuditLog: { create: m.audit },
  $transaction: (operation: (tx: unknown) => unknown) => operation({ manualOrderBatch: { updateMany: m.claim }, tradingAuditLog: { create: m.audit } }),
} }));
vi.mock('../src/modules/trading/exchange-account.service.js', () => ({ ownedAccount: m.account }));
vi.mock('../src/modules/trading/trading-engine.client.js', () => ({ getTradingEngineSnapshot: m.snapshot }));
vi.mock('../src/modules/trading/manual-trading.service.js', () => ({ listSymbols: m.symbols, getSymbolMarkPrice: m.price,
  createOrderPreview: m.createPreview, submitOrder: m.submit, cancelOpenOrder: m.cancel }));
vi.mock('../src/modules/ai-trading/trading-universe.service.js', () => ({ CORE_TRADING_UNIVERSE: [['bitcoin', 'Bitcoin', 'BTC']] }));
import { batchCandidates, batchInputSchema, batchLevels, confirmBatch, executeBatchItem, getBatch, previewBatch, type BatchInput, type BatchItem } from '../src/modules/trading/manual-batch.service.js';
import { monitorManualBatch, runManualBatch } from '../src/modules/trading/manual-batch.worker.js';

const input: BatchInput = { exchangeAccountId: 'cm00000000000000000000001', symbols: ['BTCUSDT'], side: 'BUY', initialMargin: '100', leverage: 5, stopLossPercent: 10, takeProfitPercent: 2 };
const account = { id: input.exchangeAccountId, userId: 'user-a', isActive: true, canTrade: true, connectionStatus: 'CONNECTED', executionEngine: 'GO', provider: 'BINANCE', environment: 'TESTNET', accountType: 'USDT_M' };
const item = (): BatchItem => ({ symbol: 'BTCUSDT', ...batchLevels('100', '0.01', '0.1', input), status: 'PENDING' });
beforeEach(() => {
  vi.resetAllMocks();
  m.account.mockResolvedValue(account);
  m.universe.mockResolvedValue([{ symbol: 'BTCUSDT', enabled: true }, { symbol: 'ETHUSDT', enabled: false }]);
  m.symbols.mockResolvedValue([{ symbol: 'BTCUSDT', baseAsset: 'BTC', stepSize: '0.01', tickSize: '0.1', minQuantity: '0.01', maxQuantity: '100', minNotional: '5', maxLeverage: 20 }]);
  m.price.mockResolvedValue({ markPrice: '100' });
  m.snapshot.mockResolvedValue({ balances: [{ walletType: 'USD_M_FUTURES', asset: 'USDT', availableBalance: '1000' }], positions: [], orders: [] });
  m.batchCreate.mockImplementation(async ({ data }) => data);
  m.createPreview.mockResolvedValue({ id: 'preview-id' });
  m.submit.mockResolvedValue({ status: 'FILLED' });
  m.orderFind.mockResolvedValue(null);
  m.orderRequired.mockImplementation(async ({ where }) => ({ id: where.userId_idempotencyKey.idempotencyKey, status: where.userId_idempotencyKey.idempotencyKey.endsWith('_entry') ? 'FILLED' : 'OPEN' }));
  m.claim.mockResolvedValue({ count: 1 });
});

it('loads real symbols and saved defaults without requiring any bot model', async () => {
  const result = await batchCandidates('user-a', account.id);
  expect(result).toMatchObject({ availableBalance: '1000', symbols: [{ symbol: 'BTCUSDT', selectedByDefault: true }] });
});
it('preview persists immutable price/quantity/TP/SL without submitting an order', async () => {
  const result = await previewBatch('user-a', input);
  expect(result).toMatchObject({ status: 'PREVIEW', totalMargin: '100', totalNotional: '500', items: [{ quantity: '5', stopLoss: '90', takeProfit: '102' }] });
  expect(m.submit).not.toHaveBeenCalled();
  expect(m.createPreview).not.toHaveBeenCalled();
});
it('short levels have the opposite direction and quantities use decimal step rounding', () => {
  expect(batchLevels('100', '0.01', '0.1', { ...input, side: 'SELL' })).toMatchObject({ stopLoss: '110', takeProfit: '98' });
  expect(batchLevels('3', '0.1', '0.01', { ...input, initialMargin: '1', leverage: 1 }).quantity).toBe('0.3');
  expect(() => batchLevels('1', '0.01', '1', input)).toThrow();
});
it('rejects duplicate symbols and invalid percentages', () => {
  expect(batchInputSchema.safeParse({ ...input, symbols: ['BTCUSDT', 'BTCUSDT'] }).success).toBe(false);
  expect(batchInputSchema.safeParse({ ...input, stopLossPercent: 100 }).success).toBe(false);
});
it('rejects an unavailable account and insufficient aggregate balance', async () => {
  m.account.mockResolvedValueOnce({ ...account, environment: 'LIVE' });
  await expect(previewBatch('user-a', input)).rejects.toMatchObject({ code: 'BATCH_ACCOUNT_NOT_READY' });
  await expect(previewBatch('user-a', { ...input, initialMargin: '1100' })).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
  expect(m.batchCreate).not.toHaveBeenCalled();
});
it('scopes lookup to both owner and account', async () => {
  m.batchFind.mockResolvedValue(null);
  await expect(getBatch('other-user', 'batch-id', 'other-account')).rejects.toMatchObject({ code: 'BATCH_NOT_FOUND' });
  expect(m.batchFind).toHaveBeenCalledWith({ where: { id: 'batch-id', userId: 'other-user', exchangeAccountId: 'other-account' } });
});
it('expired preview cannot be confirmed; repeated confirmation does not enqueue twice', async () => {
  m.batchFind.mockResolvedValue({ id: 'batch-id', exchangeAccountId: account.id, status: 'PREVIEW', expiresAt: new Date(0), plan: {} });
  await expect(confirmBatch('user-a', 'batch-id', account.id)).rejects.toMatchObject({ code: 'BATCH_EXPIRED' });
  m.batchFind.mockResolvedValue({ id: 'batch-id', exchangeAccountId: account.id, status: 'QUEUED', expiresAt: new Date(0), plan: {} });
  expect((await confirmBatch('user-a', 'batch-id', account.id)).status).toBe('QUEUED');
  expect(m.claim).not.toHaveBeenCalled();
});
it('confirmation queues and audits the immutable preview once', async () => {
  const stored = { id: 'batch-id', exchangeAccountId: account.id, status: 'PREVIEW', expiresAt: new Date(Date.now() + 60_000), plan: { input, items: [item()] } };
  m.batchFind.mockResolvedValueOnce(stored).mockResolvedValueOnce({ ...stored, status: 'QUEUED' });
  const result = await confirmBatch('user-a', 'batch-id', account.id);
  expect(result.status).toBe('QUEUED');
  expect(m.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'MANUAL_BATCH_CONFIRMED', entityId: 'batch-id' }) });
});
it('submits an entry then separate reduce-only SL/TP using immutable levels', async () => {
  const result = await executeBatchItem('user-a', 'batch-id', input, item());
  expect(result.status).toBe('PROTECTED');
  expect(m.createPreview.mock.calls.map(c => c[1])).toEqual([
    expect.objectContaining({ type: 'MARKET', side: 'BUY', reduceOnly: false, quantity: '5' }),
    expect.objectContaining({ type: 'STOP_MARKET', side: 'SELL', reduceOnly: true, stopPrice: '90' }),
    expect.objectContaining({ type: 'TAKE_PROFIT_MARKET', side: 'SELL', reduceOnly: true, stopPrice: '102' }),
  ]);
  expect(new Set(m.submit.mock.calls.map(c => c[1].idempotencyKey)).size).toBe(3);
});
it('recovery reuses a filled entry and existing protection rather than resubmitting', async () => {
  m.orderFind.mockImplementation(async ({ where }) => ({ id: 'existing', status: where.userId_idempotencyKey.idempotencyKey.endsWith('_entry') ? 'FILLED' : 'OPEN' }));
  expect((await executeBatchItem('user-a', 'batch-id', input, item())).status).toBe('PROTECTED');
  expect(m.submit).not.toHaveBeenCalled();
});
it.each(['FAILED', 'SUBMITTING', 'RECONCILIATION_REQUIRED', 'PARTIALLY_FILLED'])('does not send more orders when entry state is %s', async status => {
  m.orderFind.mockResolvedValue({ id: 'existing', status });
  expect((await executeBatchItem('user-a', 'batch-id', input, item())).status).toBe('ATTENTION');
  expect(m.submit).not.toHaveBeenCalled();
});
it('reports a filled entry with failed protection honestly', async () => {
  m.submit.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('timeout'));
  const result = await executeBatchItem('user-a', 'batch-id', input, item());
  expect(result.status).toBe('ATTENTION'); expect(result.entryId).toBeDefined();
  expect(m.submit).toHaveBeenCalledTimes(2);
});
it('requires a database lease before execution', async () => {
  m.claim.mockResolvedValue({ count: 0 });
  await runManualBatch('batch-id');
  expect(m.batchFind).not.toHaveBeenCalled(); expect(m.submit).not.toHaveBeenCalled();
});
it('attempts every entry before starting protection and reports failed entries', async () => {
  m.batchFind.mockResolvedValue({ userId: 'user-a', plan: { input, items: [item(), { ...item(), symbol: 'ETHUSDT' }] } });
  await runManualBatch('batch-id');
  const orderTypes = m.createPreview.mock.calls.map(call => call[1].type);
  expect(orderTypes.slice(0, 2)).toEqual(['MARKET', 'MARKET']);
  expect(orderTypes.slice(2)).not.toContain('MARKET');
  const saved = m.claim.mock.calls.at(-1)![0].data;
  expect(saved.status).toBe('COMPLETED');
  expect(saved.plan.items.map((i: BatchItem) => i.status)).toEqual(['PROTECTED', 'PROTECTED']);
});
it('does not skip other entry attempts when one entry needs attention', async () => {
  m.batchFind.mockResolvedValue({ userId: 'user-a', plan: { input, items: [item(), { ...item(), symbol: 'ETHUSDT' }] } });
  m.orderFind.mockImplementation(async ({ where }) => where.userId_idempotencyKey.idempotencyKey.includes('BTCUSDT_entry') ? { id: 'failed', status: 'FAILED' } : null);
  await runManualBatch('batch-id');
  const saved = m.claim.mock.calls.at(-1)![0].data;
  expect(saved.status).toBe('ATTENTION');
  expect(saved.plan.items.map((i: BatchItem) => i.status)).toEqual(['ATTENTION', 'PROTECTED']);
  expect(m.createPreview.mock.calls.some(call => call[1].symbol === 'ETHUSDT' && call[1].type === 'MARKET')).toBe(true);
});
it('cleans up remaining exchange protection after the position closes', async () => {
  m.batchFind.mockResolvedValue({ userId: 'user-a', exchangeAccountId: account.id, plan: { input, items: [{ ...item(), status: 'PROTECTED', slId: 'sl', tpId: 'tp' }] } });
  m.orderList.mockResolvedValue([{ id: 'sl', status: 'FILLED', exchangeOrderId: 'sl-ex' }, { id: 'tp', status: 'OPEN', exchangeOrderId: 'tp-ex' }]);
  m.snapshot.mockResolvedValue({ positions: [], orders: [{ symbol: 'BTCUSDT', exchangeOrderId: 'tp-ex' }] });
  await monitorManualBatch('batch-id');
  expect(m.cancel).toHaveBeenCalledWith('user-a', 'tp-ex', expect.objectContaining({ exchangeAccountId: account.id, symbol: 'BTCUSDT' }));
  expect(m.claim.mock.calls.at(-1)![0].data.status).toBe('SETTLED');
});
