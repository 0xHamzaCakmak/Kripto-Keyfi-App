import { z } from 'zod';
import { marketContextTimeframes } from './market-intelligence.schema.js';

export const routeStrategyBodySchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5,30}$/),
  timeframe: z.enum(marketContextTimeframes),
  maxBots: z.number().int().min(1).max(50).default(5),
  minimumRegimeScore: z.number().finite().min(0).max(100).default(40),
  maxRegimeAgeMinutes: z.number().int().min(1).max(10_080).default(60),
  maxMetricAgeMinutes: z.number().int().min(1).max(43_200).default(1_440),
  maxHeartbeatAgeMinutes: z.number().int().min(1).max(1_440).default(5),
}).strict();

export type RouteStrategyInput = z.infer<typeof routeStrategyBodySchema>;
export const DEFAULT_STRATEGY_ROUTER_CONFIG = routeStrategyBodySchema.omit({ symbol: true, timeframe: true }).parse({});
