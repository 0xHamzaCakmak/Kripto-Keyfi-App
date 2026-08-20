import { readFileSync } from 'node:fs';
import { StrategyFamily } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { researchHypothesesQuerySchema, runResearcherBodySchema } from '../src/modules/ai-trading/researcher.schema.js';
import { proposeRuleTemplates, type ResearchDataset } from '../src/modules/ai-trading/researcher.service.js';

function dataset(overrides: Partial<ResearchDataset> = {}): ResearchDataset {
  return {
    strategyFamily: StrategyFamily.ATR_BREAKOUT, totalTrades: 150, wins: 50, losses: 100,
    winRate: 1 / 3, profitFactor: 0.75, totalPnl: -35, averageFunding: 0.4,
    averageHoldingSeconds: 180, averageBotScore: 38,
    regimes: [{ regime: 'RANGING', trades: 45, totalPnl: -22 }],
    teacherActions: [{ type: 'INCREASE_CONFIDENCE_THRESHOLD', count: 3 }],
    ...overrides,
  };
}

describe('Researcher', () => {
  it('validates bounded research and listing inputs', () => {
    expect(runResearcherBodySchema.parse({})).toEqual({ minimumTrades: 50 });
    expect(runResearcherBodySchema.parse({ strategyFamily: 'ATR_BREAKOUT', minimumTrades: 100 }).strategyFamily).toBe(StrategyFamily.ATR_BREAKOUT);
    expect(runResearcherBodySchema.safeParse({ minimumTrades: 9 }).success).toBe(false);
    expect(researchHypothesesQuerySchema.parse({ limit: '25' }).limit).toBe(25);
  });

  it('produces candidate-only hypotheses from memory, performance and Teacher evidence', () => {
    const hypotheses = proposeRuleTemplates(dataset(), 50);
    expect(hypotheses.map((item) => item.suggestedChange.type)).toEqual(expect.arrayContaining([
      'CONFIDENCE_THRESHOLD_FILTER', 'COOLDOWN_FILTER', 'FUNDING_CONTEXT_FILTER', 'REGIME_ENTRY_FILTER', 'TEACHER_ACTION_CANDIDATE',
    ]));
    expect(hypotheses.every((item) => item.targetStrategyFamily === StrategyFamily.ATR_BREAKOUT)).toBe(true);
    expect(hypotheses.every((item) => item.suggestedChange.createCandidateOnly === true)).toBe(true);
  });

  it('does not form hypotheses from insufficient samples', () => {
    expect(proposeRuleTemplates(dataset({ totalTrades: 20 }), 50)).toEqual([]);
  });

  it('uses an additive hypothesis migration aligned with existing strategy families', () => {
    const migration = readFileSync(new URL('../prisma/migrations/20260821030000_add_research_hypotheses/migration.sql', import.meta.url), 'utf8');
    expect(migration).toContain('CREATE TABLE `research_hypotheses`');
    expect(migration).toContain("'ATR_BREAKOUT'");
    expect(migration).toContain('suggestedChange');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/i);
  });

  it('prepares provider and candidate interfaces without mutating live state', () => {
    const service = readFileSync(new URL('../src/modules/ai-trading/researcher.service.ts', import.meta.url), 'utf8');
    expect(service).toContain('interface ResearchHypothesisProvider');
    expect(service).toContain('interface ResearchCandidateFactory');
    expect(service).toContain("lifecycleStatus: 'CANDIDATE'");
    expect(service).toContain('candidateCreated: false');
    expect(service).not.toMatch(/tradingBot\.(update|delete)|strategy(Version)?\.(update|delete)|submitOrder|tradingOutboxEvent\.create|riskProfile\.(update|delete)/);
  });
});
