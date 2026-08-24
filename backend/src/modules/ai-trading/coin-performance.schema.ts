import { z } from 'zod';
import { marketRegimes } from './core-domain.js';

export const coinPerformanceQuerySchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5,30}$/).optional(),
  regime: z.enum(marketRegimes).optional(), limit: z.coerce.number().int().min(1).max(500).default(100),
}).strict();
