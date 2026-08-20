import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runTeacherBodySchema, teacherEvaluationsQuerySchema } from '../src/modules/ai-trading/teacher.schema.js';
import { evaluateRules, type TeacherEvidence } from '../src/modules/ai-trading/teacher.service.js';

function evidence(overrides: Partial<TeacherEvidence> = {}): TeacherEvidence {
  return {
    targetType: 'BOT', tradingBotId: 'bot-1', totalTrades: 120, wins: 40, losses: 80,
    winRate: 1 / 3, profitFactor: 0.8, totalPnl: -20, maxDrawdown: 0.25,
    averageHoldingSeconds: 180, score: 42,
    regimes: [
      { regime: 'BREAKOUT', trades: 30, totalPnl: 15 },
      { regime: 'RANGING', trades: 25, totalPnl: -12 },
    ],
    ...overrides,
  };
}

describe('Teacher', () => {
  it('validates single-target evaluation and bounded list requests', () => {
    expect(runTeacherBodySchema.parse({})).toEqual({});
    expect(runTeacherBodySchema.safeParse({ botId: 'clx1234567890123456789012', strategyId: 'clx2234567890123456789012' }).success).toBe(false);
    expect(teacherEvaluationsQuerySchema.parse({ limit: '50' }).limit).toBe(50);
    expect(teacherEvaluationsQuerySchema.safeParse({ limit: 501 }).success).toBe(false);
  });

  it('generates deterministic structured recommendations for weak performance', () => {
    const recommendations = evaluateRules(evidence());
    const actions = recommendations.map((item) => item.recommendedAction.type);
    expect(actions).toEqual(expect.arrayContaining([
      'REDUCE_POSITION_FACTOR', 'INCREASE_CONFIDENCE_THRESHOLD', 'INCREASE_COOLDOWN',
      'PRESERVE_REGIME_STRENGTH', 'ADD_REGIME_FILTER_CANDIDATE',
    ]));
    expect(recommendations.every((item) => item.recommendedAction.applyAutomatically === false)).toBe(true);
  });

  it('flags insufficient samples instead of overfitting them', () => {
    const recommendations = evaluateRules(evidence({ totalTrades: 12, wins: 7, losses: 5, maxDrawdown: 0.05, profitFactor: 1.2, averageHoldingSeconds: 900, regimes: [] }));
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]?.recommendedAction.type).toBe('COLLECT_MORE_EVIDENCE');
    expect(recommendations[0]?.confidence).toBe(0.98);
  });

  it('adds only an additive evaluation table migration', () => {
    const migration = readFileSync(new URL('../prisma/migrations/20260821020000_add_teacher_evaluations/migration.sql', import.meta.url), 'utf8');
    expect(migration).toContain('CREATE TABLE `teacher_evaluations`');
    expect(migration).toContain('recommendedAction');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/i);
  });

  it('cannot mutate strategy, bot, risk, execution, or live state', () => {
    const service = readFileSync(new URL('../src/modules/ai-trading/teacher.service.ts', import.meta.url), 'utf8');
    expect(service).toContain('recommendationApplied: false');
    expect(service).toContain('interface TeacherAnalysisProvider');
    expect(service).not.toMatch(/tradingBot\.(update|delete)|strategy(Version)?\.(update|delete)|submitOrder|tradingOutboxEvent\.create|riskProfile\.(update|delete)/);
  });
});
