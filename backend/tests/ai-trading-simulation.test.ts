import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { selectChampions, type PromotionEvidence } from '../src/modules/ai-trading/champion-selection.service.js';
import { DEFAULT_CHAMPION_SELECTION_CONFIG } from '../src/modules/ai-trading/champion-selection.schema.js';
import { applyParameterMutations } from '../src/modules/ai-trading/mutation.service.js';
import { strategyParameterSchemaSchema } from '../src/modules/ai-trading/strategy-registry.schema.js';
import { summarizeShadowPerformance } from '../src/modules/ai-trading/shadow-trading.service.js';
import { rankLeaderboardRows } from '../src/modules/ai-trading/bot-score.service.js';
import { simulatePaperBot } from './support/ai-trading-simulator.js';

const repeat = (count: number, grossPnl: number, fee = 0, funding = 0) => Array.from({ length: count }, () => ({ grossPnl, fee, funding }));

describe('AI Trading backend simulation suite', () => {
  it('1. runs 100 bots concurrently in PAPER without exchange execution', async () => {
    const results = await Promise.all(Array.from({ length: 100 }, (_, index) => simulatePaperBot(repeat(20, index % 2 ? 0.4 : 0.2, 0.05))));
    expect(results).toHaveLength(100);
    expect(results.every((result) => result.mode === 'PAPER' && result.paperOrders === 20 && result.shadowActions === 0)).toBe(true);
  });

  it('2-4. models profitable trend, ranging market, and sudden volatility spike', async () => {
    const trend = await simulatePaperBot(repeat(20, 1, 0.05));
    const ranging = await simulatePaperBot(Array.from({ length: 20 }, (_, index) => ({ grossPnl: index % 2 ? -1 : 1, fee: 0.05 })));
    const spike = await simulatePaperBot([{ grossPnl: 20 }, { grossPnl: -35 }, { grossPnl: 25 }]);
    expect(trend.netPnl).toBeGreaterThan(0);
    expect(ranging.netPnl).toBeLessThan(0);
    expect(spike.maxDrawdown).toBeGreaterThan(0.25);
  });

  it('5-7. blocks exchange disconnect, stale data, and high funding', async () => {
    const disconnected = await simulatePaperBot([{ grossPnl: 10 }], { connected: false });
    const stale = await simulatePaperBot([{ grossPnl: 10, marketAgeMs: 60_001 }], { maxMarketAgeMs: 60_000 });
    const funding = await simulatePaperBot([{ grossPnl: 10, funding: 2 }], { maxFunding: 1 });
    expect(disconnected.riskRejects).toEqual(['EXCHANGE_DISCONNECTED']);
    expect(stale.riskRejects).toEqual(['STALE_MARKET_DATA']);
    expect(funding.riskRejects).toEqual(['HIGH_FUNDING']);
    expect(disconnected.paperOrders + stale.paperOrders + funding.paperOrders).toBe(0);
  });

  it('8. penalizes fee-heavy overtrading', async () => {
    const result = await simulatePaperBot(repeat(100, 1, 1.25));
    expect(result.totalFees).toBe(125);
    expect(result.netPnl).toBeLessThan(0);
    expect(result.score).toBeLessThan(30);
  });

  it('9-10. ranks stable risk-adjusted behavior above higher profit with unacceptable drawdown', async () => {
    const risky = await simulatePaperBot([{ grossPnl: 40 }, { grossPnl: -45 }, { grossPnl: 35 }]);
    const stable = await simulatePaperBot(repeat(20, 0.4, 0.01));
    expect(risky.netPnl).toBeGreaterThan(stable.netPnl);
    expect(risky.maxDrawdown).toBeGreaterThan(0.3);
    expect(stable.score).toBeGreaterThan(risky.score);
    const ranked = rankLeaderboardRows([
      { metricId: 1n, tradingBotId: 'risky', botName: 'Risky', strategyVersionId: null, score: new Prisma.Decimal(risky.score),
        currentEquity: new Prisma.Decimal(100 + risky.netPnl), realizedPnl: new Prisma.Decimal(risky.netPnl), unrealizedPnl: new Prisma.Decimal(0),
        netPnl: new Prisma.Decimal(risky.netPnl), totalTrades: 3, maxDrawdown: new Prisma.Decimal(risky.maxDrawdown), metrics: { scoreBreakdown: { maxDrawdown: risky.maxDrawdown } }, snapshotAt: new Date(0) },
      { metricId: 2n, tradingBotId: 'stable', botName: 'Stable', strategyVersionId: null, score: new Prisma.Decimal(stable.score),
        currentEquity: new Prisma.Decimal(100 + stable.netPnl), realizedPnl: new Prisma.Decimal(stable.netPnl), unrealizedPnl: new Prisma.Decimal(0),
        netPnl: new Prisma.Decimal(stable.netPnl), totalTrades: 20, maxDrawdown: new Prisma.Decimal(stable.maxDrawdown), metrics: { scoreBreakdown: { maxDrawdown: stable.maxDrawdown } }, snapshotAt: new Date(0) },
    ]);
    expect(ranked[0]?.tradingBotId).toBe('stable');
  });

  it('11-12 and 16. enforces daily loss, emergency stop, and risk rejection before paper orders', async () => {
    const dailyLoss = await simulatePaperBot([{ grossPnl: -10 }, { grossPnl: 10 }], { maxDailyLoss: 10 });
    const emergency = await simulatePaperBot(repeat(5, 10), { emergencyStop: true });
    expect(dailyLoss.paperOrders).toBe(1);
    expect(dailyLoss.riskRejects).toContain('DAILY_LOSS_LIMIT');
    expect(emergency.paperOrders).toBe(0);
    expect(emergency.riskRejects).toHaveLength(5);
  });

  it('13. creates a bounded generation mutation without changing the parent', () => {
    const schema = strategyParameterSchemaSchema.parse({ parameters: {
      confidenceThreshold: { type: 'number', min: 0.5, max: 0.95, step: 0.05, default: 0.7 },
    } });
    const parent = { confidenceThreshold: 0.7 };
    const child = applyParameterMutations(schema, parent, [{ parameter: 'confidenceThreshold', operation: 'ADD', value: 0.1 }]);
    expect(parent.confidenceThreshold).toBe(0.7);
    expect(child.parameters.confidenceThreshold).toBeCloseTo(0.8);
  });

  it('14. promotes only evidence-qualified bots to challenger/champion, never LIVE', () => {
    const evidence = Array.from({ length: 25 }, (_, index): PromotionEvidence => ({
      botId: `bot-${index}`, lifecycleStatus: 'PAPER', evidenceAt: new Date(2026, 7, 24, 10, index).toISOString(), evidenceVersion: `v-${index}`,
      score: 90 - index, totalTrades: 250, paperDurationDays: 10, profitFactor: 1.8,
      maxDrawdown: 0.1, regimeCoverage: 4, openPaperTrades: 0,
    }));
    const first = selectChampions(evidence, DEFAULT_CHAMPION_SELECTION_CONFIG);
    const second = selectChampions(first.map((item) => ({ ...item, lifecycleStatus: item.targetStatus })), DEFAULT_CHAMPION_SELECTION_CONFIG);
    expect(first.filter((item) => item.targetStatus === 'CHALLENGER')).toHaveLength(20);
    expect(second.filter((item) => item.targetStatus === 'CHAMPION')).toHaveLength(10);
    expect(second.some((item) => item.targetStatus === 'LIVE' || item.targetStatus === 'LIVE_ELIGIBLE')).toBe(false);
  });

  it('15. keeps SHADOW actions isolated from PAPER orders', async () => {
    const simulated = await simulatePaperBot(repeat(3, 10), { mode: 'SHADOW' });
    const summary = summarizeShadowPerformance([
      { action: 'WOULD_OPEN', fee: 0, realizedPnl: 0, cumulativePnl: 0, totalFees: 0, occurredAt: new Date('2026-08-01') },
      { action: 'WOULD_CLOSE', fee: 1, realizedPnl: 10, cumulativePnl: 10, totalFees: 1, occurredAt: new Date('2026-08-02') },
    ], 100);
    expect(simulated).toMatchObject({ paperOrders: 0, shadowActions: 3, endingEquity: 100 });
    expect(summary).toMatchObject({ wouldOpen: 1, wouldClose: 1, netPnl: 9 });
  });
});
