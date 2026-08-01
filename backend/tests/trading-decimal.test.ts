import { describe, expect, it } from 'vitest';
import { compareDecimals, isStepAligned, multiplyDecimals, normalizeDecimal } from '../src/modules/trading/decimal.js';

describe('trading decimal helpers', () => {
  it('validates quantity and price steps without floating point arithmetic', () => {
    expect(isStepAligned('0.003', '0.001')).toBe(true);
    expect(isStepAligned('0.0035', '0.001')).toBe(false);
    expect(isStepAligned('63125.10', '0.10')).toBe(true);
  });

  it('calculates notional with decimal precision', () => {
    expect(multiplyDecimals('0.001', '63125.10')).toBe('63.1251');
    expect(compareDecimals('63.1251', '5')).toBe(1);
    expect(normalizeDecimal('001.2300')).toBe('1.23');
  });
});
