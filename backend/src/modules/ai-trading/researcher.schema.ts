import { StrategyFamily } from '@prisma/client';
import { z } from 'zod';

export const runResearcherBodySchema = z.object({
  strategyFamily: z.nativeEnum(StrategyFamily).optional(),
  minimumTrades: z.number().int().min(10).max(10_000).default(50),
}).strict();

export const researchHypothesesQuerySchema = z.object({
  strategyFamily: z.nativeEnum(StrategyFamily).optional(),
  status: z.enum(['DRAFT', 'REVIEWED', 'ACCEPTED', 'REJECTED']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
}).strict();

export type RunResearcherInput = z.infer<typeof runResearcherBodySchema>;
export type ResearchHypothesesQuery = z.infer<typeof researchHypothesesQuerySchema>;
