import { describe, expect, it } from 'vitest';
import { closePositionBodySchema } from '../src/modules/trading/manual-trading.schema.js';

const base = {
  exchangeAccountId: 'cm12345678901234567890123',
  idempotencyKey: 'manual-close-1234567890',
};

describe('manual position close validation', () => {
  it('keeps MARKET as the backward-compatible default', () => {
    const result = closePositionBodySchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('MARKET');
  });

  it('requires price for LIMIT closes', () => {
    expect(closePositionBodySchema.safeParse({ ...base, type: 'LIMIT' }).success).toBe(false);
    expect(closePositionBodySchema.safeParse({ ...base, type: 'LIMIT', price: '2475.50', quantity: '0.04' }).success).toBe(true);
  });
});
