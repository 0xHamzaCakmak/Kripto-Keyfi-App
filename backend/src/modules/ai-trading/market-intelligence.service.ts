import { BinancePublicMarketProvider, type MarketCandle, type MarketIntelligenceProvider, type MarketObservation, type TimedValue } from './market-intelligence.provider.js';
import { MARKET_CONTEXT_SCHEMA_VERSION, marketContextSchemaV1, type MarketContext, type MarketContextQuery } from './market-intelligence.schema.js';

const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { value: MarketContext; expiresAtMs: number }>();

type Dependencies = { provider?: MarketIntelligenceProvider; clock?: () => Date; cacheTtlMs?: number };

export async function getMarketContext(input: MarketContextQuery, dependencies: Dependencies = {}): Promise<MarketContext> {
  const clock = dependencies.clock ?? (() => new Date()); const now = clock();
  const cacheTtlMs = dependencies.cacheTtlMs ?? CACHE_TTL_MS; const key = `${input.symbol}:${input.timeframe}`;
  const cached = cache.get(key);
  if (!input.forceRefresh && cached && cached.expiresAtMs > now.getTime()) {
    return marketContextSchemaV1.parse({ ...cached.value, cache: { ...cached.value.cache, hit: true } });
  }
  const provider = dependencies.provider ?? new BinancePublicMarketProvider(clock);
  const observation = await provider.read(input);
  const maximumAgeMs = timeframeMilliseconds(input.timeframe) * 2;
  const context = buildContext(input, observation, now, maximumAgeMs, cacheTtlMs);
  cache.set(key, { value: context, expiresAtMs: now.getTime() + cacheTtlMs });
  return context;
}

export function clearMarketContextCache() { cache.clear(); }

export function buildContext(input: Pick<MarketContextQuery, 'symbol' | 'timeframe'>, observation: MarketObservation, now: Date, maximumAgeMs: number, cacheTtlMs = CACHE_TTL_MS): MarketContext {
  const candles = freshValue(observation.candles, now, maximumAgeMs);
  const funding = freshValue(observation.fundingRate, now, maximumAgeMs);
  const openInterest = freshValue(observation.openInterestDelta, now, maximumAgeMs);
  const orderBook = freshValue(observation.orderBookImbalance, now, maximumAgeMs);
  const btcDominance = freshValue(observation.btcDominance, now, maximumAgeMs);
  const news = freshValue(observation.newsSentiment, now, maximumAgeMs);
  const social = freshValue(observation.socialSentiment, now, maximumAgeMs);
  const whale = freshValue(observation.whaleBias, now, maximumAgeMs);
  const indicators = candles.value ? calculateIndicators(candles.value) : emptyIndicators();
  const markPrice = freshValue(observation.markPrice, now, maximumAgeMs).value;
  return marketContextSchemaV1.parse({
    schemaVersion: MARKET_CONTEXT_SCHEMA_VERSION, symbol: input.symbol, timeframe: input.timeframe, timestamp: now.toISOString(),
    market: {
      markPrice, ohlcv: (candles.value ?? []).map((item) => ({ ...item, openTime: item.openTime.toISOString() })),
      ...indicators, fundingRate: funding.value, openInterestDelta: openInterest.value,
      orderBookImbalance: orderBook.value, btcDominance: btcDominance.value,
    },
    intelligence: { newsSentiment: news.value, socialSentiment: social.value, whaleBias: whale.value },
    sources: {
      ohlcv: candles.freshness, funding: funding.freshness, openInterest: openInterest.freshness,
      orderBook: orderBook.freshness, btcDominance: btcDominance.freshness, news: news.freshness,
      social: social.freshness, whale: whale.freshness,
    },
    cache: { hit: false, expiresAt: new Date(now.getTime() + cacheTtlMs).toISOString() },
  });
}

function freshValue<T>(timed: TimedValue<T> | null, now: Date, maximumAgeMs: number) {
  if (!timed || !Number.isFinite(timed.observedAt.getTime())) return { value: null, freshness: { status: 'UNKNOWN' as const, observedAt: null, ageMs: null } };
  const ageMs = Math.max(0, now.getTime() - timed.observedAt.getTime()); const fresh = ageMs <= maximumAgeMs;
  return { value: fresh ? timed.value : null, freshness: { status: fresh ? 'FRESH' as const : 'STALE' as const, observedAt: timed.observedAt.toISOString(), ageMs } };
}

function calculateIndicators(candles: MarketCandle[]) {
  if (candles.length < 2) return emptyIndicators();
  const closes = candles.map((item) => item.close); const first = closes[0]!; const last = closes.at(-1)!;
  const trendReturn = first > 0 ? (last - first) / first : 0;
  const trueRanges = candles.slice(1).map((candle, index) => Math.max(candle.high - candle.low, Math.abs(candle.high - candles[index]!.close), Math.abs(candle.low - candles[index]!.close)));
  const atrWindow = trueRanges.slice(-14); const atr = average(atrWindow); const atrPct = last > 0 && atrWindow.length ? (atr / last) * 100 : null;
  const returns = closes.slice(1).map((close, index) => Math.log(close / closes[index]!));
  const volatilityValue = standardDeviation(returns);
  const volumeWindow = candles.slice(-21); const currentVolume = volumeWindow.at(-1)!.volume;
  const historicVolumes = volumeWindow.slice(0, -1).map((item) => item.volume); const averageVolume = average(historicVolumes);
  const trendThreshold = Math.max((atrPct ?? 0) / 100 * 0.25, 0.001);
  return {
    trend: trendReturn > trendThreshold ? 'BULLISH' as const : trendReturn < -trendThreshold ? 'BEARISH' as const : 'NEUTRAL' as const,
    trendStrength: Math.min(1, Math.abs(trendReturn) / Math.max(trendThreshold * 4, Number.EPSILON)),
    volatility: volatilityValue < 0.005 ? 'LOW' as const : volatilityValue > 0.02 ? 'HIGH' as const : 'MEDIUM' as const,
    atrPct, volumeRelative: averageVolume > 0 ? currentVolume / averageVolume : null,
  };
}

function emptyIndicators() { return { trend: null, trendStrength: null, volatility: null, atrPct: null, volumeRelative: null }; }
function average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function standardDeviation(values: number[]) { if (!values.length) return 0; const mean = average(values); return Math.sqrt(average(values.map((value) => (value - mean) ** 2))); }
function timeframeMilliseconds(timeframe: MarketContextQuery['timeframe']) { return ({ '1m': 60_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000, '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000 })[timeframe]; }
