import { StrategyFamily } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { LLMResearcherAdapter, LLMTeacherAdapter, type StructuredAIProvider } from '../src/modules/ai-trading/ai-analysis-adapters.js';
import type { ResearchDataset } from '../src/modules/ai-trading/researcher.service.js';
import type { TeacherEvidence } from '../src/modules/ai-trading/teacher.service.js';

const teacherEvidence: TeacherEvidence = {
  targetType: 'BOT', tradingBotId: 'bot-1', totalTrades: 120, wins: 40, losses: 80, winRate: 1 / 3,
  profitFactor: 0.8, totalPnl: -20, maxDrawdown: 0.25, averageHoldingSeconds: 180, score: 42, regimes: [],
};
const researchDataset: ResearchDataset = {
  strategyFamily: StrategyFamily.ATR_BREAKOUT, totalTrades: 120, wins: 40, losses: 80, winRate: 1 / 3,
  profitFactor: 0.8, totalPnl: -20, averageFunding: 0.1, averageHoldingSeconds: 180, averageBotScore: 42,
  regimes: [], teacherActions: [],
};

function provider(output: unknown): StructuredAIProvider {
  return { id: 'mock-provider', generate: vi.fn().mockResolvedValue(output) };
}

describe('Teacher and Researcher AI adapters', () => {
  it('validates and binds Teacher output to immutable target evidence', async () => {
    const adapter = new LLMTeacherAdapter(provider([{
      observation: 'Performance is weak under the supplied sample.', severity: 'MEDIUM', confidence: 0.8,
      metricEvidence: { profitFactor: 0.8 },
      recommendedAction: { type: 'INCREASE_CONFIDENCE_THRESHOLD', rationale: 'Test a stricter threshold in PAPER.', applyAutomatically: false },
    }]));
    const result = await adapter.evaluate(teacherEvidence);
    expect(result[0]).toMatchObject({ tradingBotId: 'bot-1', recommendedAction: { applyAutomatically: false } });
    expect(result[0]?.metricEvidence).toMatchObject({ analysisAdapter: { fallbackUsed: false } });
  });

  it('uses deterministic Teacher fallback on provider or schema failure', async () => {
    const failedProvider: StructuredAIProvider = { id: 'offline', generate: vi.fn().mockRejectedValue(new Error('offline')) };
    const result = await new LLMTeacherAdapter(failedProvider).evaluate(teacherEvidence);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.recommendedAction.applyAutomatically === false)).toBe(true);
    expect(result[0]?.metricEvidence).toMatchObject({ analysisAdapter: { fallbackUsed: true, fallback: 'RULE_BASED' } });
  });

  it('accepts candidate-only Researcher hypotheses and rejects cross-family output', async () => {
    const valid = [{
      hypothesis: 'A stricter entry filter may reduce low-confidence losses.', evidence: { profitFactor: 0.8 },
      targetStrategyFamily: StrategyFamily.ATR_BREAKOUT,
      suggestedChange: { type: 'ENTRY_FILTER_CANDIDATE', parameters: { direction: 'STRICTER' }, createCandidateOnly: true }, confidence: 0.75,
    }];
    const result = await new LLMResearcherAdapter(provider(valid)).propose(researchDataset, 50);
    expect(result[0]?.suggestedChange.createCandidateOnly).toBe(true);
    expect(result[0]?.evidence).toMatchObject({ analysisAdapter: { fallbackUsed: false } });

    const mismatch = [{ ...valid[0], targetStrategyFamily: StrategyFamily.RSI_MEAN_REVERSION }];
    const fallback = await new LLMResearcherAdapter(provider(mismatch)).propose(researchDataset, 50);
    expect(fallback.length).toBeGreaterThan(0);
    expect(fallback[0]?.evidence).toMatchObject({ analysisAdapter: { fallbackUsed: true } });
  });

  it('times out safely and never exposes code/live mutation fields in accepted schema', async () => {
    const hanging: StructuredAIProvider = { id: 'hanging', generate: vi.fn(() => new Promise(() => undefined)) };
    const result = await new LLMResearcherAdapter(hanging, undefined, 1).propose(researchDataset, 50);
    expect(result.length).toBeGreaterThan(0);
    const invalid = [{
      hypothesis: 'Directly patch production strategy and raise live risk limits.', evidence: {}, targetStrategyFamily: StrategyFamily.ATR_BREAKOUT,
      suggestedChange: { type: 'LIVE_RISK_UPDATE', parameters: { code: 'deploy()' }, createCandidateOnly: false }, confidence: 1,
    }];
    const safe = await new LLMResearcherAdapter(provider(invalid)).propose(researchDataset, 50);
    expect(safe.every((item) => item.suggestedChange.createCandidateOnly === true)).toBe(true);
    expect(safe.some((item) => item.suggestedChange.type === 'LIVE_RISK_UPDATE')).toBe(false);
  });
});
