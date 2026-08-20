import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { StrategyRouterEvidence } from '../src/modules/ai-trading/strategy-router.service.js';
import { selectStrategyPool } from '../src/modules/ai-trading/strategy-router.service.js';
import { routeStrategyBodySchema } from '../src/modules/ai-trading/strategy-router.schema.js';

const now = new Date('2026-08-21T12:00:00.000Z');
const input = routeStrategyBodySchema.parse({ symbol: 'BTCUSDT', timeframe: '15m', maxBots: 2 });
function bot(overrides: Partial<StrategyRouterEvidence> = {}): StrategyRouterEvidence {
  return {
    botId: 'bot-a', botName: 'Bot A', exchangeAccountId: 'account-1', mode: 'PAPER', lifecycleStatus: 'PAPER',
    state: 'RUNNING', desiredState: 'RUNNING', lastErrorCode: null, heartbeatAt: now,
    regimeScore: 80, metricAt: now, riskProfileEnabled: true, accountKillSwitch: false,
    globalKillSwitch: false, accountActive: true, accountConnected: true, ...overrides,
  };
}

describe('strategy router', () => {
  it('selects deterministically by regime score and normalizes weights', () => {
    const decision = selectStrategyPool([
      bot({ botId: 'bot-b', botName: 'Bot B', regimeScore: 70 }),
      bot({ botId: 'bot-a', regimeScore: 90 }),
      bot({ botId: 'bot-c', botName: 'Bot C', regimeScore: 80 }),
    ], 'TRENDING_UP', input, now);
    expect(decision.selectedBots.map((item) => item.botId)).toEqual(['bot-a', 'bot-c']);
    expect(decision.selectedBots.reduce((sum, item) => sum + item.weight, 0)).toBeCloseTo(1);
    expect(decision.regime).toBe('TRENDING_UP');
  });

  it('fails closed for risk and recent health gates', () => {
    const decision = selectStrategyPool([
      bot({ botId: 'risk', accountKillSwitch: true }),
      bot({ botId: 'error', state: 'ERROR', lastErrorCode: 'BOT_RUNNER_ERROR' }),
      bot({ botId: 'stale', heartbeatAt: new Date(now.getTime() - 301_000) }),
    ], 'RANGING', input, now);
    expect(decision.selectedBots).toHaveLength(0);
    expect(decision.excludedBots.find((item) => item.botId === 'risk')?.failedGates).toContain('ACCOUNT_KILL_SWITCH');
    expect(decision.excludedBots.find((item) => item.botId === 'stale')?.failedGates).toContain('HEARTBEAT_STALE');
  });

  it('never routes when the current regime is unknown', () => {
    const decision = selectStrategyPool([bot()], 'UNKNOWN', input, now);
    expect(decision.selectedBots).toEqual([]);
    expect(decision.excludedBots[0]?.failedGates).toContain('UNKNOWN_REGIME');
  });

  it('requires PAPER mode and fresh regime evidence', () => {
    const decision = selectStrategyPool([
      bot({ botId: 'shadow', mode: 'SHADOW' }),
      bot({ botId: 'stale-metric', metricAt: new Date(now.getTime() - 86_400_001) }),
    ], 'BREAKOUT', input, now);
    expect(decision.selectedBots).toHaveLength(0);
    expect(decision.excludedBots.find((item) => item.botId === 'shadow')?.failedGates).toContain('PAPER_MODE_REQUIRED');
    expect(decision.excludedBots.find((item) => item.botId === 'stale-metric')?.failedGates).toContain('REGIME_SCORE_STALE');
  });

  it('validates bounded deterministic routing configuration', () => {
    expect(input.minimumRegimeScore).toBe(40);
    expect(routeStrategyBodySchema.safeParse({ symbol: 'BTCUSDT', timeframe: '2m' }).success).toBe(false);
    expect(routeStrategyBodySchema.safeParse({ symbol: 'BTCUSDT', timeframe: '15m', maxBots: 51 }).success).toBe(false);
  });

  it('writes an audit decision without any order or live activation path', () => {
    const service = readFileSync(new URL('../src/modules/ai-trading/strategy-router.service.ts', import.meta.url), 'utf8');
    expect(service).toContain("action: 'AI_STRATEGY_ROUTED'");
    expect(service).toContain('orderSubmitted: false');
    expect(service).toContain('liveActivated: false');
    expect(service).not.toMatch(/placeOrder|submitOrder|tradingOutboxEvent\.create|lifecycleStatus:\s*'LIVE'/);
  });
});
