import { describe, expect, it } from 'vitest';
import { updateKillSwitchBodySchema, updateRiskProfileBodySchema } from '../src/modules/trading/risk.schema.js';

describe('trading risk request validation', () => {
  it('accepts bounded decimal and position limits', () => {
    const result = updateRiskProfileBodySchema.safeParse({
      maxOrderNotional: '75.5', maxInitialMargin: '25', maxOpenPositions: 5,
      maxSymbolPositions: 1, maxLeverage: 3, allowedSymbols: ['btcusdt'], blockedSymbols: ['DOGEUSDT'],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.allowedSymbols).toEqual(['BTCUSDT']);
  });

  it('rejects zero values and conflicting symbol policies', () => {
    expect(updateRiskProfileBodySchema.safeParse({ maxOrderNotional: '0' }).success).toBe(false);
    expect(updateRiskProfileBodySchema.safeParse({ allowedSymbols: ['BTCUSDT'], blockedSymbols: ['BTCUSDT'] }).success).toBe(false);
    expect(updateRiskProfileBodySchema.safeParse({ maxOpenPositions: 2, maxSymbolPositions: 3 }).success).toBe(false);
  });

  it('requires a reason and account identity for account kill switch', () => {
    expect(updateKillSwitchBodySchema.safeParse({ scope: 'ACCOUNT', active: true, reason: 'Risk limiti' }).success).toBe(false);
    expect(updateKillSwitchBodySchema.safeParse({ scope: 'GLOBAL', active: true, reason: 'Acil durdurma', exchangeAccountId: 'cm12345678901234567890123' }).success).toBe(false);
  });
});
