import { z } from 'zod';

const positiveDecimal = z.string().trim().regex(/^(?!0+(?:\.0+)?$)\d{1,18}(?:\.\d{1,18})?$/);
const symbol = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,40}$/);
const ratio = z.string().trim().regex(/^(?:0(?:\.\d{1,6})?|1(?:\.0{1,6})?)$/);

export const updateRiskProfileBodySchema = z.object({
  enabled: z.boolean().optional(),
  maxOrderNotional: positiveDecimal.optional(),
  maxInitialMargin: positiveDecimal.optional(),
  maxAccountOpenNotional: positiveDecimal.optional(),
  maxOpenPositions: z.number().int().min(1).max(100).optional(),
  maxSymbolPositions: z.number().int().min(1).max(20).optional(),
  maxLeverage: z.number().int().min(1).max(125).optional(),
  minAvailableBalance: positiveDecimal.optional(),
  maxOrdersPerMinute: z.number().int().min(1).max(1000).optional(),
  maxDailyOrders: z.number().int().min(1).max(100_000).optional(),
  maxRiskPerTradePct: ratio.optional(),
  maxDailyLossPct: ratio.optional(),
  maxWeeklyLossPct: ratio.optional(),
  maxDrawdownPct: ratio.optional(),
  maxSymbolOpenNotional: positiveDecimal.optional(),
  minRiskRewardRatio: positiveDecimal.optional(),
  stopLossRequired: z.literal(true).optional(),
  marginModePolicy: z.enum(['ISOLATED_ONLY', 'ALLOW_CROSS']).optional(),
  cooldownSeconds: z.number().int().min(0).max(604_800).optional(),
  maxConsecutiveLosses: z.number().int().min(1).max(100).optional(),
  allowedSymbols: z.array(symbol).max(100).nullable().optional(),
  blockedSymbols: z.array(symbol).max(100).nullable().optional(),
}).strict().superRefine((value, context) => {
  const allowed = new Set(value.allowedSymbols ?? []);
  for (const blocked of value.blockedSymbols ?? []) {
    if (allowed.has(blocked)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['blockedSymbols'], message: `${blocked} hem izinli hem engelli olamaz.` });
  }
  if (value.maxOpenPositions !== undefined && value.maxSymbolPositions !== undefined && value.maxSymbolPositions > value.maxOpenPositions) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['maxSymbolPositions'], message: 'Parite pozisyon limiti hesap limitini aşamaz.' });
  }
});

export const updateKillSwitchBodySchema = z.object({
  scope: z.enum(['GLOBAL', 'ACCOUNT']),
  active: z.boolean(),
  reason: z.string().trim().min(3).max(500),
  exchangeAccountId: z.string().cuid().optional(),
}).strict().superRefine((value, context) => {
  if (value.scope === 'ACCOUNT' && !value.exchangeAccountId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['exchangeAccountId'], message: 'Hesap kill switch için borsa hesabı zorunludur.' });
  }
  if (value.scope === 'GLOBAL' && value.exchangeAccountId) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['exchangeAccountId'], message: 'Global kill switch hesap kimliği kabul etmez.' });
  }
});

export type UpdateRiskProfileInput = z.infer<typeof updateRiskProfileBodySchema>;
export type UpdateKillSwitchInput = z.infer<typeof updateKillSwitchBodySchema>;
