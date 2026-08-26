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
  paperMaxOpenPositions: z.number().int().min(1).max(100).optional(),
  testnetBotAllocationUsdt: positiveDecimal.optional(),
  testnetMinInitialMarginUsdt: positiveDecimal.optional(),
  botAllocationUsdt: positiveDecimal.optional(),
  minInitialMarginUsdt: positiveDecimal.optional(),
  maxSymbolPositions: z.number().int().min(1).max(20).optional(),
  minLeverage: z.number().int().min(5).max(20).optional(),
  maxLeverage: z.number().int().min(5).max(20).optional(),
  stopLossBps: z.number().int().min(50).max(300).optional(),
  takeProfitBps: z.number().int().min(50).max(5_000).optional(),
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
  if (value.minLeverage !== undefined && value.maxLeverage !== undefined && value.minLeverage > value.maxLeverage) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['minLeverage'], message: 'Asgari kaldıraç azami kaldıracı aşamaz.' });
  }
  if (value.testnetBotAllocationUsdt !== undefined && value.testnetMinInitialMarginUsdt !== undefined
    && Number(value.testnetMinInitialMarginUsdt) > Number(value.testnetBotAllocationUsdt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['testnetMinInitialMarginUsdt'], message: 'TESTNET asgari işlem teminatı bot kotasını aşamaz.' });
  }
  const allocation = value.botAllocationUsdt ?? value.testnetBotAllocationUsdt;
  const minimumMargin = value.minInitialMarginUsdt ?? value.testnetMinInitialMarginUsdt;
  if (allocation !== undefined && minimumMargin !== undefined && Number(minimumMargin) > Number(allocation)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['minInitialMarginUsdt'], message: 'Asgari işlem teminatı bot başına teminat kotasını aşamaz.' });
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
