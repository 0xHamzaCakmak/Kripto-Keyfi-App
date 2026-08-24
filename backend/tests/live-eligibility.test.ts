import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LIVE_ELIGIBILITY_CONFIG, runLiveEligibilityBodySchema } from '../src/modules/ai-trading/live-eligibility.schema.js';
import { evaluateLiveEligibility, type LiveEligibilityEvidence } from '../src/modules/ai-trading/live-eligibility.service.js';

function evidence(overrides: Partial<LiveEligibilityEvidence> = {}): LiveEligibilityEvidence {
  return {
    botId: 'bot-a', lifecycleStatus: 'CHAMPION', mode: 'SHADOW', paperTrades: 250, paperDurationDays: 14,
    maxDrawdown: 0.1, profitFactor: 1.5, riskAdjustedScore: 75, regimeCoverage: 4,
    shadowDurationDays: 10, shadowCloseTrades: 30, shadowProfitFactor: 1.2, shadowMaxDrawdown: 0.1,
    criticalRiskViolations: 0, ...overrides,
  };
}

describe('live eligibility gate', () => {
  it('promotes only a fully evidenced Champion to LIVE_ELIGIBLE', () => {
    const decision = evaluateLiveEligibility(evidence(), DEFAULT_LIVE_ELIGIBILITY_CONFIG);
    expect(decision.eligible).toBe(true);
    expect(decision.targetStatus).toBe('LIVE_ELIGIBLE');
    expect(decision.liveActivated).toBe(false);
  });

  it('keeps a promoted bot observable without reopening the Champion gate', () => {
    const decision = evaluateLiveEligibility(evidence({ lifecycleStatus: 'LIVE_ELIGIBLE' }), DEFAULT_LIVE_ELIGIBILITY_CONFIG);
    expect(decision.eligible).toBe(true);
    expect(decision.failedGates).not.toContain('CHAMPION_REQUIRED');
    expect(decision.liveActivated).toBe(false);
  });

  it('fails every configurable paper, shadow and risk gate explicitly', () => {
    const decision = evaluateLiveEligibility(evidence({
      lifecycleStatus: 'CHALLENGER', mode: 'PAPER', paperTrades: 2, paperDurationDays: 1, maxDrawdown: 0.3,
      profitFactor: 0.8, riskAdjustedScore: 30, regimeCoverage: 1, shadowDurationDays: 0,
      shadowCloseTrades: 0, shadowProfitFactor: null, shadowMaxDrawdown: 0.4, criticalRiskViolations: 1,
    }), DEFAULT_LIVE_ELIGIBILITY_CONFIG);
    expect(decision.eligible).toBe(false);
    expect(decision.targetStatus).toBe('CHALLENGER');
    expect(decision.failedGates).toEqual(expect.arrayContaining([
      'CHAMPION_REQUIRED', 'MIN_PAPER_TRADES', 'MIN_PAPER_DURATION', 'MAX_DRAWDOWN', 'MIN_PROFIT_FACTOR',
      'MIN_RISK_ADJUSTED_SCORE', 'MIN_REGIME_COVERAGE', 'SHADOW_MODE_REQUIRED', 'MIN_SHADOW_DURATION',
      'MIN_SHADOW_CLOSE_TRADES', 'MIN_SHADOW_PROFIT_FACTOR', 'MAX_SHADOW_DRAWDOWN', 'RECENT_CRITICAL_RISK_VIOLATION',
    ]));
  });

  it('validates bounded configurable criteria', () => {
    expect(runLiveEligibilityBodySchema.parse({ minPaperTrades: 300 }).config.minPaperTrades).toBe(300);
    expect(runLiveEligibilityBodySchema.safeParse({ maxDrawdown: 2 }).success).toBe(false);
    expect(runLiveEligibilityBodySchema.safeParse({ criticalRiskLookbackHours: 0 }).success).toBe(false);
  });

  it('cannot be bypassed through the generic lifecycle endpoint and never activates LIVE', () => {
    const factory = readFileSync(new URL('../src/modules/ai-trading/bot-factory.service.ts', import.meta.url), 'utf8');
    const service = readFileSync(new URL('../src/modules/ai-trading/live-eligibility.service.ts', import.meta.url), 'utf8');
    expect(factory).toContain('LIVE_ELIGIBILITY_GATE_REQUIRED');
    expect(service).toContain("lifecycleStatus: 'LIVE_ELIGIBLE'");
    expect(service).toContain('adminLiveApprovalRequired: true');
    expect(service).not.toMatch(/lifecycleStatus:\s*'LIVE'|placeOrder|submitOrder|tradingOutboxEvent\.create/);
  });
});
