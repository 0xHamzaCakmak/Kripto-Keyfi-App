import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/utils/api-error.js';
import {
  cloneFactoryBotBodySchema,
  createFactoryBotBodySchema,
  createParameterVariantBodySchema,
} from '../src/modules/ai-trading/bot-factory.schema.js';
import {
  assertBotLifecycleTransition,
  canTransitionBotLifecycle,
} from '../src/modules/ai-trading/bot-lifecycle.js';
import {
  mergeParameterVariant,
  timeframeToSeconds,
} from '../src/modules/ai-trading/bot-factory.service.js';

const validBot = {
  name: 'ATR paper candidate',
  strategyVersionId: 'strategy-version-1',
  exchangeAccountId: 'exchange-account-1',
  parameters: { atrMultiplier: 1.8 },
  symbols: ['BTCUSDT', 'ETHUSDT'],
  timeframe: '15m',
  riskProfileId: 'risk-profile-1',
};

describe('bot factory contracts', () => {
  it('defaults manual creation to PAPER and a bounded paper balance', () => {
    const parsed = createFactoryBotBodySchema.parse(validBot);
    expect(parsed.mode).toBe('PAPER');
    expect(parsed.startingPaperBalance).toBe('100');
    expect(parsed.symbols).toEqual(['BTCUSDT', 'ETHUSDT']);
  });

  it('rejects LIVE mode, duplicate symbols and uncontrolled fields', () => {
    expect(createFactoryBotBodySchema.safeParse({ ...validBot, mode: 'LIVE' }).success).toBe(false);
    expect(createFactoryBotBodySchema.safeParse({ ...validBot, symbols: ['BTCUSDT', 'BTCUSDT'] }).success).toBe(false);
    expect(createFactoryBotBodySchema.safeParse({ ...validBot, executeOrder: true }).success).toBe(false);
  });

  it('supports clone and parameter variants without mutation automation', () => {
    expect(cloneFactoryBotBodySchema.parse({ name: 'Clone candidate' }).mode).toBe('PAPER');
    expect(createParameterVariantBodySchema.safeParse({
      name: 'Variant candidate',
      parameterOverrides: { atrMultiplier: 2.1 },
    }).success).toBe(true);
    expect(mergeParameterVariant({ atrMultiplier: 1.8, period: 14 }, { atrMultiplier: 2.1 })).toEqual({
      atrMultiplier: 2.1,
      period: 14,
    });
  });

  it('validates lifecycle transitions and keeps LIVE disabled', () => {
    expect(canTransitionBotLifecycle('DRAFT', 'CANDIDATE')).toBe(true);
    expect(canTransitionBotLifecycle('CANDIDATE', 'CHAMPION')).toBe(false);
    expect(canTransitionBotLifecycle('LIVE_ELIGIBLE', 'LIVE')).toBe(false);
    expect(() => assertBotLifecycleTransition('LIVE_ELIGIBLE', 'LIVE')).toThrowError(ApiError);
    try {
      assertBotLifecycleTransition('LIVE_ELIGIBLE', 'LIVE');
    } catch (error) {
      expect((error as ApiError).code).toBe('AUTONOMOUS_LIVE_DISABLED');
    }
  });

  it('maps timeframes for the legacy scheduler fields without scheduling a bot', () => {
    expect(timeframeToSeconds('15m')).toBe(900);
    expect(timeframeToSeconds('4h')).toBe(14400);
    expect(() => timeframeToSeconds('tick')).toThrowError(ApiError);
  });

  it('uses an additive migration and has no execution/outbox path', () => {
    const migration = readFileSync(
      new URL('../prisma/migrations/20260820020000_add_bot_factory_fields/migration.sql', import.meta.url),
      'utf8',
    );
    const service = readFileSync(
      new URL('../src/modules/ai-trading/bot-factory.service.ts', import.meta.url),
      'utf8',
    );
    expect(migration).toContain("'AUTONOMOUS'");
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).not.toMatch(/DELETE\s+FROM|TRUNCATE/i);
    expect(service).not.toContain('tradingOutboxEvent.create');
    expect(service).not.toContain('submitOrder');
    expect(service).not.toContain('exchangeAdapter');
  });
});
