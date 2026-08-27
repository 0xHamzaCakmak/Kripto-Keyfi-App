import { describe, expect, it } from 'vitest';
import { aiMentorModelOutputSchema, aiMentorRequestSchema } from '../src/modules/ai-trading/ai-mentor.schema.js';

describe('AI mentor contracts', () => {
  it('accepts the fixed observer input and fixed model output', () => {
    expect(aiMentorRequestSchema.safeParse({
      schemaVersion: 'trading-bot-observer-v1',
      bot: { id: 'bot-1', type: 'AUTONOMOUS', mode: 'DEMO', symbol: 'BTCUSDT' },
      market: { markPrice: '70000', referencePrice: '69950' },
      ruleDecision: { kind: 'BUY', action: 'BUY', summary: 'rule buy', metrics: { newsScore: 0.4 } },
      constraints: { allowedActions: ['HOLD', 'BUY', 'SELL'], executionAllowed: true, submittedToExchange: false, comparisonOnly: false },
    }).success).toBe(true);
    expect(aiMentorModelOutputSchema.safeParse({
      decision: 'long', confidence: 0.81, reasoning_summary: 'Trend ve haber sinyali aynı yönde.',
      invalidation_level: 69000, suggested_leverage: 5, agrees_with_rule_engine: true,
    }).success).toBe(true);
  });

  it('rejects extra fields and malformed confidence so callers can fail closed', () => {
    expect(aiMentorModelOutputSchema.safeParse({
      decision: 'long', confidence: 1.2, reasoning_summary: 'Geçersiz güven değeri.',
      invalidation_level: 0, suggested_leverage: 5, agrees_with_rule_engine: true, place_order: true,
    }).success).toBe(false);
  });
});
