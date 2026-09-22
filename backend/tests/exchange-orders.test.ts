import { beforeEach, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
const m = vi.hoisted(() => ({ account: vi.fn(), read: vi.fn(), preview: vi.fn(), place: vi.fn(), cancel: vi.fn(), find: vi.fn(), list: vi.fn(), create: vi.fn(), upsert: vi.fn(), audit: vi.fn(), auditUpdate: vi.fn(), batches: vi.fn(), batchUpdate: vi.fn(), claim: vi.fn() }));
vi.mock('../src/modules/trading/exchange-account.service.js', () => ({ ownedAccount: m.account }));
vi.mock('../src/modules/trading/trading-engine.client.js', () => ({ getTradingEngineOpenOrders: m.read, previewTradingEngineOrder: m.preview, executeTradingEngineOrder: m.place, cancelTradingEngineOrder: m.cancel }));
vi.mock('../src/database/prisma.js', () => {
  const db = { tradingOrder: { findFirst: m.find, findMany: m.list, create: m.create, upsert: m.upsert }, tradingAuditLog: { create: m.audit, update: m.auditUpdate }, manualOrderBatch: { findMany: m.batches, updateMany: m.claim, update: m.batchUpdate } };
  return { prisma: { ...db, $transaction: (fn: (tx: unknown) => unknown) => fn(db) } };
});
import { exchangeOrders, editExchangeOrder, cancelExchangeOrder } from '../src/modules/trading/exchange-orders.service.js';
const account = { id: 'account', userId: 'user', isActive: true, canTrade: true, connectionStatus: 'CONNECTED', executionEngine: 'GO', environment: 'TESTNET', accountType: 'USDT_M' };
const order = { exchangeOrderId: '123', clientOrderId: 'client', symbol: 'BTCUSDT', side: 'SELL', type: 'TAKE_PROFIT_MARKET', status: 'OPEN', quantity: '1', executedQuantity: '0', stopPrice: '110', reduceOnly: true };
const stored = { ...order, id: 'local', source: 'MANUAL', leverage: 10, marginMode: 'ISOLATED', positionSide: 'LONG' };
beforeEach(() => {
  vi.resetAllMocks(); m.account.mockResolvedValue(account); m.read.mockResolvedValue([order]); m.find.mockResolvedValue(stored); m.list.mockResolvedValue([stored]);
  m.preview.mockResolvedValue({ markPrice: '100' }); m.cancel.mockResolvedValue({ order: { ...order, status: 'CANCELED' } });
  m.create.mockImplementation(async ({ data }) => ({ ...data, id: 'replacement' })); m.batches.mockResolvedValue([]); m.claim.mockResolvedValue({ count: 1 });
});
it('lists selected account exchange TP/SL even when no local order exists', async () => {
  m.list.mockResolvedValue([]);
  expect(await exchangeOrders('user', 'account')).toMatchObject({ rows: [{ exchangeOrderId: '123', canEdit: false }] });
  expect(m.account).toHaveBeenCalledWith('user', 'account');
  expect(m.read).toHaveBeenCalledWith(account);
});
it('does not cancel an order when preflight rejects the new trigger', async () => {
  await expect(editExchangeOrder('user', 'account', '123', 'BTCUSDT', '90')).rejects.toMatchObject({ code: 'TRIGGER_ALREADY_REACHED' });
  expect(m.cancel).not.toHaveBeenCalled(); expect(m.place).not.toHaveBeenCalled();
});
it('replaces a verified canceled TP while preserving quantity, side and position leg', async () => {
  await editExchangeOrder('user', 'account', '123', 'BTCUSDT', '115');
  expect(m.create).toHaveBeenCalledWith({ data: expect.objectContaining({ quantity: '1', side: 'SELL', reduceOnly: true, positionSide: 'LONG', stopPrice: '115' }) });
  expect(m.cancel.mock.invocationCallOrder[0]).toBeLessThan(m.place.mock.invocationCallOrder[0]!);
});
it('does not place a replacement after a cancellation timeout', async () => {
  m.cancel.mockRejectedValue(new Error('timeout'));
  await expect(editExchangeOrder('user', 'account', '123', 'BTCUSDT', '115')).rejects.toMatchObject({ code: 'ORDER_EDIT_ATTENTION' });
  expect(m.place).not.toHaveBeenCalled();
});
it('does not duplicate quantity filled during cancellation', async () => {
  m.cancel.mockResolvedValue({ order: { ...order, status: 'CANCELED', executedQuantity: '0.5' } });
  await expect(editExchangeOrder('user', 'account', '123', 'BTCUSDT', '115')).rejects.toMatchObject({ code: 'ORDER_EDIT_ATTENTION' });
  expect(m.place).not.toHaveBeenCalled();
});
it('rejects direct edits to bot managed protection', async () => {
  m.find.mockResolvedValue(null);
  await expect(editExchangeOrder('user', 'account', '123', 'BTCUSDT', '115')).rejects.toMatchObject({ code: 'ORDER_EDIT_UNSUPPORTED' });
  expect(m.cancel).not.toHaveBeenCalled();
});
it('persists an exchange-created order before forwarding cancellation to Go', async () => {
  m.find.mockResolvedValue(null);
  await cancelExchangeOrder('user', 'account', '123', 'BTCUSDT');
  expect(m.upsert).toHaveBeenCalled();
  expect(m.upsert.mock.invocationCallOrder[0]).toBeLessThan(m.cancel.mock.invocationCallOrder[0]!);
});
it('relinks the bulk protection leg to the replacement order', async () => {
  const batch = { id: 'batch', plan: { items: [{ symbol: 'BTCUSDT', tpId: 'local', takeProfit: '110' }] } };
  m.batches.mockResolvedValue([batch]);
  await editExchangeOrder('user', 'account', '123', 'BTCUSDT', '115');
  expect(m.batchUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { plan: { items: [{ symbol: 'BTCUSDT', tpId: 'replacement', takeProfit: '115' }] } } }));
});
it('does not cancel while a bulk worker owns protection', async () => {
  m.batches.mockResolvedValue([{ id: 'batch', plan: { items: [{ tpId: 'local' }] } }]);
  m.claim.mockResolvedValue({ count: 0 });
  await expect(editExchangeOrder('user', 'account', '123', 'BTCUSDT', '115')).rejects.toMatchObject({ code: 'ORDER_EDIT_ATTENTION' });
  expect(m.cancel).not.toHaveBeenCalled();
});
it('does not repeat an edit already claimed by another request', async () => {
  m.audit.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' }));
  await expect(editExchangeOrder('user', 'account', '123', 'BTCUSDT', '115')).rejects.toMatchObject({ code: 'ORDER_EDIT_ALREADY_STARTED' });
  expect(m.cancel).not.toHaveBeenCalled(); expect(m.place).not.toHaveBeenCalled();
});
it('marks the bulk campaign for attention if the replacement is rejected', async () => {
  m.batches.mockResolvedValue([{ id: 'batch', plan: { items: [{ tpId: 'local' }] } }]);
  m.place.mockRejectedValue(new Error('exchange rejected replacement'));
  await expect(editExchangeOrder('user', 'account', '123', 'BTCUSDT', '115')).rejects.toMatchObject({ code: 'ORDER_EDIT_ATTENTION' });
  expect(m.claim).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'ATTENTION' } }));
  expect(m.place).toHaveBeenCalledTimes(1);
});
