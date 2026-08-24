import { z } from 'zod';

export const tradingUniverseAssetParamsSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,20}USDT$/),
}).strict();

export const updateTradingUniverseAssetSchema = z.object({ enabled: z.boolean() }).strict();
