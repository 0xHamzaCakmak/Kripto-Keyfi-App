import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  botCapitalSchema, closePaperPositionSchema, createAutonomousPaperBotSchema, nonCriticalBotSettingsSchema, paperFleetActivationSchema, promotionReviewSchema, resetPaperAccountingSchema, testnetActivationSchema, testnetFleetActivationSchema, triggerPaperGenerationSchema,
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

  it('requires a separate exact phrase for the fixed 20-bot TESTNET fleet', () => {
    expect(testnetFleetActivationSchema.safeParse({ confirmation: 'ENABLE 20 BINANCE TESTNET BOTS', note: 'Explicit fixed fleet activation.' }).success).toBe(true);
    expect(testnetFleetActivationSchema.safeParse({ confirmation: 'ENABLE BINANCE TESTNET', note: 'Wrong scope.' }).success).toBe(false);
  });

  it('keeps the fixed PAPER fleet confirmation separate from TESTNET', () => {
    expect(paperFleetActivationSchema.safeParse({ confirmation: 'RUN 20 PAPER BOTS', note: 'Explicit simulation start.' }).success).toBe(true);
    expect(paperFleetActivationSchema.safeParse({ confirmation: 'ENABLE 20 BINANCE TESTNET BOTS', note: 'Wrong mode.' }).success).toBe(false);
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
    expect(triggerPaperGenerationSchema.parse({}).populationTarget).toBe(20);
    expect(triggerPaperGenerationSchema.safeParse({ populationTarget: 1001 }).success).toBe(false);
    expect(promotionReviewSchema.safeParse({ decision: 'APPROVE', note: 'Evidence reviewed.' }).success).toBe(true);
    expect(promotionReviewSchema.safeParse({ decision: 'ACTIVATE_LIVE', note: 'unsafe' }).success).toBe(false);
  });

  it('requires explicit confirmation before starting a new PAPER accounting period', () => {
    expect(resetPaperAccountingSchema.safeParse({ confirmation: 'RESET PAPER PNL', note: 'Start a clean measurement period.' }).success).toBe(true);
    expect(resetPaperAccountingSchema.safeParse({ confirmation: 'DELETE HISTORY', note: 'unsafe' }).success).toBe(false);
  });

  it('keeps manual PAPER close bounded to a safe stop/continue choice', () => {
    expect(closePaperPositionSchema.parse({})).toEqual({ stopBot: false });
    expect(closePaperPositionSchema.safeParse({ stopBot: true, note: 'Admin safe close.' }).success).toBe(true);
    expect(closePaperPositionSchema.safeParse({ stopBot: true, live: true }).success).toBe(false);
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
    expect(routes).toContain('/autonomous/testnet-fleet/activate');
    expect(routes).toContain('/autonomous/testnet-account-summary');
    expect(routes).toContain('/autonomous/paper-fleet/activate');
    expect(routes).toContain('/autonomous/bots/:id/capital');
    expect(routes).toContain('/autonomous/paper-accounting/reset');
    expect(routes).toContain('/autonomous/bots/:id/close-paper-position');
    expect(service).toContain("environment: 'TESTNET'");
    expect(service).not.toMatch(/lifecycleStatus:\s*'LIVE'|submitOrder|placeOrder|tradingOutboxEvent\.create/);
  });
});
