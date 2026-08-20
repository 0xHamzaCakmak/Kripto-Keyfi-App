import { z } from 'zod';
import { autonomousTradingStatuses } from './core-domain.js';

const positiveDecimal = z.string().trim().regex(/^(?!0+(?:\.0+)?$)\d{1,18}(?:\.\d{1,18})?$/);
const symbolSchema = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,40}$/);
const symbolsSchema = z.array(symbolSchema).min(1).max(50).superRefine((symbols, context) => {
  if (new Set(symbols).size !== symbols.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Symbols must be unique.' });
  }
});
const timeframeSchema = z.string().trim().toLowerCase().regex(/^\d{1,4}[mhdw]$/).max(20);
const parametersSchema = z.record(z.string(), z.unknown());
const safeModeSchema = z.enum(['PAPER', 'SHADOW']).default('PAPER');

export const createFactoryBotBodySchema = z.object({
  name: z.string().trim().min(3).max(100),
  strategyVersionId: z.string().min(1),
  exchangeAccountId: z.string().min(1),
  parameters: parametersSchema,
  startingPaperBalance: positiveDecimal.default('100'),
  symbols: symbolsSchema,
  timeframe: timeframeSchema,
  mode: safeModeSchema,
  riskProfileId: z.string().min(1),
  generationId: z.string().min(1).optional(),
}).strict();

const cloneOverrides = {
  name: z.string().trim().min(3).max(100),
  startingPaperBalance: positiveDecimal.optional(),
  symbols: symbolsSchema.optional(),
  timeframe: timeframeSchema.optional(),
  mode: safeModeSchema,
  riskProfileId: z.string().min(1).optional(),
  generationId: z.string().min(1).optional(),
} as const;

export const cloneFactoryBotBodySchema = z.object(cloneOverrides).strict();

export const createParameterVariantBodySchema = z.object({
  ...cloneOverrides,
  parameterOverrides: parametersSchema.refine((value) => Object.keys(value).length > 0, {
    message: 'At least one parameter override is required.',
  }),
}).strict();

export const transitionFactoryBotBodySchema = z.object({
  status: z.enum(autonomousTradingStatuses),
}).strict();

export const factoryBotIdParamsSchema = z.object({ id: z.string().min(1) }).strict();

export type CreateFactoryBotInput = z.infer<typeof createFactoryBotBodySchema>;
export type CloneFactoryBotInput = z.infer<typeof cloneFactoryBotBodySchema>;
export type CreateParameterVariantInput = z.infer<typeof createParameterVariantBodySchema>;
export type TransitionFactoryBotInput = z.infer<typeof transitionFactoryBotBodySchema>;
