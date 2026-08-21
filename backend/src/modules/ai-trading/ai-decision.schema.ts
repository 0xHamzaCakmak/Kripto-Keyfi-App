import { z } from 'zod';
import { marketRegimes } from './core-domain.js';

export const AI_DECISION_SCHEMA_VERSION = '1.0.0' as const;
export const aiDecisionKinds = ['LONG', 'SHORT', 'WAIT', 'HOLD', 'CLOSE', 'PARTIAL_CLOSE', 'MOVE_STOP', 'NO_TRADE'] as const;

const symbolSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5,30}$/);
const priceSchema = z.union([
  z.number().finite().positive().transform((value) => value.toString()),
  z.string().trim().regex(/^\d+(?:\.\d+)?$/).refine((value) => Number(value) > 0, 'price must be positive'),
]);

export const aiDecisionSchemaV1 = z.object({
  schemaVersion: z.literal(AI_DECISION_SCHEMA_VERSION),
  symbol: symbolSchema,
  decision: z.enum(aiDecisionKinds),
  confidence: z.number().finite().min(0).max(1),
  strategy: z.string().trim().min(1).max(80),
  marketRegime: z.enum(marketRegimes),
  entryZone: z.tuple([priceSchema, priceSchema]).nullable().default(null),
  invalidation: priceSchema.nullable().default(null),
  targets: z.array(priceSchema).max(5).default([]),
  reasonSummary: z.array(z.string().trim().min(3).max(160)).min(1).max(4),
}).strict().superRefine((decision, context) => {
  if (decision.entryZone && Number(decision.entryZone[0]) > Number(decision.entryZone[1])) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['entryZone'], message: 'entryZone must be ordered low to high' });
  }
  if ((decision.decision === 'LONG' || decision.decision === 'SHORT')
    && (!decision.entryZone || !decision.invalidation || decision.targets.length === 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['decision'], message: 'directional decisions require entryZone, invalidation and targets' });
  }
  if (decision.decision === 'MOVE_STOP' && !decision.invalidation) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['invalidation'], message: 'MOVE_STOP requires a new invalidation price' });
  }
});

export type AIDecision = z.infer<typeof aiDecisionSchemaV1>;
export type AIDecisionKind = (typeof aiDecisionKinds)[number];
