import { describe, expect, it } from 'vitest';
import { shouldRunLearning, TESTNET_CHALLENGER_MIN_CLOSED_TRADES } from '../src/modules/ai-trading/learning.worker.js';

describe('autonomous learning worker', () => {
  it('runs only after enough new closed TESTNET evidence', () => {
    expect(shouldRunLearning(300, 399, 100)).toBe(false);
    expect(shouldRunLearning(300, 400, 100)).toBe(true);
    expect(shouldRunLearning(400, 399, 100)).toBe(false);
  });

  it('promotes TESTNET bots at 50 closed exchange orders', () => {
    expect(TESTNET_CHALLENGER_MIN_CLOSED_TRADES).toBe(50);
  });
});
