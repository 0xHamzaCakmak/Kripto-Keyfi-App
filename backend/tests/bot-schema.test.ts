import { describe, expect, it } from 'vitest';
import { createBotBodySchema } from '../src/modules/trading/bot.schema.js';

describe('trading bot API contract', () => {
  it('accepts an exchange-isolated shadow scalping bot', () => {
    const result = createBotBodySchema.safeParse({
      name: 'BTC Shadow Bot', exchangeAccountId: 'account-1', type: 'SCALPING', mode: 'SHADOW',
      symbol: 'btcusdt', intervalSeconds: 30,
      configuration: { side: 'BOTH', quantity: '0.001', leverage: 2, marginMode: 'ISOLATED', signalThresholdBps: 25 },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.symbol).toBe('BTCUSDT');
  });

  it('does not expose demo or live execution through create contract', () => {
    const base = {
      name: 'Unsafe Bot', exchangeAccountId: 'account-1', type: 'SCALPING', symbol: 'BTCUSDT', intervalSeconds: 30,
      configuration: { side: 'BOTH', quantity: '0.001', leverage: 2, marginMode: 'ISOLATED', signalThresholdBps: 25 },
    };
    expect(createBotBodySchema.safeParse({ ...base, mode: 'DEMO' }).success).toBe(false);
    expect(createBotBodySchema.safeParse({ ...base, mode: 'LIVE' }).success).toBe(false);
  });

  it('rejects an inverted grid range', () => {
    expect(createBotBodySchema.safeParse({
      name: 'Grid Shadow', exchangeAccountId: 'account-1', type: 'GRID', mode: 'PAPER', symbol: 'BTCUSDT', intervalSeconds: 60,
      configuration: { lowerPrice: '80000', upperPrice: '50000', gridLevels: 10, quantityPerGrid: '0.001', leverage: 2, marginMode: 'ISOLATED' },
    }).success).toBe(false);
  });
});
