import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_EVOLUTION_CONFIG, evolutionConfigSchema, runEvolutionBodySchema } from '../src/modules/ai-trading/evolution.schema.js';
import { assessEvolutionReadiness, evolutionConfigForPopulation, selectEvolutionPopulation, type EvolutionEvidence } from '../src/modules/ai-trading/evolution.service.js';

function bot(index: number, score: number | null, totalTrades = 250, lifecycleStatus: EvolutionEvidence['lifecycleStatus'] = 'PAPER'): EvolutionEvidence {
  return { botId: `bot-${index}`, score, totalTrades, lifecycleStatus };
}

describe('Evolution Engine', () => {
  it('defaults to a 20 PAPER-candidate population and validates count consistency', () => {
    expect(DEFAULT_EVOLUTION_CONFIG).toMatchObject({ populationSize: 20, survivorCount: 4, mutationCount: 12, crossoverCount: 4, researcherCandidateCount: 0, minimumTrades: 50 });
    expect(evolutionConfigSchema.safeParse({ ...DEFAULT_EVOLUTION_CONFIG, mutationCount: 10, crossoverCount: 4, researcherCandidateCount: 2 }).success).toBe(true);
    expect(evolutionConfigSchema.safeParse({ ...DEFAULT_EVOLUTION_CONFIG, mutationCount: 9, crossoverCount: 4, researcherCandidateCount: 2 }).success).toBe(false);
    expect(runEvolutionBodySchema.safeParse({ sourceGenerationId: 'generation-1', config: { minimumTrades: 300 } }).success).toBe(true);
  });

  it('does not deadlock when population exceeds its target or weak bots lag behind', () => {
    const config = evolutionConfigForPopulation(100, 50, 20);
    const evidence = Array.from({ length: 101 }, (_, index) => bot(index, 100 - index, index < 20 ? 50 : 3));
    const readiness = assessEvolutionReadiness(evidence, 100, config);
    expect(readiness.ready).toBe(true);
    expect(readiness.paperBots).toBe(101);
    expect(readiness.eligibleBots).toBe(20);
    expect(readiness.requiredSurvivors).toBe(20);
  });

  it('reports evidence progress instead of evolving an under-tested population', () => {
    const config = evolutionConfigForPopulation(100, 50, 20);
    const evidence = Array.from({ length: 100 }, (_, index) => bot(index, 80, index < 12 ? 50 : 10));
    const readiness = assessEvolutionReadiness(evidence, 100, config);
    expect(readiness.ready).toBe(false);
    expect(readiness.blocker).toBe('SURVIVOR_EVIDENCE_INSUFFICIENT');
    expect(readiness.eligibleBots).toBe(12);
  });

  it('uses score plus minimum evidence, not raw profit, to select survivors', () => {
    const config = evolutionConfigSchema.parse({ populationSize: 3, survivorCount: 2, mutationCount: 1, crossoverCount: 0, researcherCandidateCount: 0, maxGenerations: 10, minimumTrades: 200 });
    const result = selectEvolutionPopulation([
      bot(1, 90), bot(2, 80), bot(3, 70), bot(4, 99, 10), bot(5, null),
    ], config);
    expect(result.survivors.map((item) => item.botId)).toEqual(['bot-1', 'bot-2']);
    expect(result.weak.map((item) => item.botId)).toEqual(['bot-3']);
    expect(result.insufficient.map((item) => item.botId)).toEqual(['bot-4', 'bot-5']);
  });

  it('protects LIVE/LIVE_ELIGIBLE bots and never archives Champions', () => {
    const config = evolutionConfigSchema.parse({ populationSize: 1, survivorCount: 1, mutationCount: 0, crossoverCount: 0, researcherCandidateCount: 0, maxGenerations: 10, minimumTrades: 1 });
    const result = selectEvolutionPopulation([bot(1, 50), bot(2, 100, 250, 'LIVE'), bot(3, 90, 250, 'LIVE_ELIGIBLE'), bot(4, 40, 250, 'CHAMPION')], config);
    expect(result.protectedBots.map((item) => item.lifecycleStatus)).toEqual(['LIVE', 'LIVE_ELIGIBLE', 'CHAMPION']);
    expect(result.survivors[0]?.botId).toBe('bot-1');
    expect(result.weak).toEqual([]);
  });

  it('adds only an auditable EvolutionRun table', () => {
    const migration = readFileSync(new URL('../prisma/migrations/20260821050000_add_evolution_runs/migration.sql', import.meta.url), 'utf8');
    expect(migration).toContain('CREATE TABLE `evolution_runs`');
    expect(migration).toContain('sourceGenerationId');
    expect(migration).toContain('targetGenerationId');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/i);
  });

  it('records Bot Score fitness and creates no live execution path', () => {
    const service = readFileSync(new URL('../src/modules/ai-trading/evolution.service.ts', import.meta.url), 'utf8');
    expect(service).toContain("fitness: 'BOT_SCORE'");
    expect(service).toContain("mode: 'PAPER'");
    expect(service).toContain('liveChanged: false');
    expect(service).not.toContain('realizedPnl');
    expect(service).not.toMatch(/submitOrder|tradingOutboxEvent\.create|lifecycleStatus:\s*'LIVE'/);
  });
});
