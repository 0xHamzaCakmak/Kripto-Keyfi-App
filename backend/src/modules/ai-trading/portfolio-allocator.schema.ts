import { z } from 'zod';

export const portfolioAllocatorBodySchema = z.object({
  exchangeAccountId: z.string().cuid(),
  mode: z.enum(['PAPER', 'SHADOW']).default('PAPER'),
  capital: z.number().finite().positive().max(1_000_000_000),
  cashReservePct: z.number().finite().min(0.1).max(0.95).default(0.25),
  maxBotAllocationPct: z.number().finite().positive().max(0.5).default(0.3),
  maxSymbolAllocationPct: z.number().finite().positive().max(0.75).default(0.5),
  maxMetricAgeMinutes: z.number().int().min(1).max(43_200).default(1_440),
}).strict().superRefine((value, context) => {
  if (value.maxBotAllocationPct > value.maxSymbolAllocationPct) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['maxBotAllocationPct'], message: 'Bot allocation cannot exceed symbol allocation.' });
  }
});

export const portfolioAllocationQuerySchema = z.object({
  exchangeAccountId: z.string().cuid().optional(),
  mode: z.enum(['PAPER', 'SHADOW']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
}).strict();

export type PortfolioAllocatorInput = z.infer<typeof portfolioAllocatorBodySchema>;
