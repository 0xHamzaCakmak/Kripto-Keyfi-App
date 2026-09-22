import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/database/prisma.js';

const mocks = vi.hoisted(() => ({ account: vi.fn(), mark: vi.fn(), positions: vi.fn(), orders: vi.fn(), symbols: vi.fn(), balances: vi.fn(), create: vi.fn(), find: vi.fn(), update: vi.fn(), count: vi.fn(), audit: vi.fn(), profile: vi.fn(), global: vi.fn(), engine: vi.fn(), execute: vi.fn() }));
vi.mock('../src/database/prisma.js', () => {
  const db = { exchangeAccount: { update: vi.fn() }, tradingBot: { create: mocks.create, findFirst: mocks.find, findUniqueOrThrow: mocks.find, findMany: vi.fn().mockResolvedValue([]), update: mocks.update, count: mocks.count }, tradingAuditLog: { create: mocks.audit }, tradingRiskProfile: { findUnique: mocks.profile }, tradingRiskControl: { findUnique: mocks.global } };
  return { prisma: { ...db, $transaction: (operation: (tx: unknown) => unknown) => operation(db) } };
});
vi.mock('../src/modules/trading/exchange-account.service.js', () => ({ ownedAccount: mocks.account, adapterFor: () => ({ getMarkPrice: mocks.mark, getPositions: mocks.positions, getOpenOrders: mocks.orders, getSymbols: mocks.symbols, getBalances: mocks.balances }) }));
vi.mock('../src/modules/trading/trading-engine.client.js', () => ({ previewTradingEngineOrder: mocks.engine, executeTradingEngineOrder: mocks.execute }));
vi.mock('../src/modules/trading/grid-demo-exchange.js', () => ({ GridExchangeReader: class { async maintenanceRate() { return '0.005'; } } }));
import { gridDemoPreview, gridDemoConfirm } from '../src/modules/trading/grid-demo.service.js';
import { gridDemoInputSchema } from '../src/modules/trading/grid-demo.schema.js';

const input = gridDemoInputSchema.parse({ exchangeAccountId: 'account-a', name: 'ETH grid', symbol: 'ETHUSDT', marketType: 'FUTURES', direction: 'LONG', lowerPrice: '2300', upperPrice: '2700', interval: '100', investment: '1000', maxLoss: '100', stopLowerPrice: '2200' });
beforeEach(() => {
  vi.mocked(prisma.tradingBot.findMany).mockResolvedValue([]);
  const dec = (value: number) => new Prisma.Decimal(value);
  mocks.account.mockResolvedValue({ id: 'account-a', userId: 'user-a', name: 'Demo', provider: 'BINANCE', environment: 'TESTNET', accountType: 'USDT_M', isActive: true, connectionStatus: 'CONNECTED', canTrade: true, executionEngine: 'GO' });
  mocks.mark.mockResolvedValue('2500'); mocks.positions.mockResolvedValue([]); mocks.orders.mockResolvedValue([]); mocks.count.mockResolvedValue(0);
  mocks.symbols.mockResolvedValue([{ symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', tickSize: '0.01', stepSize: '0.001', minQuantity: '0.001', maxQuantity: '1000', minNotional: '5', maxLeverage: 5 }]);
  mocks.balances.mockResolvedValue([{ asset: 'USDT', walletType: 'USD_M_FUTURES', availableBalance: '10000' }]);
  mocks.profile.mockResolvedValue({ enabled: true, accountKillSwitch: false, minLeverage: 1, maxLeverage: 5, minAvailableBalance: dec(0), maxSymbolOpenNotional: dec(10000), maxAccountOpenNotional: dec(10000), maxOrderNotional: dec(10000), maxInitialMargin: dec(10000) });
  mocks.global.mockResolvedValue({ globalKillSwitch: false }); mocks.engine.mockResolvedValue({});
  mocks.update.mockImplementation(async ({ data }: { data: object }) => ({ ...(await mocks.find()), ...data }));
});
async function reviewed() {
  const preview = await gridDemoPreview('user-a', input);
  const data = mocks.create.mock.calls.at(-1)![0].data;
  mocks.find.mockResolvedValue({ ...data, state: 'DRAFT', desiredState: 'STOPPED', stateReason: null, lastErrorMessage: null, heartbeatAt: null });
  return preview;
}
describe('grid preview confirmation boundary', () => {
  it('rejects capital already allocated to a different grid after preview', async () => {
    const preview = await reviewed();
    const row = await mocks.find();
    vi.mocked(prisma.tradingBot.findMany).mockResolvedValue([{ ...row, configuration: { ...row.configuration, input: { ...input, investment: '9500' } } }]);
    await expect(gridDemoConfirm('user-a', preview.previewId, 'account-a')).rejects.toMatchObject({ code: 'GRID_CAPITAL_ALREADY_RESERVED' });
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('preview persists immutable draft without exchange configuration or orders', async () => {
    const preview = await reviewed();
    expect(preview.account.id).toBe('account-a');
    expect(mocks.execute).not.toHaveBeenCalled(); expect(mocks.engine).not.toHaveBeenCalled();
    expect(mocks.create.mock.calls[0]![0].data.configuration.confirmedAt).toBeUndefined();
  });
  it('requires a fresh preview before scheduling, and does not submit orders in the HTTP request', async () => {
    const preview = await reviewed();
    const result = await gridDemoConfirm('user-a', preview.previewId, 'account-a');
    expect(result.state).toBe('STARTING'); expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalled();
    expect(mocks.update.mock.calls[0]![0].data.configuration.plan).toEqual(preview.plan);
  });
  it('rejects an expired preview and changed prices without any execution', async () => {
    const preview = await reviewed();
    const bot = await mocks.find(); bot.configuration.expiresAt = '2000-01-01T00:00:00.000Z';
    await expect(gridDemoConfirm('user-a', preview.previewId, 'account-a')).rejects.toMatchObject({ code: 'GRID_PREVIEW_EXPIRED' });
    bot.configuration.expiresAt = new Date(Date.now() + 60000).toISOString(); mocks.mark.mockResolvedValue('2300');
    await expect(gridDemoConfirm('user-a', preview.previewId, 'account-a')).rejects.toMatchObject({ code: 'GRID_PREVIEW_PRICE_CHANGED' });
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.execute).not.toHaveBeenCalled();
  });
  it('returns the same bot for a repeated confirmation even if price changed after first approval', async () => {
    const preview = await reviewed(); const bot = await mocks.find(); bot.configuration.confirmedAt = new Date().toISOString(); bot.state = 'RUNNING';
    mocks.mark.mockResolvedValue('3000');
    const first = await gridDemoConfirm('user-a', preview.previewId, 'account-a');
    const second = await gridDemoConfirm('user-a', preview.previewId, 'account-a');
    expect(first.id).toBe(second.id); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.engine).not.toHaveBeenCalled();
  });
  it('does not find a preview through another account or user', async () => {
    mocks.find.mockResolvedValue(null);
    await expect(gridDemoConfirm('other-user', 'id', 'other-account')).rejects.toMatchObject({ code: 'GRID_NOT_FOUND' });
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'other-user', exchangeAccountId: 'other-account' }) }));
  });
  it('rejects new positions and competing bot claims created after preview', async () => {
    const preview = await reviewed(); mocks.positions.mockResolvedValue([{ symbol: 'ETHUSDT' }]);
    await expect(gridDemoConfirm('user-a', preview.previewId, 'account-a')).rejects.toMatchObject({ code: 'GRID_SYMBOL_BUSY' });
    mocks.positions.mockResolvedValue([]); mocks.count.mockResolvedValue(1);
    await expect(gridDemoConfirm('user-a', preview.previewId, 'account-a')).rejects.toMatchObject({ code: 'GRID_SYMBOL_BUSY' });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
