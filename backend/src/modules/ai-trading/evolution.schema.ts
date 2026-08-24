import { z } from 'zod';

const evolutionConfigObject = z.object({
  populationSize: z.number().int().min(1).max(1000).default(100),
  survivorCount: z.number().int().min(1).max(500).default(20),
  mutationCount: z.number().int().min(0).max(1000).default(60),
  crossoverCount: z.number().int().min(0).max(1000).default(20),
  researcherCandidateCount: z.number().int().min(0).max(1000).default(0),
  maxGenerations: z.number().int().min(1).max(1000).default(20),
  minimumTrades: z.number().int().min(1).max(1_000_000).default(50),
}).strict();

export const evolutionConfigSchema = evolutionConfigObject.superRefine((value, context) => {
  if (value.survivorCount + value.mutationCount + value.crossoverCount + value.researcherCandidateCount !== value.populationSize) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['populationSize'], message: 'Population size must equal survivors, mutations, crossovers and researcher candidates.' });
  }
  if (value.survivorCount > value.populationSize) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['survivorCount'], message: 'Survivor count cannot exceed population size.' });
  }
});

export const runEvolutionBodySchema = z.object({
  sourceGenerationId: z.string().min(1),
  config: evolutionConfigObject.partial().optional(),
}).strict();

export const evolutionRunsQuerySchema = z.object({
  status: z.enum(['RUNNING', 'COMPLETED', 'FAILED']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
}).strict();

export type EvolutionConfig = z.infer<typeof evolutionConfigSchema>;
export type RunEvolutionInput = z.infer<typeof runEvolutionBodySchema>;
export type EvolutionRunsQuery = z.infer<typeof evolutionRunsQuerySchema>;
export const DEFAULT_EVOLUTION_CONFIG = evolutionConfigSchema.parse({});
