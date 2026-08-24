import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { presentCoinPerformance } from '../src/modules/ai-trading/coin-performance.service.js';

describe('coin specific performance', () => {
  it('scores the same bot separately for each coin and regime evidence bucket', () => {
    const base = { tradingBotId: 'bot-12', botName: 'Bot 12', strategyVersionId: 'strategy-1', tradeCount: 20n, wins: 14n, losses: 6n,
      grossProfit: new Prisma.Decimal(21), grossLoss: new Prisma.Decimal(7), netPnl: new Prisma.Decimal(14), latestTradeAt: new Date('2026-08-24T12:00:00Z') };
    const btc = presentCoinPerformance({ ...base, symbol: 'BTCUSDT', regime: 'TRENDING_UP' });
    const xrp = presentCoinPerformance({ ...base, symbol: 'XRPUSDT', regime: 'RANGING', wins: 5n, losses: 15n, grossProfit: new Prisma.Decimal(4), grossLoss: new Prisma.Decimal(12), netPnl: new Prisma.Decimal(-8) });
    expect(btc.evidenceVersion).toBe('COIN_STRATEGY_REGIME_V1');
    expect(btc.score).toBeGreaterThan(xrp.score);
    expect([btc.symbol, btc.regime, xrp.symbol, xrp.regime]).toEqual(['BTCUSDT', 'TRENDING_UP', 'XRPUSDT', 'RANGING']);
  });
});
