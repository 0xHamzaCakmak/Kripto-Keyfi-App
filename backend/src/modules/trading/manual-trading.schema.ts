import { z } from 'zod';

const decimal = z.string().trim().regex(/^\d+(?:\.\d{1,18})?$/).max(55);
export const tradingAccountQuerySchema = z.object({ exchangeAccountId: z.string().cuid() }).strict();
export const tradingEventsQuerySchema = tradingAccountQuerySchema.extend({ cursor: z.string().regex(/^\d+$/).optional() }).strict();

export const previewOrderBodySchema = z.object({
  exchangeAccountId: z.string().cuid(),
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/),
  side: z.enum(['BUY', 'SELL']),
  type: z.enum(['MARKET', 'LIMIT', 'STOP_MARKET', 'STOP_LIMIT']),
  quantity: decimal,
  price: decimal.optional(),
  stopPrice: decimal.optional(),
  leverage: z.number().int().min(1).max(125),
  marginMode: z.enum(['ISOLATED', 'CROSS']),
  reduceOnly: z.boolean().default(false),
}).strict().superRefine((value, context) => {
  if ((value.type === 'LIMIT' || value.type === 'STOP_LIMIT') && !value.price) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], message: 'Limit emirlerinde fiyat zorunludur' });
  }
  if ((value.type === 'STOP_MARKET' || value.type === 'STOP_LIMIT') && !value.stopPrice) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['stopPrice'], message: 'Koşullu emirlerde tetikleme fiyatı zorunludur' });
  }
});

export const submitOrderBodySchema = z.object({
  previewId: z.string().cuid(),
  idempotencyKey: z.string().trim().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

export const cancelOrderParamsSchema = z.object({ id: z.string().trim().min(1).max(100) });
export const cancelOrderBodySchema = z.object({
  exchangeAccountId: z.string().cuid(),
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/),
  idempotencyKey: z.string().trim().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

export const closePositionParamsSchema = z.object({ id: z.string().trim().min(3).max(100) });
export const closePositionBodySchema = z.object({
  exchangeAccountId: z.string().cuid(),
  quantity: decimal.optional(),
  type: z.enum(['MARKET', 'LIMIT']).default('MARKET'),
  price: decimal.optional(),
  idempotencyKey: z.string().trim().min(16).max(80).regex(/^[A-Za-z0-9_-]+$/),
}).strict().superRefine((value, context) => {
  if (value.type === 'LIMIT' && !value.price) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['price'], message: 'Limit kapatma emrinde fiyat zorunludur' });
  }
});

export const publishMentorSignalBodySchema = z.object({
  exchangeAccountId: z.string().cuid(),
}).strict();

export type PreviewOrderInput = z.infer<typeof previewOrderBodySchema>;
export type SubmitOrderInput = z.infer<typeof submitOrderBodySchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderBodySchema>;
export type ClosePositionInput = z.infer<typeof closePositionBodySchema>;
export type PublishMentorSignalInput = z.infer<typeof publishMentorSignalBodySchema>;
