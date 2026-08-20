import { z } from 'zod';
import { ANALYTICS_EVENT_NAMES } from './analytics-events.service.js';

export const rangeSchema = z.enum(['today', '7d', '30d', '90d', 'custom']).default('30d');
export const rangeQuerySchema = z.object({
  range: rangeSchema,
  start: z.string().date().optional(),
  end: z.string().date().optional(),
}).superRefine((value, context) => {
  if (value.range === 'custom' && (!value.start || !value.end)) context.addIssue({ code: z.ZodIssueCode.custom, message: 'custom range requires start and end dates' });
  if (value.start && value.end && value.start > value.end) context.addIssue({ code: z.ZodIssueCode.custom, message: 'start date must be before end date' });
});
export const eventBodySchema = z.object({
  eventName: z.enum(ANALYTICS_EVENT_NAMES),
  sessionId: z.string().trim().max(64).optional(),
  pagePath: z.string().trim().max(500).optional(),
  metadata: z.record(z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()])).optional(),
});
export const funnelQuerySchema = z.object({
  steps: z.string().transform((value) => value.split(',').map((item) => item.trim()).filter(Boolean))
    .pipe(z.array(z.enum(ANALYTICS_EVENT_NAMES)).min(1).max(8)),
});
export const contentQuerySchema = rangeQuerySchema.and(z.object({
  event_name: z.enum(['video_open', 'news_open', 'coin_view', 'article_read']),
}));
