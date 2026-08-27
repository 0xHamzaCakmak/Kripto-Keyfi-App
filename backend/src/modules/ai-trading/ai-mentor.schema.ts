import { z } from 'zod';

const actionSchema = z.enum(['HOLD', 'BUY', 'SELL']);

export const aiMentorRequestSchema = z.object({
  schemaVersion: z.literal('trading-bot-observer-v1'),
  bot: z.object({ id: z.string().min(1).max(100), type: z.string().max(40), mode: z.string().max(20), symbol: z.string().regex(/^[A-Z0-9]{5,30}$/) }).strict(),
  market: z.object({ markPrice: z.string().max(80), referencePrice: z.string().max(80) }).strict(),
  ruleDecision: z.object({ kind: z.string().max(40), action: actionSchema, summary: z.string().max(500), metrics: z.record(z.unknown()).optional() }).strict(),
  constraints: z.object({ allowedActions: z.array(actionSchema).max(3), executionAllowed: z.boolean(), submittedToExchange: z.boolean(), comparisonOnly: z.boolean() }).strict(),
}).strict();

export const aiMentorModelOutputSchema = z.object({
  decision: z.enum(['long', 'short', 'hold']),
  confidence: z.number().finite().min(0).max(1),
  reasoning_summary: z.string().trim().min(5).max(200),
  invalidation_level: z.number().finite().nonnegative(),
  suggested_leverage: z.number().int().min(0).max(125),
  agrees_with_rule_engine: z.boolean(),
}).strict();

export type AIMentorRequest = z.infer<typeof aiMentorRequestSchema>;
export type AIMentorModelOutput = z.infer<typeof aiMentorModelOutputSchema>;
