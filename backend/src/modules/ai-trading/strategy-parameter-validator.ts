import type { StrategyParameterDefinition, StrategyParameterSchema } from './strategy-registry.schema.js';

export type StrategyParameterValue = string | number | boolean;
export type StrategyParameterSet = Record<string, StrategyParameterValue>;
export type StrategyParameterValidation =
  | { success: true; parameters: StrategyParameterSet }
  | { success: false; issues: Array<{ parameter: string; message: string }> };

export function defaultParametersFor(schema: StrategyParameterSchema): StrategyParameterSet {
  return Object.fromEntries(Object.entries(schema.parameters).map(([name, definition]) => [name, definition.default]));
}

export function allowedParameterRangesFor(schema: StrategyParameterSchema) {
  return Object.fromEntries(Object.entries(schema.parameters).map(([name, definition]) => [name, allowedRange(definition)]));
}

export function validateStrategyParameterSet(
  schema: StrategyParameterSchema,
  candidate: Record<string, unknown>,
): StrategyParameterValidation {
  const issues: Array<{ parameter: string; message: string }> = [];
  const knownNames = new Set(Object.keys(schema.parameters));

  for (const name of Object.keys(candidate)) {
    if (!knownNames.has(name)) issues.push({ parameter: name, message: 'Bilinmeyen strateji parametresi.' });
  }

  const parameters: StrategyParameterSet = {};
  for (const [name, definition] of Object.entries(schema.parameters)) {
    const value = candidate[name];
    if (value === undefined) {
      issues.push({ parameter: name, message: 'Zorunlu strateji parametresi eksik.' });
      continue;
    }
    const error = validateValue(definition, value);
    if (error) issues.push({ parameter: name, message: error });
    else parameters[name] = value as StrategyParameterValue;
  }

  return issues.length > 0 ? { success: false, issues } : { success: true, parameters };
}

function validateValue(definition: StrategyParameterDefinition, value: unknown): string | undefined {
  switch (definition.type) {
    case 'number':
    case 'integer': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'Sonlu bir sayı olmalıdır.';
      if (definition.type === 'integer' && !Number.isInteger(value)) return 'Tam sayı olmalıdır.';
      if (value < definition.min || value > definition.max) return `${definition.min} ile ${definition.max} arasında olmalıdır.`;
      if (definition.step !== undefined && !isStepAligned(value, definition.min, definition.step)) return `${definition.step} adımına uymalıdır.`;
      return undefined;
    }
    case 'boolean':
      return typeof value === 'boolean' ? undefined : 'Boolean olmalıdır.';
    case 'enum':
      return typeof value === 'string' && definition.values.includes(value) ? undefined : 'İzin verilen enum değerlerinden biri olmalıdır.';
    case 'string':
      if (typeof value !== 'string') return 'Metin olmalıdır.';
      return value.length >= definition.minLength && value.length <= definition.maxLength
        ? undefined
        : `${definition.minLength} ile ${definition.maxLength} karakter arasında olmalıdır.`;
  }
}

function allowedRange(definition: StrategyParameterDefinition) {
  switch (definition.type) {
    case 'number':
    case 'integer':
      return { type: definition.type, min: definition.min, max: definition.max, ...(definition.step === undefined ? {} : { step: definition.step }) };
    case 'enum':
      return { type: definition.type, values: definition.values };
    case 'string':
      return { type: definition.type, minLength: definition.minLength, maxLength: definition.maxLength };
    case 'boolean':
      return { type: definition.type };
  }
}

function isStepAligned(value: number, base: number, step: number) {
  const quotient = (value - base) / step;
  return Math.abs(quotient - Math.round(quotient)) < 1e-9;
}
