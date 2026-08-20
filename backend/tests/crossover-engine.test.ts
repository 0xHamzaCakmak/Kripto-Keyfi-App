import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createCrossoverBodySchema } from '../src/modules/ai-trading/crossover.schema.js';
import { combineCrossoverParameters, schemasAreCompatible } from '../src/modules/ai-trading/crossover.service.js';
import { strategyParameterSchemaSchema } from '../src/modules/ai-trading/strategy-registry.schema.js';

const schema = strategyParameterSchemaSchema.parse({ parameters: {
  entryThreshold: { type: 'number', min: 0.5, max: 0.9, step: 0.1, default: 0.6 },
  exitThreshold: { type: 'number', min: 0.1, max: 0.5, step: 0.1, default: 0.3 },
  cooldownSeconds: { type: 'integer', min: 0, max: 600, step: 60, default: 120 },
} });

describe('Crossover Engine', () => {
  it('treats semantically identical versioned schemas as compatible', () => {
    const reordered = strategyParameterSchemaSchema.parse({ parameters: {
      cooldownSeconds: { type: 'integer', min: 0, max: 600, step: 60, default: 120 },
      exitThreshold: { type: 'number', min: 0.1, max: 0.5, step: 0.1, default: 0.3 },
      entryThreshold: { type: 'number', min: 0.5, max: 0.9, step: 0.1, default: 0.6 },
    } });
    expect(schemasAreCompatible(schema, reordered)).toBe(true);
    expect(schemasAreCompatible(schema, strategyParameterSchemaSchema.parse({ parameters: { entryThreshold: schema.parameters.entryThreshold! } }))).toBe(false);
  });

  it('inherits entry from A and exit from B while recording every field source', () => {
    const result = combineCrossoverParameters(
      schema,
      { entryThreshold: 0.8, exitThreshold: 0.2, cooldownSeconds: 120 },
      { entryThreshold: 0.6, exitThreshold: 0.4, cooldownSeconds: 300 },
      ['exitThreshold'], { cooldownSeconds: 240 },
    );
    expect(result.parameters).toEqual({ entryThreshold: 0.8, exitThreshold: 0.4, cooldownSeconds: 240 });
    expect(result.inheritedFields).toEqual({ entryThreshold: 'A', exitThreshold: 'B', cooldownSeconds: 'GENERATED' });
    expect(result.generatedFields).toEqual({ cooldownSeconds: 240 });
  });

  it('rejects unknown and invalid generated combinations through registry validation', () => {
    expect(() => combineCrossoverParameters(schema, { entryThreshold: 0.8, exitThreshold: 0.2, cooldownSeconds: 120 }, { entryThreshold: 0.6, exitThreshold: 0.4, cooldownSeconds: 300 }, ['unknown'], {})).toThrow();
    expect(() => combineCrossoverParameters(schema, { entryThreshold: 0.8, exitThreshold: 0.2, cooldownSeconds: 120 }, { entryThreshold: 0.6, exitThreshold: 0.4, cooldownSeconds: 300 }, [], { exitThreshold: 0.9 })).toThrow();
  });

  it('validates distinct parents and safe bounded payloads', () => {
    expect(createCrossoverBodySchema.safeParse({ parentABotId: 'a', parentBBotId: 'b', generationId: 'g', name: 'child crossover' }).success).toBe(true);
    expect(createCrossoverBodySchema.safeParse({ parentABotId: 'a', parentBBotId: 'a', generationId: 'g', name: 'child crossover' }).success).toBe(false);
  });

  it('adds lineage additively and always creates a PAPER candidate child', () => {
    const migration = readFileSync(new URL('../prisma/migrations/20260821060000_add_bot_crossovers/migration.sql', import.meta.url), 'utf8');
    const factory = readFileSync(new URL('../src/modules/ai-trading/bot-factory.service.ts', import.meta.url), 'utf8');
    const crossover = readFileSync(new URL('../src/modules/ai-trading/crossover.service.ts', import.meta.url), 'utf8');
    expect(migration).toContain('CREATE TABLE `bot_crossovers`');
    expect(migration).toContain("'CROSSOVER'");
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/i);
    expect(factory).toContain("creationMethod: 'CROSSOVER'");
    expect(factory).toContain("mode: 'PAPER'");
    expect(factory).toContain("lifecycleStatus: 'CANDIDATE'");
    expect(crossover).not.toMatch(/tradingBot\.(update|delete)|submitOrder|tradingOutboxEvent\.create/);
  });
});
