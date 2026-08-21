import { z } from 'zod';

const liveEligibilityConfigObject = z.object({
  minPaperTrades: z.number().int().min(1).max(1_000_000).default(200),
  minPaperDurationDays: z.number().finite().min(0).max(3650).default(7),
  maxDrawdown: z.number().finite().min(0).max(1).default(0.2),
  minProfitFactor: z.number().finite().min(0).max(1000).default(1.2),
  minRiskAdjustedScore: z.number().finite().min(0).max(100).default(60),
  minRegimeCoverage: z.number().int().min(1).max(8).default(3),
  minShadowDurationDays: z.number().finite().min(0).max(3650).default(7),
  minShadowCloseTrades: z.number().int().min(1).max(1_000_000).default(20),
  minShadowProfitFactor: z.number().finite().min(0).max(1000).default(1),
  maxShadowDrawdown: z.number().finite().min(0).max(1).default(0.2),
  criticalRiskLookbackHours: z.number().int().min(1).max(8760).default(168),
}).strict();

export const liveEligibilityConfigSchema = liveEligibilityConfigObject;
export const runLiveEligibilityBodySchema = liveEligibilityConfigObject.partial().extend({
  botId: z.string().cuid().optional(),
}).strict().transform(({ botId, ...partial }) => ({ botId, config: liveEligibilityConfigObject.parse(partial) }));

export type LiveEligibilityConfig = z.infer<typeof liveEligibilityConfigSchema>;
export type RunLiveEligibilityInput = z.infer<typeof runLiveEligibilityBodySchema>;
export const DEFAULT_LIVE_ELIGIBILITY_CONFIG = liveEligibilityConfigObject.parse({});
