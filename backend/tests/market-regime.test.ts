import { describe, expect, it } from 'vitest';
import {
  marketRegimeLeaderboardParamsSchema,
  marketRegimeLeaderboardQuerySchema,
} from '../src/modules/ai-trading/market-regime.schema.js';

describe('market regime performance API contracts', () => {
  it('accepts only centralized deterministic regime values', () => {
    expect(marketRegimeLeaderboardParamsSchema.parse({ regime: 'TRENDING_UP' }).regime).toBe('TRENDING_UP');
    expect(marketRegimeLeaderboardParamsSchema.safeParse({ regime: 'BULLISH' }).success).toBe(false);
  });

  it('bounds regime leaderboard result size', () => {
    expect(marketRegimeLeaderboardQuerySchema.parse({}).limit).toBe(100);
    expect(marketRegimeLeaderboardQuerySchema.safeParse({ limit: 501 }).success).toBe(false);
  });
});
