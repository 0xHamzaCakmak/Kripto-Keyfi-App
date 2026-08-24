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
  const ema9 = exponentialAverage(closes, 9); const ema21 = exponentialAverage(closes, 21);
  const macdSeries = closes.map((_, index) => exponentialAverage(closes.slice(0, index + 1), 12) - exponentialAverage(closes.slice(0, index + 1), 26));
  const macd = closes.length >= 26 ? macdSeries.at(-1)! : null; const macdSignal = closes.length >= 34 ? exponentialAverage(macdSeries.slice(25), 9) : null;
  const bollingerWindow = closes.slice(-20); const bollingerMiddle = bollingerWindow.length >= 20 ? average(bollingerWindow) : null;
  const bollingerDeviation = bollingerMiddle === null ? null : standardDeviation(bollingerWindow);
  const totalVolume = candles.reduce((sum, candle) => sum + candle.volume, 0);
  return {
    trend: trendReturn > trendThreshold ? 'BULLISH' as const : trendReturn < -trendThreshold ? 'BEARISH' as const : 'NEUTRAL' as const,
    trendStrength: Math.min(1, Math.abs(trendReturn) / Math.max(trendThreshold * 4, Number.EPSILON)),
    volatility: volatilityValue < 0.005 ? 'LOW' as const : volatilityValue > 0.02 ? 'HIGH' as const : 'MEDIUM' as const,
    atrPct, volumeRelative: averageVolume > 0 ? currentVolume / averageVolume : null,
    ema9, ema21, rsi14: calculateRsi(closes, 14), macd, macdSignal, adx14: calculateAdx(candles, 14),
    bollingerUpper: bollingerMiddle === null || bollingerDeviation === null ? null : bollingerMiddle + 2 * bollingerDeviation,
    bollingerMiddle, bollingerLower: bollingerMiddle === null || bollingerDeviation === null ? null : bollingerMiddle - 2 * bollingerDeviation,
    vwap: totalVolume > 0 ? candles.reduce((sum, candle) => sum + ((candle.high + candle.low + candle.close) / 3) * candle.volume, 0) / totalVolume : null,
    momentumPct: trendReturn * 100,
  };
}

function emptyIndicators() { return { trend: null, trendStrength: null, volatility: null, atrPct: null, volumeRelative: null,
  ema9: null, ema21: null, rsi14: null, macd: null, macdSignal: null, adx14: null,
  bollingerUpper: null, bollingerMiddle: null, bollingerLower: null, vwap: null, momentumPct: null }; }
function average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function standardDeviation(values: number[]) { if (!values.length) return 0; const mean = average(values); return Math.sqrt(average(values.map((value) => (value - mean) ** 2))); }
function exponentialAverage(values: number[], period: number) { if (!values.length) return 0; const alpha = 2 / (period + 1); return values.slice(1).reduce((result, value) => value * alpha + result * (1 - alpha), values[0]!); }
function calculateRsi(values: number[], period: number) { if (values.length <= period) return null; const changes = values.slice(-period - 1).slice(1).map((value, index) => value - values.slice(-period - 1)[index]!); const gains = average(changes.map((change) => Math.max(0, change))); const losses = average(changes.map((change) => Math.max(0, -change))); return losses === 0 ? 100 : 100 - 100 / (1 + gains / losses); }
function calculateAdx(candles: MarketCandle[], period: number) { if (candles.length <= period) return null; const recent = candles.slice(-period - 1); let plus = 0; let minus = 0; let range = 0; for (let index = 1; index < recent.length; index += 1) { const current = recent[index]!; const previous = recent[index - 1]!; const up = current.high - previous.high; const down = previous.low - current.low; plus += up > down && up > 0 ? up : 0; minus += down > up && down > 0 ? down : 0; range += Math.max(current.high - current.low, Math.abs(current.high - previous.close), Math.abs(current.low - previous.close)); } if (range <= 0) return 0; const plusDi = plus / range * 100; const minusDi = minus / range * 100; return plusDi + minusDi === 0 ? 0 : Math.abs(plusDi - minusDi) / (plusDi + minusDi) * 100; }
function timeframeMilliseconds(timeframe: MarketContextQuery['timeframe']) { return ({ '1m': 60_000, '5m': 300_000, '15m': 900_000, '30m': 1_800_000, '1h': 3_600_000, '4h': 14_400_000, '1d': 86_400_000 })[timeframe]; }
