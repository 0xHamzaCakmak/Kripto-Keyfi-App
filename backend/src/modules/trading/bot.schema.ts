import { z } from 'zod';

const positiveDecimal = z.string().trim().regex(/^(?!0+(?:\.0+)?$)\d{1,18}(?:\.\d{1,18})?$/);
const symbol = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,40}$/);

const scalpingConfigurationSchema = z.object({
  side: z.enum(['BUY', 'SELL', 'BOTH']).default('BOTH'),
  quantity: positiveDecimal,
  leverage: z.number().int().min(1).max(20),
  marginMode: z.enum(['ISOLATED', 'CROSS']).default('ISOLATED'),
  signalThresholdBps: z.number().int().min(1).max(1000).default(25),
  paperFeeBps: z.number().min(0).max(100).default(4),
  paperSlippageBps: z.number().min(0).max(100).default(2),
}).strict();

export const gridConfigurationSchema = z.object({
  marketType: z.literal('FUTURES').default('FUTURES'),
  gridDirection: z.literal('NEUTRAL').default('NEUTRAL'),
  spacingType: z.literal('ARITHMETIC').default('ARITHMETIC'),
  lowerPrice: positiveDecimal,
  upperPrice: positiveDecimal,
  gridLevels: z.number().int().min(2).max(100),
  quantityPerGrid: positiveDecimal,
  leverage: z.number().int().min(1).max(20),
  marginMode: z.enum(['ISOLATED', 'CROSS']).default('ISOLATED'),
  paperFeeBps: z.number().min(0).max(100).default(4),
  paperSlippageBps: z.number().min(0).max(100).default(2),
}).strict().superRefine((value, context) => {
  if (Number(value.lowerPrice) >= Number(value.upperPrice)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['upperPrice'], message: 'Üst fiyat alt fiyattan büyük olmalıdır.' });
  }
});

export const createBotBodySchema = z.discriminatedUnion('type', [
  z.object({
    name: z.string().trim().min(3).max(100), exchangeAccountId: z.string().min(1), type: z.literal('SCALPING'),
    mode: z.enum(['SHADOW', 'PAPER']), symbol, intervalSeconds: z.number().int().min(10).max(3600).default(60),
    configuration: scalpingConfigurationSchema,
  }).strict(),
  z.object({
    name: z.string().trim().min(3).max(100), exchangeAccountId: z.string().min(1), type: z.literal('GRID'),
    mode: z.enum(['SHADOW', 'PAPER']), symbol, intervalSeconds: z.number().int().min(10).max(3600).default(60),
    configuration: gridConfigurationSchema,
  }).strict(),
]);

export const botIdParamsSchema = z.object({ id: z.string().min(1) }).strict();
export const gridPlanPreviewBodySchema = z.object({
  exchangeAccountId: z.string().min(1),
  symbol,
  configuration: gridConfigurationSchema,
}).strict();

export type CreateBotInput = z.infer<typeof createBotBodySchema>;
export type GridPlanPreviewInput = z.infer<typeof gridPlanPreviewBodySchema>;
