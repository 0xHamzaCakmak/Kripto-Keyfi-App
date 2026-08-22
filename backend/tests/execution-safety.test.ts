import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/utils/api-error.js';
import { assertCentralRiskExecution } from '../src/modules/trading/execution-safety.js';

describe('central Risk Engine execution safety', () => {
  it('fails closed for risk-increasing TypeScript exchange writes', () => {
    expect(() => assertCentralRiskExecution({ executionEngine: 'TYPESCRIPT', reduceOnly: false }))
      .toThrowError(ApiError);
    try {
      assertCentralRiskExecution({ executionEngine: 'TYPESCRIPT', reduceOnly: false });
    } catch (error) {
      expect(error).toMatchObject({ statusCode: 409, code: 'CENTRAL_RISK_ENGINE_REQUIRED' });
    }
  });

  it('allows GO writes and preserves TypeScript reduce-only emergency exits', () => {
    expect(() => assertCentralRiskExecution({ executionEngine: 'GO', reduceOnly: false })).not.toThrow();
    expect(() => assertCentralRiskExecution({ executionEngine: 'GO', reduceOnly: true })).not.toThrow();
    expect(() => assertCentralRiskExecution({ executionEngine: 'TYPESCRIPT', reduceOnly: true })).not.toThrow();
  });
});
