import { z } from 'zod';

const shadowActionSchema = z.enum(['WOULD_OPEN', 'WOULD_CLOSE', 'WOULD_MOVE_STOP']);

export const shadowTradesQuerySchema = z.object({
  botId: z.string().cuid().optional(),
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5,30}$/).optional(),
  action: shadowActionSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'End time must not precede start time.' });
  }
});

export const shadowSummaryQuerySchema = z.object({
  botId: z.string().cuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'End time must not precede start time.' });
  }
});

export type ShadowTradesQuery = z.infer<typeof shadowTradesQuerySchema>;
export type ShadowSummaryQuery = z.infer<typeof shadowSummaryQuerySchema>;
