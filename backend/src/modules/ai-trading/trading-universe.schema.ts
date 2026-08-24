import { z } from 'zod';

export const tradingUniverseAssetParamsSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,20}USDT$/),
}).strict();

export const updateTradingUniverseAssetSchema = z.object({ enabled: z.boolean() }).strict();

export const searchTradingUniverseSchema = z.object({
  q: z.string().trim().toUpperCase().max(20).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

export const addTradingUniverseAssetSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,20}USDT$/),
}).strict();

export type SearchTradingUniverseQuery = z.infer<typeof searchTradingUniverseSchema>;
