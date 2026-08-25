import { z } from 'zod';
import { marketRegimes } from './core-domain.js';

export const tradeMemoryQuerySchema = z.object({
  source: z.enum(['ALL', 'PAPER', 'TESTNET']).default('ALL'),
  botId: z.string().cuid().optional(),
  strategyVersionId: z.string().cuid().optional(),
  symbol: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()).optional(),
  regime: z.enum(marketRegimes).optional(),
  side: z.enum(['BUY', 'SELL']).optional(),
  outcome: z.enum(['ALL', 'BEST', 'FAILURE']).default('ALL'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
}).strict();

export const tradeMemorySummaryQuerySchema = z.object({
  groupBy: z.enum(['BOT', 'STRATEGY', 'REGIME', 'SYMBOL']),
  botId: z.string().cuid().optional(),
  strategyVersionId: z.string().cuid().optional(),
  symbol: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()).optional(),
  regime: z.enum(marketRegimes).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
}).strict();
export const tradeMemoryStatsQuerySchema = tradeMemoryQuerySchema.omit({ limit: true });

export type TradeMemoryQuery = z.infer<typeof tradeMemoryQuerySchema>;
export type TradeMemorySummaryQuery = z.infer<typeof tradeMemorySummaryQuerySchema>;
export type TradeMemoryStatsQuery = z.infer<typeof tradeMemoryStatsQuerySchema>;
