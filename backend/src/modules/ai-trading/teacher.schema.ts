import { z } from 'zod';

export const teacherSeveritySchema = z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH']);

export const runTeacherBodySchema = z.object({
  botId: z.string().cuid().optional(),
  strategyId: z.string().cuid().optional(),
}).strict().superRefine((value, context) => {
  if (value.botId && value.strategyId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Select either a bot or a strategy target.', path: ['strategyId'] });
  }
});

export const teacherEvaluationsQuerySchema = z.object({
  botId: z.string().cuid().optional(),
  strategyId: z.string().cuid().optional(),
  severity: teacherSeveritySchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
}).strict().superRefine((value, context) => {
  if (value.botId && value.strategyId) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Select either a bot or a strategy target.', path: ['strategyId'] });
  }
});

export type RunTeacherInput = z.infer<typeof runTeacherBodySchema>;
export type TeacherEvaluationsQuery = z.infer<typeof teacherEvaluationsQuerySchema>;
