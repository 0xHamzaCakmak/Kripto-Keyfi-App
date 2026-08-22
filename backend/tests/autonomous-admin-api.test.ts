import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  botCapitalSchema, createAutonomousPaperBotSchema, nonCriticalBotSettingsSchema, promotionReviewSchema, testnetActivationSchema, triggerPaperGenerationSchema,
} from '../src/modules/ai-trading/autonomous-admin.schema.js';
import { autonomousDTO, configuredCapital } from '../src/modules/ai-trading/autonomous-admin.service.js';

describe('Autonomous Trading Admin API', () => {
  it('returns a stable versioned DTO with live disabled', () => {
    expect(autonomousDTO('TEST', { ok: true })).toEqual({ apiVersion: 'v1', kind: 'TEST', data: { ok: true }, liveTradingEnabled: false });
  });

  it('requires an exact phrase for the Binance TESTNET canary', () => {
    expect(testnetActivationSchema.safeParse({ confirmation: 'ENABLE BINANCE TESTNET', note: 'Explicit testnet canary.' }).success).toBe(true);
    expect(testnetActivationSchema.safeParse({ confirmation: 'ENABLE LIVE', note: 'unsafe' }).success).toBe(false);
  });

  it('accepts only PAPER creation and bounded non-critical settings', () => {
    const base = {
      name: 'Paper Bot', strategyVersionId: 'strategy-v1', exchangeAccountId: 'account-1', parameters: {},
      symbols: ['BTCUSDT'], timeframe: '15m', riskProfileId: 'risk-1',
    };
    expect(createAutonomousPaperBotSchema.parse(base).mode).toBe('PAPER');
    expect(createAutonomousPaperBotSchema.safeParse({ ...base, mode: 'SHADOW' }).success).toBe(false);
    expect(nonCriticalBotSettingsSchema.safeParse({ intervalSeconds: 60 }).success).toBe(true);
    expect(nonCriticalBotSettingsSchema.safeParse({ intervalSeconds: 60, maxRiskPerTradePct: 1 }).success).toBe(false);
  });

  it('bounds generation and requires an explicit promotion review note', () => {
    expect(triggerPaperGenerationSchema.parse({}).populationTarget).toBe(100);
    expect(triggerPaperGenerationSchema.safeParse({ populationTarget: 1001 }).success).toBe(false);
    expect(promotionReviewSchema.safeParse({ decision: 'APPROVE', note: 'Evidence reviewed.' }).success).toBe(true);
    expect(promotionReviewSchema.safeParse({ decision: 'ACTIVATE_LIVE', note: 'unsafe' }).success).toBe(false);
  });

  it('bounds audited PAPER/TESTNET capital changes without exposing live execution', () => {
    expect(botCapitalSchema.parse({ action: 'SET', amountUsdt: 10_000 })).toEqual({ action: 'SET', amountUsdt: 10_000 });
    expect(botCapitalSchema.safeParse({ action: 'ADD', amountUsdt: 10_001 }).success).toBe(false);
    expect(botCapitalSchema.safeParse({ action: 'REMOVE', amountUsdt: 10 }).success).toBe(false);
    expect(configuredCapital({ allocationUsdt: 175 }, 100)).toBe(175);
    expect(configuredCapital({}, 100)).toBe(100);
  });

  it('keeps production live unavailable while exposing the guarded TESTNET canary route', () => {
    const routes = readFileSync(new URL('../src/modules/trading/trading.routes.ts', import.meta.url), 'utf8');
    const service = readFileSync(new URL('../src/modules/ai-trading/autonomous-admin.service.ts', import.meta.url), 'utf8');
    for (const route of ['/autonomous/overview', '/autonomous/arena-status', '/autonomous/generations', '/autonomous/live-eligibility', '/autonomous/bots/:id/start', '/autonomous/bots/:id/promotion-review']) {
      expect(routes).toContain(route);
    }
    expect(service).toContain("'APPROVED_PENDING_ACTIVATION'");
    expect(service).toContain('liveActivated: false');
    expect(routes).toContain('/autonomous/bots/:id/activate-testnet');
    expect(routes).toContain('/autonomous/bots/:id/capital');
    expect(service).toContain("environment: 'TESTNET'");
    expect(service).not.toMatch(/lifecycleStatus:\s*'LIVE'|submitOrder|placeOrder|tradingOutboxEvent\.create/);
  });
});
