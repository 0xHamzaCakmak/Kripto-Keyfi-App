import { z } from 'zod';
import { marketRegimes } from './core-domain.js';

export const marketRegimeLeaderboardParamsSchema = z.object({
  regime: z.enum(marketRegimes),
}).strict();

export const marketRegimeLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
}).strict();
