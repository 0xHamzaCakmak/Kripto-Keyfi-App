import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHAMPION_SELECTION_CONFIG,
  runChampionSelectionBodySchema,
} from '../src/modules/ai-trading/champion-selection.schema.js';
import {
  selectChampions,
  shouldPersistEvaluation,
  type PromotionEvidence,
} from '../src/modules/ai-trading/champion-selection.service.js';

function evidence(index: number, status: PromotionEvidence['lifecycleStatus'] = 'PAPER'): PromotionEvidence {
  return {
    botId: `bot-${String(index).padStart(3, '0')}`,
    lifecycleStatus: status,
    evidenceAt: new Date(2026, 7, 24, 10, index).toISOString(),
    evidenceVersion: `v-${index}`,
    score: 100 - index / 10,
    totalTrades: 250,
    paperDurationDays: 10,
    profitFactor: 2,
    maxDrawdown: 0.1,
    regimeCoverage: 4,
    openPaperTrades: 0,
  };
}

describe('champion/challenger selection', () => {
  it('uses safe configurable evidence defaults and bounded Top-N values', () => {
    expect(DEFAULT_CHAMPION_SELECTION_CONFIG.minTrades).toBe(200);
    expect(DEFAULT_CHAMPION_SELECTION_CONFIG.topChallengers).toBe(20);
    expect(DEFAULT_CHAMPION_SELECTION_CONFIG.topChampions).toBe(10);
    expect(runChampionSelectionBodySchema.parse({ minTrades: 300 }).minTrades).toBe(300);
    expect(runChampionSelectionBodySchema.safeParse({ topChampions: 21, topChallengers: 20 }).success).toBe(false);
  });

  it('selects 20 challengers from 100 paper bots without skipping lifecycle stages', () => {
    const firstPass = selectChampions(Array.from({ length: 100 }, (_, index) => evidence(index)), DEFAULT_CHAMPION_SELECTION_CONFIG);
    expect(firstPass.filter((item) => item.targetStatus === 'CHALLENGER')).toHaveLength(20);
    expect(firstPass.filter((item) => item.targetStatus === 'CHAMPION')).toHaveLength(0);
    expect(firstPass.some((item) => item.targetStatus === 'LIVE' || item.targetStatus === 'LIVE_ELIGIBLE')).toBe(false);

    const secondEvidence = firstPass.map((item, index) => evidence(index, item.targetStatus));
    const secondPass = selectChampions(secondEvidence, DEFAULT_CHAMPION_SELECTION_CONFIG);
    expect(secondPass.filter((item) => item.targetStatus === 'CHAMPION')).toHaveLength(10);
    expect(secondPass.filter((item) => item.targetStatus === 'CHALLENGER')).toHaveLength(10);
  });

  it('fails insufficient evidence explicitly and demotes bots outside gates', () => {
    const weak = evidence(1, 'CHAMPION');
    weak.totalTrades = 5;
    weak.regimeCoverage = 1;
    weak.maxDrawdown = 0.5;
    const [decision] = selectChampions([weak], DEFAULT_CHAMPION_SELECTION_CONFIG);
    expect(decision?.eligible).toBe(false);
    expect(decision?.failedGates).toEqual(expect.arrayContaining(['MIN_TRADES', 'MAX_DRAWDOWN', 'MIN_REGIME_COVERAGE']));
    expect(decision?.targetStatus).toBe('PAPER');
  });

  it('requires fresh metric evidence before advancing another lifecycle stage', () => {
    expect(shouldPersistEvaluation(undefined, 'v1')).toBe(true);
    expect(shouldPersistEvaluation('v1', 'v1')).toBe(false);
    expect(shouldPersistEvaluation('v1', 'v2')).toBe(true);
  });

  it('keeps an open PAPER position out of promotion', () => {
    const withPosition = evidence(1);
    withPosition.openPaperTrades = 1;
    const [decision] = selectChampions([withPosition], DEFAULT_CHAMPION_SELECTION_CONFIG);
    expect(decision?.eligible).toBe(false);
    expect(decision?.failedGates).toContain('OPEN_PAPER_POSITION');
  });

  it('writes promotion and demotion audit logs without live execution paths', () => {
    const service = readFileSync(new URL('../src/modules/ai-trading/champion-selection.service.ts', import.meta.url), 'utf8');
    expect(service).toContain("'AI_BOT_PROMOTED'");
    expect(service).toContain("'AI_BOT_DEMOTED'");
    expect(service).not.toContain('tradingOutboxEvent.create');
    expect(service).not.toContain('submitOrder');
    expect(service).not.toContain("targetStatus = 'LIVE'");
    expect(service).toContain("mode: 'SHADOW'");
  });
});
