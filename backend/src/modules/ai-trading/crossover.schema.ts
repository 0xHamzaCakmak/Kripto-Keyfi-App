import { z } from 'zod';

export const createCrossoverBodySchema = z.object({
  parentABotId: z.string().min(1),
  parentBBotId: z.string().min(1),
  generationId: z.string().min(1),
  name: z.string().trim().min(3).max(100),
  inheritFromB: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  generatedFields: z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean()])).default({}),
}).strict().superRefine((value, context) => {
  if (value.parentABotId === value.parentBBotId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['parentBBotId'], message: 'Crossover parents must be different.' });
  if (new Set(value.inheritFromB).size !== value.inheritFromB.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['inheritFromB'], message: 'Inherited fields must be unique.' });
  if (Object.keys(value.generatedFields).length > 100) context.addIssue({ code: z.ZodIssueCode.custom, path: ['generatedFields'], message: 'Generated fields are limited to 100.' });
});

export const crossoversQuerySchema = z.object({
  generationId: z.string().min(1).optional(), parentBotId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
}).strict();

export type CreateCrossoverInput = z.infer<typeof createCrossoverBodySchema>;
export type CrossoversQuery = z.infer<typeof crossoversQuerySchema>;
