import { z } from 'zod';

const championSelectionConfigObject = z.object({
  minTrades: z.number().int().min(1).max(1_000_000).default(200),
  minPaperDurationDays: z.number().min(0).max(3650).default(7),
  minProfitFactor: z.number().min(0).max(1000).default(1.2),
  maxDrawdown: z.number().min(0).max(1).default(0.2),
  minBotScore: z.number().min(0).max(100).default(60),
  minRegimeCoverage: z.number().int().min(1).max(8).default(3),
  topChallengers: z.number().int().min(1).max(1000).default(20),
  topChampions: z.number().int().min(1).max(1000).default(10),
}).strict();

export const championSelectionConfigSchema = championSelectionConfigObject.superRefine((value, context) => {
  if (value.topChampions > value.topChallengers) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['topChampions'], message: 'Top Champions cannot exceed Top Challengers.' });
  }
});

export const runChampionSelectionBodySchema = championSelectionConfigObject.partial().pipe(championSelectionConfigSchema);

export type ChampionSelectionConfig = z.infer<typeof championSelectionConfigSchema>;
export const DEFAULT_CHAMPION_SELECTION_CONFIG = championSelectionConfigSchema.parse({});
