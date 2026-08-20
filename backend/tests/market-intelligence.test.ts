import { beforeEach, describe, expect, it } from 'vitest';
import type { MarketIntelligenceProvider, MarketObservation } from '../src/modules/ai-trading/market-intelligence.provider.js';
import { marketContextQuerySchema, marketContextSchemaV1 } from '../src/modules/ai-trading/market-intelligence.schema.js';
import { buildContext, clearMarketContextCache, getMarketContext } from '../src/modules/ai-trading/market-intelligence.service.js';

const now = new Date('2026-08-21T12:00:00.000Z');
const candles = Array.from({ length: 20 }, (_, index) => ({
  openTime: new Date(now.getTime() - (19 - index) * 60_000), open: 100 + index, high: 102 + index,
  low: 99 + index, close: 101 + index, volume: index === 19 ? 200 : 100,
}));
function observation(overrides: Partial<MarketObservation> = {}): MarketObservation {
  return {
    candles: { value: candles, observedAt: now }, markPrice: { value: 120, observedAt: now },
    fundingRate: { value: 0.0001, observedAt: now }, openInterestDelta: { value: 0.04, observedAt: now },
    orderBookImbalance: { value: 0.2, observedAt: now }, btcDominance: null,
    newsSentiment: null, socialSentiment: null, whaleBias: null, ...overrides,
  };
}

describe('market intelligence', () => {
  beforeEach(clearMarketContextCache);

  it('builds a versioned standardized context without inventing unavailable intelligence', () => {
    const context = buildContext({ symbol: 'BTCUSDT', timeframe: '1m' }, observation(), now, 120_000);
    expect(marketContextSchemaV1.parse(context).schemaVersion).toBe('1.0.0');
    expect(context.market.trend).toBe('BULLISH');
    expect(context.market.atrPct).toBeGreaterThan(0);
    expect(context.market.volumeRelative).toBe(2);
    expect(context.intelligence).toEqual({ newsSentiment: null, socialSentiment: null, whaleBias: null });
    expect(context.sources.news.status).toBe('UNKNOWN');
  });

  it('rejects stale values while retaining explicit freshness metadata', () => {
    const old = new Date(now.getTime() - 121_000);
    const context = buildContext({ symbol: 'BTCUSDT', timeframe: '1m' }, observation({ fundingRate: { value: 0.9, observedAt: old } }), now, 120_000);
    expect(context.market.fundingRate).toBeNull();
    expect(context.sources.funding).toMatchObject({ status: 'STALE', ageMs: 121_000, observedAt: old.toISOString() });
  });

  it('uses a bounded cache and supports an explicit refresh', async () => {
    let calls = 0;
    const provider: MarketIntelligenceProvider = { read: async () => { calls += 1; return observation(); } };
    const query = marketContextQuerySchema.parse({ symbol: 'btcusdt', timeframe: '1m' });
    const first = await getMarketContext(query, { provider, clock: () => now, cacheTtlMs: 1_000 });
    const second = await getMarketContext(query, { provider, clock: () => new Date(now.getTime() + 500), cacheTtlMs: 1_000 });
    const refreshed = await getMarketContext({ ...query, forceRefresh: true }, { provider, clock: () => new Date(now.getTime() + 600), cacheTtlMs: 1_000 });
    expect([first.cache.hit, second.cache.hit, refreshed.cache.hit]).toEqual([false, true, false]);
    expect(calls).toBe(2);
  });

  it('accepts only supported symbols and timeframes', () => {
    expect(marketContextQuerySchema.parse({ symbol: 'ethusdt' }).symbol).toBe('ETHUSDT');
    expect(marketContextQuerySchema.safeParse({ symbol: '../BTC', timeframe: '2m' }).success).toBe(false);
  });
});
