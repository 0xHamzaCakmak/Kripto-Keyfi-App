import { z } from 'zod';

export const MARKET_CONTEXT_SCHEMA_VERSION = '1.0.0' as const;
export const marketContextTimeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'] as const;

const nullableFinite = z.number().finite().nullable();
const sourceStateSchema = z.object({
  status: z.enum(['FRESH', 'STALE', 'UNKNOWN']),
  observedAt: z.string().datetime().nullable(),
  ageMs: z.number().int().nonnegative().nullable(),
}).strict();

export const marketContextSchemaV1 = z.object({
  schemaVersion: z.literal(MARKET_CONTEXT_SCHEMA_VERSION),
  symbol: z.string().regex(/^[A-Z0-9]{5,30}$/),
  timeframe: z.enum(marketContextTimeframes),
  timestamp: z.string().datetime(),
  market: z.object({
    markPrice: nullableFinite,
    ohlcv: z.array(z.object({
      openTime: z.string().datetime(), open: z.number().finite(), high: z.number().finite(),
      low: z.number().finite(), close: z.number().finite(), volume: z.number().finite().nonnegative(),
    }).strict()),
    trend: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']).nullable(),
    trendStrength: z.number().finite().min(0).max(1).nullable(),
    volatility: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullable(),
    atrPct: nullableFinite,
    volumeRelative: nullableFinite,
    ema9: nullableFinite, ema21: nullableFinite, rsi14: nullableFinite,
    macd: nullableFinite, macdSignal: nullableFinite, adx14: nullableFinite,
    bollingerUpper: nullableFinite, bollingerMiddle: nullableFinite, bollingerLower: nullableFinite,
    vwap: nullableFinite, momentumPct: nullableFinite,
    fundingRate: nullableFinite,
    openInterestDelta: nullableFinite,
    orderBookImbalance: z.number().finite().min(-1).max(1).nullable(),
    btcDominance: nullableFinite,
  }).strict(),
  intelligence: z.object({
    newsSentiment: z.number().finite().min(-1).max(1).nullable(),
    socialSentiment: z.number().finite().min(-1).max(1).nullable(),
    whaleBias: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']).nullable(),
  }).strict(),
  sources: z.object({
    ohlcv: sourceStateSchema, funding: sourceStateSchema, openInterest: sourceStateSchema,
    orderBook: sourceStateSchema, btcDominance: sourceStateSchema, news: sourceStateSchema,
    social: sourceStateSchema, whale: sourceStateSchema,
  }).strict(),
  cache: z.object({ hit: z.boolean(), expiresAt: z.string().datetime() }).strict(),
}).strict();

export const marketContextQuerySchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5,30}$/).default('BTCUSDT'),
  timeframe: z.enum(marketContextTimeframes).default('15m'),
  forceRefresh: z.enum(['true', 'false']).transform((value) => value === 'true').default('false'),
}).strict();

export type MarketContext = z.infer<typeof marketContextSchemaV1>;
export type MarketContextQuery = z.infer<typeof marketContextQuerySchema>;
