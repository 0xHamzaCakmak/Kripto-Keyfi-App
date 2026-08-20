import { z } from 'zod';

const mutationOperationSchema = z.object({
  parameter: z.string().trim().min(1).max(100),
  operation: z.enum(['ADD', 'PERCENT', 'SET']),
  value: z.number().finite(),
}).strict();

export const createMutationBodySchema = z.object({
  parentBotId: z.string().min(1),
  generationId: z.string().min(1),
  name: z.string().trim().min(3).max(100),
  reason: z.string().trim().min(3).max(1000),
  mutations: z.array(mutationOperationSchema).min(1).max(10),
  timeframe: z.string().trim().toLowerCase().regex(/^\d{1,4}[mhdw]$/).max(20).optional(),
}).strict().superRefine((value, context) => {
  if (new Set(value.mutations.map((item) => item.parameter)).size !== value.mutations.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['mutations'], message: 'Each parameter may be mutated once.' });
  }
});

export const mutationsQuerySchema = z.object({
  parentBotId: z.string().min(1).optional(),
  generationId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
}).strict();

export type CreateMutationInput = z.infer<typeof createMutationBodySchema>;
export type MutationsQuery = z.infer<typeof mutationsQuerySchema>;
