import { describe, expect, it } from 'vitest';
import { shouldRunLearning } from '../src/modules/ai-trading/learning.worker.js';

describe('autonomous learning worker', () => {
  it('runs only after enough new closed PAPER evidence', () => {
    expect(shouldRunLearning(300, 399, 100)).toBe(false);
    expect(shouldRunLearning(300, 400, 100)).toBe(true);
    expect(shouldRunLearning(400, 399, 100)).toBe(false);
  });
});
