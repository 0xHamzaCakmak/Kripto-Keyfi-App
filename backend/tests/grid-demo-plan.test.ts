import { describe, expect, it } from 'vitest';
import { buildDemoGridPlan, assertGridPreviewFresh } from '../src/modules/trading/grid-demo-plan.js';
import { gridDemoInputSchema } from '../src/modules/trading/grid-demo.schema.js';
import type { ExchangeSymbol } from '../src/modules/trading/exchanges/exchange-adapter.js';

const input = gridDemoInputSchema.parse({ exchangeAccountId: 'account', name: 'ETH grid', symbol: 'ETHUSDT', marketType: 'FUTURES', direction: 'NEUTRAL', spacingType: 'ARITHMETIC', lowerPrice: '2300', upperPrice: '2700', interval: '100', investment: '1000', leverage: 2, reservePercent: 30, maxLoss: '100', stopLowerPrice: '2200', stopUpperPrice: '2800' });
const rule: ExchangeSymbol = { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', status: 'TRADING', tickSize: '0.01', stepSize: '0.001', minQuantity: '0.001', maxQuantity: '1000', minNotional: '5', maxLeverage: 20 };
describe('reviewed demo grid plan', () => {
  it('distinguishes opening long/short from their contingent closing orders', () => {
    const plan = buildDemoGridPlan(input, '2500', rule);
    expect(plan.pairs.map(p => [p.direction, p.entryPrice, p.exitPrice])).toEqual([['LONG', '2300', '2400'], ['LONG', '2400', '2500'], ['SHORT', '2600', '2500'], ['SHORT', '2700', '2600']]);
    expect(plan.prices).toHaveLength(5); expect(plan.intervalCount).toBe(4);
    expect(plan.pairs.every(p => Number(p.estimatedNetProfit) > 0)).toBe(true);
  });
  it('never opens a 2600 long immediately when price is 2500', () => {
    const plan = buildDemoGridPlan({ ...input, direction: 'LONG' }, '2500', rule);
    expect(plan.pairs.every(p => p.direction === 'LONG' && Number(p.entryPrice) < 2500)).toBe(true);
    expect(plan.pairs.map(p => p.entryPrice)).not.toContain('2600');
  });
  it('does not multiply position sizes when leverage rises', () => {
    expect(buildDemoGridPlan(input, '2500', rule).pairs).toEqual(buildDemoGridPlan({ ...input, leverage: 5 }, '2500', rule).pairs);
  });
  it('caps worst stop loss and keeps budget reserve', () => {
    const plan = buildDemoGridPlan(input, '2500', rule);
    expect(Number(plan.estimatedStopLoss)).toBeLessThanOrEqual(80);
    expect(Number(plan.totalNotional)).toBeLessThanOrEqual(700);
    expect(plan.reserve).toBe('300');
  });
  it('spot uses only inventory backed buy then sell cycles', () => {
    const plan = buildDemoGridPlan({ ...input, marketType: 'SPOT', direction: 'LONG', leverage: 1 }, '2500', { ...rule, maxLeverage: 1 });
    expect(plan.pairs.every(p => p.direction === 'LONG')).toBe(true);
    expect(plan.initialMargin).toBe(plan.totalNotional);
  });
  it('supports geometric spacing with distinct exchange aligned levels', () => {
    const plan = buildDemoGridPlan({ ...input, spacingType: 'GEOMETRIC', interval: '2' }, '2500', rule);
    expect(plan.prices.slice(0, 3)).toEqual(['2300', '2346', '2392.92']);
    expect(new Set(plan.prices).size).toBe(plan.prices.length);
  });
  it('rejects stale levels instead of submitting marketable entry limits', () => {
    const plan = buildDemoGridPlan(input, '2500', rule);
    expect(() => assertGridPreviewFresh(plan, '2400')).toThrow(/Fiyat değişti/);
    expect(() => assertGridPreviewFresh(plan, '2600')).toThrow(/Fiyat değişti/);
    expect(() => assertGridPreviewFresh(plan, '2501')).not.toThrow();
  });
  it('rejects tiny duplicate ticks, insufficient notional and fee losing grids', () => {
    expect(() => buildDemoGridPlan({ ...input, interval: '0.001' }, '2500', rule)).toThrow(/fiyat adımından küçük/);
    expect(() => buildDemoGridPlan({ ...input, investment: '1' }, '2500', rule)).toThrow();
    expect(() => buildDemoGridPlan({ ...input, lowerPrice: '2499', upperPrice: '2501', interval: '0.1' }, '2500', rule)).toThrow(/komisyon/);
  });
  it('validates both stop boundaries, positive decimals and spot leverage', () => {
    expect(gridDemoInputSchema.safeParse({ ...input, stopUpperPrice: undefined }).success).toBe(false);
    expect(gridDemoInputSchema.safeParse({ ...input, marketType: 'SPOT' }).success).toBe(false);
    expect(gridDemoInputSchema.safeParse({ ...input, maxLoss: '1000' }).success).toBe(false);
    expect(gridDemoInputSchema.safeParse({ ...input, interval: '0' }).success).toBe(false);
  });
});
