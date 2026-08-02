import { describe, expect, it } from 'vitest';
import { buildGridPlan } from '../src/modules/trading/grid-plan.service.js';

const configuration = {
  marketType: 'FUTURES', gridDirection: 'NEUTRAL', spacingType: 'ARITHMETIC',
  lowerPrice: '1800', upperPrice: '1900', gridLevels: 10, quantityPerGrid: '0.01',
  leverage: 10, marginMode: 'ISOLATED', paperFeeBps: 4, paperSlippageBps: 2,
} as const;
const rule = { tickSize: '0.01', stepSize: '0.001', minQuantity: '0.001', maxQuantity: '1000', minNotional: '5', maxLeverage: 20 };
const account = { id: 'account-1', name: 'Demo', provider: 'BINANCE', environment: 'TESTNET', accountType: 'USDT_M' };

describe('grid plan', () => {
  it('creates visible arithmetic ETH levels and sides around mark price', () => {
    const plan = buildGridPlan('ETHUSDT', '1850', configuration, rule, account);
    expect(plan.levels).toHaveLength(10);
    expect(plan.levels[0]?.price).toBe('1800');
    expect(plan.levels[9]?.price).toBe('1900');
    expect(plan.gridIntervals).toBe(9);
    expect(plan.buyCount).toBe(5);
    expect(plan.sellCount).toBe(5);
    expect(plan.submittedToExchange).toBe(false);
    expect(plan.levels.every((level) => level.quantity === '0.01')).toBe(true);
  });

  it('keeps every level waiting while mark price is outside the range', () => {
    const plan = buildGridPlan('ETHUSDT', '2000', configuration, rule, account);
    expect(plan.markPriceInRange).toBe(false);
    expect(plan.buyCount).toBe(0);
    expect(plan.sellCount).toBe(0);
    expect(plan.waitCount).toBe(10);
  });
});
