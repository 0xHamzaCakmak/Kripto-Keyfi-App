import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ account: vi.fn(), botCount: vi.fn(), preview: vi.fn(), create: vi.fn() }));
vi.mock('../src/database/prisma.js', () => ({ prisma: {
  tradingBot: { count: mocks.botCount },
  manualOrderPreview: { create: mocks.create },
} }));
vi.mock('../src/modules/trading/exchange-account.service.js', () => ({ ownedAccount: mocks.account }));
vi.mock('../src/modules/trading/trading-engine.client.js', () => ({ previewTradingEngineOrder: mocks.preview }));
vi.mock('../src/modules/trading/shadow-compare.js', () => ({}));
vi.mock('../src/modules/trading/trading-events.service.js', () => ({}));

import { createOrderPreview } from '../src/modules/trading/manual-trading.service.js';
import type { PreviewOrderInput } from '../src/modules/trading/manual-trading.schema.js';

const input: PreviewOrderInput = {
  exchangeAccountId: 'account-a', symbol: 'BTCUSDT', side: 'SELL', type: 'MARKET',
  quantity: '0.006', leverage: 10, marginMode: 'ISOLATED', reduceOnly: false,
};

beforeEach(() => {
  mocks.account.mockResolvedValue({ id: 'account-a', name: 'Demo', provider: 'BINANCE',
    accountType: 'USDT_M', executionEngine: 'GO', isActive: true, canTrade: true, connectionStatus: 'CONNECTED' });
  // An existing autonomous bot assignment must not block manual trading.
  mocks.botCount.mockResolvedValue(1);
  mocks.preview.mockResolvedValue({ markPrice: '77000', estimatedNotional: '462', rule: {
    symbol: 'BTCUSDT', minQuantity: '0.001', maxQuantity: '100', stepSize: '0.001',
    tickSize: '0.1', minNotional: '5', maxLeverage: 125,
  } });
  mocks.create.mockImplementation(async ({ data }) => ({ id: 'preview-a', ...data }));
});

it.each(['BUY', 'SELL'] as const)('allows a manual %s preview on a bot-assigned symbol', async (side) => {
  const result = await createOrderPreview('user-a', { ...input, side });
  expect(result).toMatchObject({ id: 'preview-a', symbol: 'BTCUSDT', side, estimatedNotional: '462' });
  expect(mocks.preview).toHaveBeenCalledWith(expect.objectContaining({ id: 'account-a' }), { ...input, side });
  expect(mocks.botCount).not.toHaveBeenCalled();
});

it('still rejects an unavailable trading account before reaching the engine', async () => {
  mocks.account.mockResolvedValue({ isActive: false });
  await expect(createOrderPreview('user-a', input)).rejects.toMatchObject({ code: 'EXCHANGE_ACCOUNT_DISABLED' });
  expect(mocks.preview).not.toHaveBeenCalled();
});

it('preserves engine rejection and does not persist an invalid preview', async () => {
  mocks.preview.mockRejectedValue(new Error('Risk limit exceeded'));
  await expect(createOrderPreview('user-a', input)).rejects.toThrow('Risk limit exceeded');
  expect(mocks.create).not.toHaveBeenCalled();
});
