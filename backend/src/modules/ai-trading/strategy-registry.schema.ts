import { z } from 'zod';

export const strategyFamilies = [
  'GRID',
  'TREND',
  'SMA_CROSSOVER',
  'EMA_TREND',
  'MACD_TREND',
  'RSI_MEAN_REVERSION',
  'BOLLINGER_MEAN_REVERSION',
  'DONCHIAN_BREAKOUT',
  'ATR_BREAKOUT',
  'MOMENTUM',
  'VOLUME_SPIKE',
  'FUNDING_SKEW',
  'BASIS_ARBITRAGE',
  'NEWS_REACTIVE',
  'DCA',
  'AI_LIMIT',
  'MULTI_AGENT',
  'CUSTOM',
] as const;

const parameterNameSchema = z.string().regex(/^[a-z][a-zA-Z0-9_]{0,63}$/);

const numberParameterSchema = z.object({
  type: z.literal('number'),
  min: z.number().finite(),
  max: z.number().finite(),
  step: z.number().finite().positive().optional(),
  default: z.number().finite(),
}).strict().superRefine((value, context) => {
  validateNumericBounds(value, context);
});

const integerParameterSchema = z.object({
  type: z.literal('integer'),
  min: z.number().int(),
  max: z.number().int(),
  step: z.number().int().positive().optional(),
  default: z.number().int(),
}).strict().superRefine((value, context) => {
  validateNumericBounds(value, context);
});

const booleanParameterSchema = z.object({
  type: z.literal('boolean'),
  default: z.boolean(),
}).strict();

const enumParameterSchema = z.object({
  type: z.literal('enum'),
  values: z.array(z.string().trim().min(1).max(80)).min(1).max(50),
  default: z.string().trim().min(1).max(80),
}).strict().superRefine((value, context) => {
  if (new Set(value.values).size !== value.values.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['values'], message: 'Enum değerleri benzersiz olmalıdır.' });
  }
  if (!value.values.includes(value.default)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['default'], message: 'Varsayılan değer izin verilen enum listesinde olmalıdır.' });
  }
});

const stringParameterSchema = z.object({
  type: z.literal('string'),
  minLength: z.number().int().min(0).max(1000).default(0),
  maxLength: z.number().int().min(1).max(1000).default(200),
  default: z.string().max(1000),
}).strict().superRefine((value, context) => {
  if (value.minLength > value.maxLength) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['maxLength'], message: 'Maksimum uzunluk minimum uzunluktan küçük olamaz.' });
  }
  if (value.default.length < value.minLength || value.default.length > value.maxLength) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['default'], message: 'Varsayılan değer uzunluk sınırları içinde olmalıdır.' });
  }
});

export const strategyParameterDefinitionSchema = z.union([
  numberParameterSchema,
  integerParameterSchema,
  booleanParameterSchema,
  enumParameterSchema,
  stringParameterSchema,
]);

export const strategyParameterSchemaSchema = z.object({
  parameters: z.record(parameterNameSchema, strategyParameterDefinitionSchema),
}).strict().superRefine((value, context) => {
  const count = Object.keys(value.parameters).length;
  if (count === 0 || count > 100) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['parameters'], message: 'Strateji 1 ile 100 arasında parametre tanımlamalıdır.' });
  }
});

const allowedMarketsSchema = z.array(z.enum(['SPOT', 'FUTURES'])).min(1).max(2)
  .transform((values) => [...new Set(values)]);
const timeframeSchema = z.string().trim().toLowerCase().regex(/^[1-9]\d{0,3}(?:m|h|d|w)$/);
const supportedTimeframesSchema = z.array(timeframeSchema).min(1).max(30)
  .transform((values) => [...new Set(values)]);

export const strategyVersionInputSchema = z.object({
  parameterSchema: strategyParameterSchemaSchema,
  allowedMarkets: allowedMarketsSchema,
  supportedTimeframes: supportedTimeframesSchema,
}).strict();

export const createStrategyBodySchema = z.object({
  family: z.enum(strategyFamilies),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().min(3).max(1000).optional(),
  initialVersion: strategyVersionInputSchema,
}).strict();

export const createStrategyVersionBodySchema = strategyVersionInputSchema;
export const strategyIdParamsSchema = z.object({ id: z.string().cuid() }).strict();
export const validateStrategyParametersBodySchema = z.object({
  version: z.number().int().positive().optional(),
  parameters: z.record(z.string(), z.unknown()),
}).strict();

export type StrategyParameterSchema = z.infer<typeof strategyParameterSchemaSchema>;
export type StrategyParameterDefinition = z.infer<typeof strategyParameterDefinitionSchema>;
export type CreateStrategyInput = z.infer<typeof createStrategyBodySchema>;
export type CreateStrategyVersionInput = z.infer<typeof createStrategyVersionBodySchema>;
export type ValidateStrategyParametersInput = z.infer<typeof validateStrategyParametersBodySchema>;

function validateNumericBounds(
  value: { min: number; max: number; step?: number | undefined; default: number },
  context: z.RefinementCtx,
) {
  if (value.min > value.max) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['max'], message: 'Maksimum değer minimum değerden küçük olamaz.' });
  }
  if (value.default < value.min || value.default > value.max) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['default'], message: 'Varsayılan değer izin verilen aralıkta olmalıdır.' });
  }
  if (value.step !== undefined && !isStepAligned(value.default, value.min, value.step)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['default'], message: 'Varsayılan değer parametre adımına uymalıdır.' });
  }
}

function isStepAligned(value: number, base: number, step: number) {
  const quotient = (value - base) / step;
  return Math.abs(quotient - Math.round(quotient)) < 1e-9;
}
