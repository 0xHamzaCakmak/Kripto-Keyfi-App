import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createMutationBodySchema } from '../src/modules/ai-trading/mutation.schema.js';
import { applyParameterMutations } from '../src/modules/ai-trading/mutation.service.js';
import { strategyParameterSchemaSchema } from '../src/modules/ai-trading/strategy-registry.schema.js';

const schema = strategyParameterSchemaSchema.parse({ parameters: {
  atrMultiplier: { type: 'number', min: 1, max: 3, step: 0.1, default: 1.8 },
  confidenceThreshold: { type: 'number', min: 0.5, max: 0.95, step: 0.05, default: 0.7 },
  cooldownSeconds: { type: 'integer', min: 0, max: 3600, step: 30, default: 300 },
  positionFactor: { type: 'number', min: 0.1, max: 1, step: 0.1, default: 0.5 },
  mode: { type: 'enum', values: ['A', 'B'], default: 'A' },
} });
const current = { atrMultiplier: 1.8, confidenceThreshold: 0.7, cooldownSeconds: 300, positionFactor: 0.5, mode: 'A' };

describe('Mutation Engine', () => {
  it('supports controlled numeric, threshold, cooldown and position factor mutations', () => {
    const result = applyParameterMutations(schema, current, [
      { parameter: 'atrMultiplier', operation: 'ADD', value: 0.2 },
      { parameter: 'confidenceThreshold', operation: 'SET', value: 0.8 },
      { parameter: 'cooldownSeconds', operation: 'ADD', value: 60 },
      { parameter: 'positionFactor', operation: 'PERCENT', value: -20 },
    ]);
    expect(result.parameters).toMatchObject({ atrMultiplier: 2, confidenceThreshold: 0.8, cooldownSeconds: 360, positionFactor: 0.4 });
    expect(result.diff.cooldownSeconds).toEqual({ from: 300, to: 360, operation: 'ADD' });
  });

  it('rejects unknown, non-numeric, out-of-range and step-misaligned changes', () => {
    expect(() => applyParameterMutations(schema, current, [{ parameter: 'unknown', operation: 'SET', value: 1 }])).toThrow();
    expect(() => applyParameterMutations(schema, current, [{ parameter: 'mode', operation: 'SET', value: 1 }])).toThrow();
    expect(() => applyParameterMutations(schema, current, [{ parameter: 'atrMultiplier', operation: 'SET', value: 4 }])).toThrow();
    expect(() => applyParameterMutations(schema, current, [{ parameter: 'cooldownSeconds', operation: 'ADD', value: 15 }])).toThrow();
  });

  it('bounds mutation requests and makes generation lineage mandatory', () => {
    const parsed = createMutationBodySchema.safeParse({
      parentBotId: 'parent-1', generationId: 'generation-2', name: 'ATR child 2', reason: 'test threshold',
      mutations: [{ parameter: 'confidenceThreshold', operation: 'SET', value: 0.8 }], timeframe: '15M',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toMatchObject({ timeframe: '15m', mode: 'PAPER' });
    expect(createMutationBodySchema.safeParse({ parentBotId: 'p', name: 'child', reason: 'reason', mutations: [] }).success).toBe(false);
  });

  it('adds mutation lineage without destructive migration operations', () => {
    const migration = readFileSync(new URL('../prisma/migrations/20260821040000_add_bot_mutations/migration.sql', import.meta.url), 'utf8');
    expect(migration).toContain('CREATE TABLE `bot_mutations`');
    for (const field of ['parentBotId', 'childBotId', 'generationId', 'reason', 'diff']) expect(migration).toContain(`\`${field}\``);
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/i);
  });

  it('creates a new candidate path and never updates the parent or executes trades', () => {
    const mutation = readFileSync(new URL('../src/modules/ai-trading/mutation.service.ts', import.meta.url), 'utf8');
    const factory = readFileSync(new URL('../src/modules/ai-trading/bot-factory.service.ts', import.meta.url), 'utf8');
    expect(factory).toContain('createMutationFactoryBot');
    expect(factory).toContain("lifecycleStatus: 'CANDIDATE'");
    expect(mutation).not.toMatch(/tradingBot\.(update|updateMany|delete)|submitOrder|tradingOutboxEvent\.create/);
  });
});
