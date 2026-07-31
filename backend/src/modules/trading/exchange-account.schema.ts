import { z } from 'zod';

export const exchangeAccountIdParamsSchema = z.object({ id: z.string().cuid() });

export const createExchangeAccountBodySchema = z.object({
  name: z.string().trim().min(2).max(80),
  provider: z.enum(['BINANCE', 'BYBIT']),
  environment: z.enum(['TESTNET', 'DEMO']),
  accountType: z.enum(['USDT_M', 'UNIFIED']),
  apiKey: z.string().trim().min(8).max(256),
  apiSecret: z.string().trim().min(8).max(256),
  passphrase: z.string().trim().min(1).max(256).optional(),
  description: z.string().trim().max(500).optional(),
}).strict().superRefine((value, context) => {
  const valid = value.provider === 'BINANCE'
    ? value.environment === 'TESTNET' && value.accountType === 'USDT_M'
    : value.environment === 'DEMO' && value.accountType === 'UNIFIED';
  if (!valid) context.addIssue({ code: z.ZodIssueCode.custom, path: ['environment'], message: 'Provider, environment and account type combination is not supported' });
});

export type CreateExchangeAccountInput = z.infer<typeof createExchangeAccountBodySchema>;
