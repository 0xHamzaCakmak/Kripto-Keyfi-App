import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma, type TradingBot, type TradingOrder } from '@prisma/client';
import type { GridOrderSnapshot } from '../src/modules/trading/grid-demo-exchange.js';
import type { GridConfigurationV2 } from '../src/modules/trading/grid-demo.service.js';
import { buildDemoGridPlan } from '../src/modules/trading/grid-demo-plan.js';
import { gridDemoInputSchema } from '../src/modules/trading/grid-demo.schema.js';

const m = vi.hoisted(() => ({ bot: {} as Record<string, unknown>, orders: new Map<string, Record<string, unknown>>(), snapshots: new Map<string, GridOrderSnapshot>(), execute: vi.fn(), cancel: vi.fn(), read: vi.fn(), risk: { enabled: true, accountKillSwitch: false, entryPaused: false, maxOrdersPerMinute: 60 } }));
vi.mock('../src/database/prisma.js', () => ({ prisma: {
  tradingBot: {
    findUniqueOrThrow: vi.fn(async () => structuredClone(m.bot)),
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      if (where.schedulerOwner && where.schedulerOwner !== m.bot.schedulerOwner) return { count: 0 };
      if ('stateReason' in where && where.stateReason !== m.bot.stateReason) return { count: 0 };
      Object.assign(m.bot, structuredClone(data)); return { count: 1 };
    }),
  },
  tradingOrder: {
    findUnique: vi.fn(async ({ where }: { where: { id?: string; userId_idempotencyKey?: { idempotencyKey: string } } }) => where.id ? m.orders.get(where.id) ?? null : [...m.orders.values()].find(o => o.idempotencyKey === where.userId_idempotencyKey?.idempotencyKey) ?? null),
    findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => { const order = m.orders.get(where.id); if (!order) throw new Error('missing order'); return order; }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { const order = { ...data, id: `order-${m.orders.size}`, status: 'SUBMITTING', exchangeOrderId: null }; m.orders.set(order.id, order); return order; }),
  },
  tradingRiskProfile: { findUnique: vi.fn(async () => m.risk) }, tradingRiskControl: { findUnique: vi.fn(async () => ({ globalKillSwitch: false })) },
} }));
vi.mock('../src/utils/logger.js', () => ({ logger: { error: vi.fn() } }));
vi.mock('../src/modules/trading/exchange-account.service.js', () => ({ ownedAccount: vi.fn(async () => ({ id: 'account', userId: 'user', provider: 'BINANCE', accountType: 'USDT_M', executionEngine: 'GO', isActive: true, canTrade: true })), adapterFor: () => ({ getMarkPrice: async () => '2500', getPositions: async () => [] }) }));
vi.mock('../src/modules/trading/trading-engine.client.js', () => ({ executeTradingEngineOrder: m.execute, cancelTradingEngineOrder: m.cancel }));
vi.mock('../src/modules/trading/grid-demo-exchange.js', () => ({ GridExchangeReader: class { order = m.read; async funding() { return '0'; } } }));
import { runDemoGrid } from '../src/modules/trading/grid-demo.worker.js';

const fill = (executed = '0', quote = '0', status = 'NEW'): GridOrderSnapshot => ({ executed, quote, status, fee: '0', baseFee: '0', feesComplete: true });
const config = () => m.bot.configuration as GridConfigurationV2;
function addOrder(id: string, snapshot: GridOrderSnapshot, fields: Record<string, unknown> = {}) {
  m.orders.set(id, { id, symbol: 'ETHUSDT', clientOrderId: id, exchangeOrderId: `exchange-${id}`, status: 'OPEN', type: 'LIMIT', ...fields });
  m.snapshots.set(`exchange-${id}`, snapshot);
}
beforeEach(() => {
  m.orders.clear(); m.snapshots.clear(); m.execute.mockReset(); m.cancel.mockReset(); m.read.mockReset();
  m.risk.entryPaused = false;
  const input = gridDemoInputSchema.parse({ exchangeAccountId: 'account', name: 'ETH demo', symbol: 'ETHUSDT', marketType: 'FUTURES', direction: 'LONG', lowerPrice: '2300', upperPrice: '2700', interval: '100', investment: '1000', maxLoss: '100', stopLowerPrice: '2200' });
  const plan = buildDemoGridPlan(input, '2500', { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', status: 'TRADING', tickSize: '0.01', stepSize: '0.001', minQuantity: '0.001', maxQuantity: '100', minNotional: '5', maxLeverage: 5 });
  plan.pairs = [{ ...plan.pairs[0]!, quantity: '0.01' }];
  const c: GridConfigurationV2 = { gridVersion: 2, input, plan, baseAsset: 'ETH', stepSize: '0.001', hedgeMode: true, expiresAt: new Date().toISOString(), confirmedAt: new Date().toISOString(), runtime: { cycles: [{ cycle: 0 }], realized: '0', fees: '0', funding: '0', unrealized: '0', matched: 0, feesComplete: true, closing: false, nextPair: 0, nextEntryAt: Date.now() + 86400000 } };
  m.bot = { id: 'bot', userId: 'user', exchangeAccountId: 'account', symbol: 'ETHUSDT', type: 'GRID', mode: 'DEMO', state: 'RUNNING', desiredState: 'RUNNING', stateReason: 'Running', configuration: c, heartbeatAt: null, leaseExpiresAt: null, schedulerOwner: null };
  m.read.mockImplementation(async (_symbol: string, id: string) => { const value = m.snapshots.get(id); if (!value) throw new Error('Exchange snapshot unavailable'); return { ...value }; });
  m.execute.mockImplementation(async (_account: unknown, _preview: unknown, order: TradingOrder) => {
    const saved = m.orders.get(order.id)!; saved.exchangeOrderId = `exchange-${order.id}`; saved.status = 'OPEN';
    const qty = String(order.quantity); m.snapshots.set(String(saved.exchangeOrderId), order.type === 'MARKET' ? fill(qty, new Prisma.Decimal(qty).mul('2500').toFixed(), 'FILLED') : fill());
    return {};
  });
  m.cancel.mockImplementation(async (_account: unknown, id: string) => { const value = m.snapshots.get(id)!; value.status = 'CANCELED'; return {}; });
});
const run = () => runDemoGrid(m.bot as unknown as TradingBot);

describe('persistent grid order lifecycle', () => {
  it('replaces stale uncertainty after a failed unsent entry without restarting the grid', async () => {
    m.bot.state = 'ERROR'; m.bot.desiredState = 'STOPPED'; m.bot.lastErrorCode = 'GRID_RECONCILIATION_REQUIRED';
    config().runtime.cycles[0] = { cycle: 0, entry: 'failed', settled: true, entryFill: fill('0', '0', 'REJECTED') };
    m.orders.set('failed', { id: 'failed', status: 'FAILED', exchangeOrderId: null, executionAttemptedAt: null });
    await run();
    expect(m.bot.lastErrorCode).toBe('GRID_ORDER_FAILED');
    expect(m.bot.lastErrorMessage).toContain('gönderim kaydı oluşmadı');
    expect(m.bot.state).toBe('ERROR');
    expect(m.execute).not.toHaveBeenCalled();
  });
  it('does not resubmit an order with an uncertain exchange result', async () => {
    config().runtime.cycles[0]!.entry = 'uncertain';
    m.orders.set('uncertain', { id: 'uncertain', status: 'RECONCILIATION_REQUIRED', exchangeOrderId: null });
    await run(); await run();
    expect(m.execute).not.toHaveBeenCalled(); expect(m.bot.state).toBe('ERROR');
  });
  it('cancels the entry remainder and protects/closes only the actually filled amount', async () => {
    config().runtime.cycles[0]!.entry = 'entry'; addOrder('entry', fill('0.004', '9.2', 'PARTIALLY_FILLED'));
    await run();
    expect(m.cancel).toHaveBeenCalledWith(expect.anything(), 'exchange-entry', 'ETHUSDT', expect.any(String));
    const sent = m.execute.mock.calls.map(call => call[2]);
    expect(sent.map(o => [o.type, String(o.quantity), o.side, o.positionSide, o.reduceOnly])).toEqual([['STOP_MARKET', '0.004', 'SELL', 'LONG', true], ['LIMIT', '0.004', 'SELL', 'LONG', true]]);
  });
  it('does not close or place an exit when entry cancellation is still pending', async () => {
    config().runtime.cycles[0]!.entry = 'entry'; addOrder('entry', fill('0.004', '9.2', 'PARTIALLY_FILLED')); m.cancel.mockImplementation(async () => ({}));
    await run(); expect(m.execute).not.toHaveBeenCalled();
  });
  it('waits for exit/stop cancellations before sending a flattening market order', async () => {
    Object.assign(config().runtime.cycles[0]!, { entry: 'entry', exit: 'exit', stop: 'stop' }); config().runtime.closing = true;
    addOrder('entry', fill('0.01', '23', 'FILLED')); addOrder('exit', fill()); addOrder('stop', fill(), { type: 'STOP_MARKET' }); m.cancel.mockImplementation(async () => ({}));
    await run(); expect(m.execute).not.toHaveBeenCalled(); expect(config().runtime.closing).toBe(true);
  });
  it('accounts a completed cycle once across worker restarts', async () => {
    Object.assign(config().runtime.cycles[0]!, { entry: 'entry', exit: 'exit', stop: 'stop' });
    addOrder('entry', fill('0.01', '23', 'FILLED')); addOrder('exit', fill('0.01', '24', 'FILLED')); addOrder('stop', fill(), { type: 'STOP_MARKET' });
    await run(); await run();
    expect(config().runtime.realized).toBe('1'); expect(config().runtime.matched).toBe(1); expect(m.execute).not.toHaveBeenCalled();
  });
  it('keeps other entry cancellations running when one order cannot be reconciled', async () => {
    config().plan.pairs.push({ ...config().plan.pairs[0]!, index: 1 }); config().runtime.cycles = [{ cycle: 0, entry: 'uncertain' }, { cycle: 0, entry: 'other' }]; m.bot.desiredState = 'STOPPED'; m.bot.state = 'PAUSED';
    m.orders.set('uncertain', { id: 'uncertain', status: 'RECONCILIATION_REQUIRED', exchangeOrderId: null }); addOrder('other', fill());
    await run(); expect(m.cancel).toHaveBeenCalledWith(expect.anything(), 'exchange-other', 'ETHUSDT', expect.any(String)); expect(m.execute).not.toHaveBeenCalled();
  });
  it('does not open new entries while account entries are paused', async () => {
    m.risk.entryPaused = true; config().runtime.nextEntryAt = 0;
    await run(); expect(m.execute).not.toHaveBeenCalled();
  });
  it('flattens the remaining position if its protective stop was rejected', async () => {
    Object.assign(config().runtime.cycles[0]!, { entry: 'entry', stop: 'stop' }); addOrder('entry', fill('0.01', '23', 'FILLED'));
    m.orders.set('stop', { id: 'stop', status: 'FAILED', exchangeOrderId: null, type: 'STOP_MARKET' });
    await run();
    expect(m.execute.mock.calls[0]![2]).toMatchObject({ type: 'MARKET', reduceOnly: true, side: 'SELL', positionSide: 'LONG' });
    expect(config().runtime.closing).toBe(true);
  });
});
