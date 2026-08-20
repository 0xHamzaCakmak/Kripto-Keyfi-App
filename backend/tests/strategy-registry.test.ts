import { describe, expect, it } from 'vitest';
import {
  createStrategyBodySchema,
  strategyParameterSchemaSchema,
  validateStrategyParametersBodySchema,
} from '../src/modules/ai-trading/strategy-registry.schema.js';
import {
  allowedParameterRangesFor,
  defaultParametersFor,
  validateStrategyParameterSet,
} from '../src/modules/ai-trading/strategy-parameter-validator.js';

const parameterSchema = {
  parameters: {
    atrMultiplier: { type: 'number' as const, min: 1, max: 3, step: 0.1, default: 1.8 },
    cooldownSeconds: { type: 'integer' as const, min: 0, max: 3600, step: 30, default: 300 },
    marginMode: { type: 'enum' as const, values: ['ISOLATED', 'CROSS'], default: 'ISOLATED' },
    enabled: { type: 'boolean' as const, default: true },
  },
};

describe('strategy registry contracts', () => {
  it('accepts a bounded versioned strategy and normalizes timeframes', () => {
    const result = createStrategyBodySchema.safeParse({
      family: 'ATR_BREAKOUT',
      name: 'ATR Breakout',
      initialVersion: {
        parameterSchema,
        allowedMarkets: ['FUTURES', 'FUTURES'],
        supportedTimeframes: ['15M', '1h', '15m'],
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.initialVersion.allowedMarkets).toEqual(['FUTURES']);
      expect(result.data.initialVersion.supportedTimeframes).toEqual(['15m', '1h']);
    }
  });

  it('rejects invalid ranges, defaults and uncontrolled descriptor fields', () => {
    expect(strategyParameterSchemaSchema.safeParse({
      parameters: { threshold: { type: 'number', min: 10, max: 1, default: 5 } },
    }).success).toBe(false);
    expect(strategyParameterSchemaSchema.safeParse({
      parameters: { mode: { type: 'enum', values: ['A'], default: 'B' } },
    }).success).toBe(false);
    expect(strategyParameterSchemaSchema.safeParse({
      parameters: { leverage: { type: 'integer', min: 1, max: 5, default: 2, arbitrary: 'unsafe' } },
    }).success).toBe(false);
  });

  it('derives defaults and allowed ranges from the validated schema', () => {
    const parsed = strategyParameterSchemaSchema.parse(parameterSchema);
    expect(defaultParametersFor(parsed)).toEqual({
      atrMultiplier: 1.8,
      cooldownSeconds: 300,
      marginMode: 'ISOLATED',
      enabled: true,
    });
    expect(allowedParameterRangesFor(parsed).atrMultiplier).toEqual({ type: 'number', min: 1, max: 3, step: 0.1 });
  });

  it('rejects missing, unknown, wrong-type and out-of-range bot parameters', () => {
    const parsed = strategyParameterSchemaSchema.parse(parameterSchema);
    expect(validateStrategyParameterSet(parsed, {
      atrMultiplier: 1.9,
      cooldownSeconds: 330,
      marginMode: 'ISOLATED',
      enabled: false,
    }).success).toBe(true);
    const invalid = validateStrategyParameterSet(parsed, {
      atrMultiplier: 3.5,
      cooldownSeconds: 315,
      marginMode: 'INVALID',
      extra: true,
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) expect(invalid.issues.map((issue) => issue.parameter)).toEqual(expect.arrayContaining([
      'atrMultiplier', 'cooldownSeconds', 'marginMode', 'enabled', 'extra',
    ]));
  });

  it('keeps validation payloads structured and bounded', () => {
    expect(validateStrategyParametersBodySchema.safeParse({
      version: 1,
      parameters: { atrMultiplier: 2.1 },
    }).success).toBe(true);
    expect(validateStrategyParametersBodySchema.safeParse({
      version: 0,
      parameters: {},
      executeLive: true,
    }).success).toBe(false);
  });
});
