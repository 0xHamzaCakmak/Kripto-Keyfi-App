import { Prisma } from '@prisma/client';
import { z } from 'zod';

const decimal = z.string().trim().regex(/^(?!0+(?:\.0+)?$)\d{1,18}(?:\.\d{1,18})?$/);
export const gridDemoInputSchema = z.object({
  exchangeAccountId: z.string().min(1),
  name: z.string().trim().min(3).max(80),
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,35}USDT$/),
  marketType: z.enum(['SPOT', 'FUTURES']),
  direction: z.enum(['LONG', 'SHORT', 'NEUTRAL']).default('NEUTRAL'),
  spacingType: z.enum(['ARITHMETIC', 'GEOMETRIC']).default('ARITHMETIC'),
  lowerPrice: decimal, upperPrice: decimal,
  interval: decimal,
  investment: decimal,
  leverage: z.number().int().min(1).max(5).default(2),
  reservePercent: z.number().min(20).max(80).default(30),
  maxLoss: decimal,
  stopLowerPrice: decimal,
  stopUpperPrice: decimal.optional(),
}).strict().superRefine((v, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  if (new Prisma.Decimal(v.lowerPrice).gte(v.upperPrice)) issue('upperPrice', 'Üst fiyat alt fiyattan büyük olmalıdır.');
  if (new Prisma.Decimal(v.stopLowerPrice).gte(v.lowerPrice)) issue('stopLowerPrice', 'Alt stop, grid alt sınırından düşük olmalıdır.');
  if (v.marketType === 'FUTURES' && v.direction !== 'LONG' && !v.stopUpperPrice) issue('stopUpperPrice', 'Short içeren grid için üst stop zorunludur.');
  if (v.stopUpperPrice && new Prisma.Decimal(v.stopUpperPrice).lte(v.upperPrice)) issue('stopUpperPrice', 'Üst stop, grid üst sınırından yüksek olmalıdır.');
  if (new Prisma.Decimal(v.maxLoss).gte(v.investment)) issue('maxLoss', 'Zarar sınırı ayrılan sermayeden düşük olmalıdır.');
  if (v.marketType === 'SPOT' && (v.leverage !== 1 || v.direction !== 'LONG')) issue('marketType', 'Spot grid yalnızca kaldıraçsız alış/satış döngüsüdür.');
  if (v.spacingType === 'GEOMETRIC' && new Prisma.Decimal(v.interval).gte(100)) issue('interval', 'Yüzde aralığı 100 değerinden küçük olmalıdır.');
});
export const gridDemoConfirmSchema = z.object({ previewId: z.string().uuid(), exchangeAccountId: z.string().min(1) }).strict();
export type GridDemoInput = z.infer<typeof gridDemoInputSchema>;
