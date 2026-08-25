import { readFileSync } from 'node:fs';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { tradeMemoryQuerySchema, tradeMemoryStatsQuerySchema, tradeMemorySummaryQuerySchema } from '../src/modules/ai-trading/trade-memory.schema.js';
import { presentSummary } from '../src/modules/ai-trading/trade-memory.service.js';

describe('trade memory', () => {
  it('supports bounded similar, best, failure and performance queries', () => {
    expect(tradeMemoryQuerySchema.parse({ symbol: 'btcusdt', outcome: 'BEST' })).toMatchObject({ symbol: 'BTCUSDT', outcome: 'BEST', limit: 50 });
    expect(tradeMemoryQuerySchema.parse({ outcome: 'FAILURE', side: 'SELL', limit: '200' })).toMatchObject({ outcome: 'FAILURE', side: 'SELL', limit: 200 });
    expect(tradeMemoryQuerySchema.safeParse({ limit: 201 }).success).toBe(false);
    expect(tradeMemorySummaryQuerySchema.parse({ groupBy: 'REGIME' }).groupBy).toBe('REGIME');
    expect(tradeMemoryStatsQuerySchema.parse({ outcome: 'ALL' })).toEqual({ source: 'ALL', outcome: 'ALL' });
  });

  it('presents stable aggregate metrics without dividing by zero', () => {
    const row = {
      groupKey: 'BTCUSDT', tradeCount: 4n, wins: 3n, losses: 1n,
      totalPnl: new Prisma.Decimal(12), grossProfit: new Prisma.Decimal(16),
      grossLoss: new Prisma.Decimal(-4), averagePnl: new Prisma.Decimal(3),
    };
    expect(presentSummary(row)).toMatchObject({ groupKey: 'BTCUSDT', tradeCount: 4, profitFactor: 4 });
    expect(presentSummary({ ...row, grossLoss: new Prisma.Decimal(0) }).profitFactor).toBeNull();
  });

  it('extends PaperTrade additively and provides memory indexes', () => {
    const migration = readFileSync(new URL('../prisma/migrations/20260821010000_add_trade_memory_context/migration.sql', import.meta.url), 'utf8');
    for (const field of ['marketContext', 'closeReason', 'aiConfidence', 'decisionSummary', 'maxFavorableExcursion', 'maxAdverseExcursion']) {
      expect(migration).toContain(`ADD COLUMN \`${field}\``);
    }
    expect(migration).toContain('CREATE INDEX');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/i);
  });

  it('keeps Trade Memory user-scoped and read-only', () => {
    const service = readFileSync(new URL('../src/modules/ai-trading/trade-memory.service.ts', import.meta.url), 'utf8');
    expect(service).toContain("tradingBot: { userId, type: 'AUTONOMOUS' }");
    expect(service).toContain("b.userId = ${userId}");
    expect(service).toContain('getTradeMemoryStats');
    expect(service).not.toMatch(/submitOrder|tradingOutboxEvent\.create|paperTrade\.(create|update|delete)/);
  });
});
