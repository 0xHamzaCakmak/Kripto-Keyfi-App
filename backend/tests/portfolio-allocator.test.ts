import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PortfolioBotEvidence, PortfolioRiskLimits } from '../src/modules/ai-trading/portfolio-allocator.service.js';
import { allocatePortfolio } from '../src/modules/ai-trading/portfolio-allocator.service.js';
import { portfolioAllocatorBodySchema } from '../src/modules/ai-trading/portfolio-allocator.schema.js';

const now = new Date('2026-08-21T12:00:00.000Z');
const config = portfolioAllocatorBodySchema.parse({ exchangeAccountId: 'cm00000000000000000000000', capital: 1000 });
const risk: PortfolioRiskLimits = {
  enabled: true, accountKillSwitch: false, globalKillSwitch: false,
  maxAccountOpenNotional: 700, maxSymbolOpenNotional: 400, maxOrderNotional: 300, maxDrawdownPct: 0.2,
};
function bot(overrides: Partial<PortfolioBotEvidence> = {}): PortfolioBotEvidence {
  return {
    botId: 'bot-a', botName: 'Bot A', symbol: 'BTCUSDT', mode: 'PAPER', lifecycleStatus: 'CHAMPION',
    score: 80, regimeFit: 85, recentDrawdown: 0.05, volatility: 0.3, correlation: 0.2,
    currentExposure: 0, metricAt: now, ...overrides,
  };
}

describe('portfolio allocator', () => {
  it('allocates deterministically and preserves the configured cash reserve', () => {
    const decision = allocatePortfolio([
      bot({ botId: 'bot-b', botName: 'Bot B', symbol: 'ETHUSDT', score: 70, regimeFit: 70 }),
      bot({ botId: 'bot-a', score: 90, regimeFit: 90 }),
      bot({ botId: 'bot-c', botName: 'Bot C', symbol: 'SOLUSDT', score: 60, regimeFit: 65 }),
    ], risk, config, now);
    expect(decision.botAllocations.map((item) => item.botId)).toEqual(['bot-a', 'bot-b', 'bot-c']);
    expect(decision.allocatedCapital).toBe(700);
    expect(decision.reservePct).toBe(0.3);
    expect(decision.orderSubmitted).toBe(false);
    expect(decision.liveActivated).toBe(false);
  });

  it('never exceeds total, symbol, or per-bot risk limits including current exposure', () => {
    const decision = allocatePortfolio([
      bot({ botId: 'btc-a', currentExposure: 150 }),
      bot({ botId: 'btc-b', botName: 'BTC B', currentExposure: 100 }),
      bot({ botId: 'eth', botName: 'ETH', symbol: 'ETHUSDT', currentExposure: 50 }),
    ], risk, config, now);
    expect(decision.allocatedCapital).toBeLessThanOrEqual(400);
    expect(decision.symbolAllocations.find((item) => item.symbol === 'BTCUSDT')!.allocationAmount).toBeLessThanOrEqual(150);
    expect(decision.botAllocations.find((item) => item.botId === 'btc-a')!.allocationAmount).toBeLessThanOrEqual(150);
  });

  it('treats zero monetary ceilings as unlimited', () => {
    const decision = allocatePortfolio([
      bot({ botId: 'bot-a' }),
      bot({ botId: 'bot-b', botName: 'Bot B', symbol: 'ETHUSDT' }),
    ], { ...risk, maxAccountOpenNotional: 0, maxSymbolOpenNotional: 0, maxOrderNotional: 0 }, config, now);
    // Zero disables only the persisted monetary ceilings; the allocator's
    // explicit 30% per-bot diversification setting still applies.
    expect(decision.allocatedCapital).toBe(600);
  });

  it('fails closed for unsafe modes, missing evidence, drawdown, and emergency switches', () => {
    const decision = allocatePortfolio([
      bot({ botId: 'demo', mode: 'DEMO' }),
      bot({ botId: 'missing', volatility: null }),
      bot({ botId: 'drawdown', recentDrawdown: 0.21 }),
    ], { ...risk, accountKillSwitch: true }, config, now);
    expect(decision.botAllocations).toHaveLength(0);
    expect(decision.excludedBots.every((item) => item.failedGates.includes('ACCOUNT_KILL_SWITCH'))).toBe(true);
    expect(decision.excludedBots.find((item) => item.botId === 'demo')?.failedGates).toContain('SAFE_MODE_REQUIRED');
    expect(decision.excludedBots.find((item) => item.botId === 'missing')?.failedGates).toContain('VOLATILITY_MISSING');
  });

  it('uses score, regime, drawdown, volatility, correlation and exposure factors', () => {
    const decision = allocatePortfolio([
      bot({ botId: 'strong', score: 90, regimeFit: 90, recentDrawdown: 0.02, volatility: 0.1, correlation: -0.5 }),
      bot({ botId: 'weak', botName: 'Weak', symbol: 'ETHUSDT', score: 60, regimeFit: 55, recentDrawdown: 0.15, volatility: 0.9, correlation: 0.9, currentExposure: 100 }),
    ], risk, config, now);
    expect(decision.botAllocations[0]!.botId).toBe('strong');
    expect(decision.botAllocations[0]!.allocationScore).toBeGreaterThan(decision.botAllocations[1]!.allocationScore);
  });

  it('adds only an additive table migration and no execution path', () => {
    const migration = readFileSync(new URL('../prisma/migrations/20260821080000_add_portfolio_allocations/migration.sql', import.meta.url), 'utf8');
    const service = readFileSync(new URL('../src/modules/ai-trading/portfolio-allocator.service.ts', import.meta.url), 'utf8');
    expect(migration).toContain('CREATE TABLE `portfolio_allocations`');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/i);
    expect(service).toContain('orderSubmitted: false');
    expect(service).toContain('liveActivated: false');
    expect(service).not.toMatch(/placeOrder|submitOrder|tradingOutboxEvent\.create|lifecycleStatus:\s*'LIVE'/);
  });
});
