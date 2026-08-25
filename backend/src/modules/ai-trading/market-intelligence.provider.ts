import { getJson } from '../trading/exchanges/http.js';
import type { MarketContextQuery } from './market-intelligence.schema.js';

// PAPER intelligence follows the real public Binance USD-M market. Demo
// credentials are only for execution; they must not downgrade price discovery.
const BINANCE_FUTURES_PUBLIC_URL = 'https://fapi.binance.com';

export type TimedValue<T> = { value: T; observedAt: Date };
export type MarketCandle = { openTime: Date; open: number; high: number; low: number; close: number; volume: number };
export type MarketObservation = {
  candles: TimedValue<MarketCandle[]> | null;
  markPrice: TimedValue<number> | null;
  fundingRate: TimedValue<number> | null;
  openInterestDelta: TimedValue<number> | null;
  orderBookImbalance: TimedValue<number> | null;
  btcDominance: TimedValue<number> | null;
  newsSentiment: TimedValue<number> | null;
  socialSentiment: TimedValue<number> | null;
  whaleBias: TimedValue<'BULLISH' | 'BEARISH' | 'NEUTRAL'> | null;
};

export interface MarketIntelligenceProvider {
  read(input: Pick<MarketContextQuery, 'symbol' | 'timeframe'>): Promise<MarketObservation>;
}

export class BinancePublicMarketProvider implements MarketIntelligenceProvider {
  constructor(private readonly clock: () => Date = () => new Date()) {}

  async read(input: Pick<MarketContextQuery, 'symbol' | 'timeframe'>): Promise<MarketObservation> {
    const encodedSymbol = encodeURIComponent(input.symbol);
    const [klines, premium, openInterest, depth] = await Promise.allSettled([
      getJson(new URL(`/fapi/v1/klines?symbol=${encodedSymbol}&interval=${input.timeframe}&limit=100`, BINANCE_FUTURES_PUBLIC_URL), {}),
      getJson(new URL(`/fapi/v1/premiumIndex?symbol=${encodedSymbol}`, BINANCE_FUTURES_PUBLIC_URL), {}),
      getJson(new URL(`/futures/data/openInterestHist?symbol=${encodedSymbol}&period=${input.timeframe}&limit=2`, BINANCE_FUTURES_PUBLIC_URL), {}),
      getJson(new URL(`/fapi/v1/depth?symbol=${encodedSymbol}&limit=20`, BINANCE_FUTURES_PUBLIC_URL), {}),
    ]);
    const fetchedAt = this.clock();
    const candleValue = klines.status === 'fulfilled' ? parseCandles(klines.value) : null;
    const premiumValue = premium.status === 'fulfilled' ? parsePremium(premium.value, fetchedAt) : null;
    return {
      candles: candleValue ? { value: candleValue, observedAt: candleValue.at(-1)?.openTime ?? fetchedAt } : null,
      markPrice: premiumValue?.markPrice ?? null,
      fundingRate: premiumValue?.fundingRate ?? null,
      openInterestDelta: openInterest.status === 'fulfilled' ? parseOpenInterest(openInterest.value) : null,
      orderBookImbalance: depth.status === 'fulfilled' ? parseOrderBook(depth.value, fetchedAt) : null,
      // The project has no authoritative integrations for these values. Never infer or fabricate them.
      btcDominance: null, newsSentiment: null, socialSentiment: null, whaleBias: null,
    };
  }
}

function finite(value: unknown) { const number = typeof value === 'string' || typeof value === 'number' ? Number(value) : Number.NaN; return Number.isFinite(number) ? number : null; }

function parseCandles(body: unknown): MarketCandle[] | null {
  if (!Array.isArray(body)) return null;
  const parsed = body.flatMap((row) => {
    if (!Array.isArray(row)) return [];
    const openTime = finite(row[0]); const open = finite(row[1]); const high = finite(row[2]);
    const low = finite(row[3]); const close = finite(row[4]); const volume = finite(row[5]);
    if (openTime === null || open === null || high === null || low === null || close === null || volume === null || open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) return [];
    return [{ openTime: new Date(openTime), open, high, low, close, volume }];
  });
  return parsed.length ? parsed : null;
}

function parsePremium(body: unknown, fallback: Date) {
  if (!body || typeof body !== 'object') return null;
  const value = body as Record<string, unknown>; const observedAtValue = finite(value.time);
  const observedAt = observedAtValue === null ? fallback : new Date(observedAtValue);
  const markPrice = finite(value.markPrice); const fundingRate = finite(value.lastFundingRate);
  return {
    markPrice: markPrice !== null && markPrice > 0 ? { value: markPrice, observedAt } : null,
    fundingRate: fundingRate === null ? null : { value: fundingRate, observedAt },
  };
}

function parseOpenInterest(body: unknown): TimedValue<number> | null {
  if (!Array.isArray(body) || body.length < 2) return null;
  const previous = body.at(-2); const latest = body.at(-1);
  if (!previous || !latest || typeof previous !== 'object' || typeof latest !== 'object') return null;
  const previousValue = finite((previous as Record<string, unknown>).sumOpenInterestValue);
  const latestValue = finite((latest as Record<string, unknown>).sumOpenInterestValue);
  const timestamp = finite((latest as Record<string, unknown>).timestamp);
  if (previousValue === null || latestValue === null || timestamp === null || previousValue <= 0) return null;
  return { value: (latestValue - previousValue) / previousValue, observedAt: new Date(timestamp) };
}

function parseOrderBook(body: unknown, observedAt: Date): TimedValue<number> | null {
  if (!body || typeof body !== 'object') return null;
  const value = body as { bids?: unknown; asks?: unknown };
  const bidNotional = levelNotional(value.bids); const askNotional = levelNotional(value.asks);
  if (bidNotional === null || askNotional === null || bidNotional + askNotional === 0) return null;
  return { value: (bidNotional - askNotional) / (bidNotional + askNotional), observedAt };
}

function levelNotional(levels: unknown) {
  if (!Array.isArray(levels) || !levels.length) return null;
  let total = 0;
  for (const level of levels) {
    if (!Array.isArray(level)) return null;
    const price = finite(level[0]); const quantity = finite(level[1]);
    if (price === null || quantity === null || price < 0 || quantity < 0) return null;
    total += price * quantity;
  }
  return total;
}
