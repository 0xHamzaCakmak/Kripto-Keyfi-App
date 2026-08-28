import { describe, expect, it } from 'vitest';
import { updateKillSwitchBodySchema, updateRiskProfileBodySchema } from '../src/modules/trading/risk.schema.js';

describe('trading risk request validation', () => {
  it('accepts bounded decimal and position limits', () => {
    const result = updateRiskProfileBodySchema.safeParse({
      maxOrderNotional: '75.5', maxInitialMargin: '25', maxOpenPositions: 5,
      maxSymbolPositions: 1, minLeverage: 5, maxLeverage: 5, allowedSymbols: ['btcusdt'], blockedSymbols: ['DOGEUSDT'],
      stopLossBps: 200, takeProfitBps: 250,
      maxRiskPerTradePct: '0.01', maxDailyLossPct: '0.05', maxWeeklyLossPct: '0.1', maxDrawdownPct: '0.2',
      maxSymbolOpenNotional: '200', minRiskRewardRatio: '1.5', stopLossRequired: true,
      marginModePolicy: 'ISOLATED_ONLY', cooldownSeconds: 60, maxConsecutiveLosses: 3,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.allowedSymbols).toEqual(['BTCUSDT']);
  });

  it('accepts zero as an unlimited monetary ceiling and rejects conflicting policies', () => {
    expect(updateRiskProfileBodySchema.safeParse({ maxOrderNotional: '0', maxInitialMargin: '0', maxAccountOpenNotional: '0', maxSymbolOpenNotional: '0', minAvailableBalance: '0' }).success).toBe(true);
    expect(updateRiskProfileBodySchema.safeParse({ maxOpenPositions: 0, paperMaxOpenPositions: 0, maxSymbolPositions: 0, maxOrdersPerMinute: 0, maxDailyOrders: 0 }).success).toBe(true);
    expect(updateRiskProfileBodySchema.safeParse({ allowedSymbols: ['BTCUSDT'], blockedSymbols: ['BTCUSDT'] }).success).toBe(false);
    expect(updateRiskProfileBodySchema.safeParse({ maxOpenPositions: 2, maxSymbolPositions: 3 }).success).toBe(false);
    expect(updateRiskProfileBodySchema.safeParse({ maxRiskPerTradePct: '1.01' }).success).toBe(false);
    expect(updateRiskProfileBodySchema.safeParse({ stopLossRequired: false }).success).toBe(false);
    expect(updateRiskProfileBodySchema.safeParse({ testnetBotAllocationUsdt: '500', testnetMinInitialMarginUsdt: '100' }).success).toBe(true);
    expect(updateRiskProfileBodySchema.safeParse({ testnetBotAllocationUsdt: '100', testnetMinInitialMarginUsdt: '500' }).success).toBe(false);
    expect(updateRiskProfileBodySchema.safeParse({ botAllocationUsdt: '500', minInitialMarginUsdt: '100', minLeverage: 8, maxLeverage: 15 }).success).toBe(true);
    expect(updateRiskProfileBodySchema.safeParse({ minLeverage: 16, maxLeverage: 12 }).success).toBe(false);
    expect(updateRiskProfileBodySchema.safeParse({ stopLossBps: 49 }).success).toBe(false);
    expect(updateRiskProfileBodySchema.safeParse({ stopLossBps: 1_000, takeProfitBps: 10, entryPaused: true }).success).toBe(true);
    expect(updateRiskProfileBodySchema.safeParse({ takeProfitBps: 9 }).success).toBe(false);
    expect(updateRiskProfileBodySchema.safeParse({ stopLossBps: 1_001 }).success).toBe(false);
    expect(updateRiskProfileBodySchema.safeParse({ stopLossBps: 200, takeProfitBps: 250 }).success).toBe(true);
  });

  it('requires a reason and account identity for account kill switch', () => {
    expect(updateKillSwitchBodySchema.safeParse({ scope: 'ACCOUNT', active: true, reason: 'Risk limiti' }).success).toBe(false);
    expect(updateKillSwitchBodySchema.safeParse({ scope: 'GLOBAL', active: true, reason: 'Acil durdurma', exchangeAccountId: 'cm12345678901234567890123' }).success).toBe(false);
  });
});
