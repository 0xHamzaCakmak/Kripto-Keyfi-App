import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { leaderboardQuerySchema } from '../src/modules/ai-trading/bot-score.schema.js';
import { rankLeaderboardRows } from '../src/modules/ai-trading/bot-score.service.js';

describe('risk-adjusted bot score API contracts', () => {
  it('bounds leaderboard queries', () => {
    expect(leaderboardQuerySchema.parse({}).limit).toBe(100);
    expect(leaderboardQuerySchema.parse({ limit: '25' }).limit).toBe(25);
    expect(leaderboardQuerySchema.safeParse({ limit: 501 }).success).toBe(false);
    expect(leaderboardQuerySchema.safeParse({ limit: 10, promoteChampion: true }).success).toBe(false);
  });

  it('sorts scores, assigns competition ranks and exposes breakdowns', () => {
    const at = new Date('2026-08-20T12:00:00.000Z');
    const financials = { currentEquity: new Prisma.Decimal(109), realizedPnl: new Prisma.Decimal(8),
      unrealizedPnl: new Prisma.Decimal(1), netPnl: new Prisma.Decimal(9), totalTrades: 12, maxDrawdown: new Prisma.Decimal(0.04) };
    const ranked = rankLeaderboardRows([
      { metricId: 3n, tradingBotId: 'bot-c', botName: 'C', strategyVersionId: 'v1', score: new Prisma.Decimal(70), ...financials, metrics: {}, snapshotAt: at },
      { metricId: 1n, tradingBotId: 'bot-a', botName: 'A', strategyVersionId: 'v1', score: new Prisma.Decimal(90), ...financials, metrics: { scoreBreakdown: { finalScore: 90 } }, snapshotAt: at },
      { metricId: 2n, tradingBotId: 'bot-b', botName: 'B', strategyVersionId: 'v1', score: new Prisma.Decimal(90), ...financials, metrics: { scoreBreakdown: { finalScore: 90 } }, snapshotAt: at },
    ]);
    expect(ranked.map((row) => [row.tradingBotId, row.rank])).toEqual([
      ['bot-a', 1], ['bot-b', 1], ['bot-c', 3],
    ]);
    expect(ranked[0]?.metricId).toBe('1');
    expect(ranked[0]?.netPnl).toBe(9);
    expect(ranked[0]?.totalTrades).toBe(12);
    expect(ranked[0]?.breakdown).toEqual({ finalScore: 90 });
  });
});
