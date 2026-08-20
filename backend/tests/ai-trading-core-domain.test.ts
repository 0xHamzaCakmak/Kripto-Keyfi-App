import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  autonomousBotModes,
  autonomousTradingStatuses,
  DEFAULT_AUTONOMOUS_BOT_MODE,
  isAutonomousTradingStatus,
  isMarketRegime,
  LIVE_TRADING_DEFAULT_ENABLED,
  marketRegimes,
} from '../src/modules/ai-trading/core-domain.js';

describe('autonomous trading core domain', () => {
  it('uses PAPER as the safe default and does not expose LIVE as an execution mode', () => {
    expect(DEFAULT_AUTONOMOUS_BOT_MODE).toBe('PAPER');
    expect(LIVE_TRADING_DEFAULT_ENABLED).toBe(false);
    expect(autonomousBotModes).toEqual(['PAPER', 'SHADOW']);
    expect(autonomousBotModes).not.toContain('LIVE');
  });

  it('centralizes lifecycle and market regime values', () => {
    expect(autonomousTradingStatuses).toContain('LIVE_ELIGIBLE');
    expect(isAutonomousTradingStatus('CHAMPION')).toBe(true);
    expect(isAutonomousTradingStatus('RUNNING')).toBe(false);
    expect(marketRegimes).toContain('UNKNOWN');
    expect(isMarketRegime('HIGH_VOLATILITY')).toBe(true);
    expect(isMarketRegime('BULLISH')).toBe(false);
  });

  it('keeps existing models and adds the required autonomous domain models', () => {
    const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
    for (const model of [
      'Strategy',
      'StrategyVersion',
      'Generation',
      'PaperTrade',
      'BotMetric',
      'MarketRegimeSnapshot',
      'ChampionCandidate',
    ]) {
      expect(schema).toContain(`model ${model} {`);
    }
    expect(schema).toContain('model TradingBot {');
    expect(schema).toContain('model TradingRiskProfile {');
    expect(schema).toContain('lifecycleStatus   AutonomousTradingStatus @default(DRAFT)');
    expect(schema).toContain('startingPaperBalance Decimal              @default(100)');
  });

  it('uses an additive migration without destructive table operations', () => {
    const migration = readFileSync(
      new URL('../prisma/migrations/20260820010000_add_ai_trading_core_domain/migration.sql', import.meta.url),
      'utf8',
    );
    expect(migration).toContain('CREATE TABLE `trading_strategies`');
    expect(migration).toContain('ALTER TABLE `trading_bots`');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(migration).not.toMatch(/DELETE\s+FROM/i);
    expect(migration).not.toMatch(/TRUNCATE/i);
  });
});
