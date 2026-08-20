import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { createCrossoverFactoryBot } from './bot-factory.service.js';
import type { CreateCrossoverInput, CrossoversQuery } from './crossover.schema.js';
import { validateStrategyParameterSet } from './strategy-parameter-validator.js';
import { strategyParameterSchemaSchema, type StrategyParameterSchema } from './strategy-registry.schema.js';

export function schemasAreCompatible(left: StrategyParameterSchema, right: StrategyParameterSchema) {
  return stableStringify(left) === stableStringify(right);
}

export function combineCrossoverParameters(
  schema: StrategyParameterSchema, parentA: Record<string, unknown>, parentB: Record<string, unknown>,
  inheritFromB: string[], generatedFields: Record<string, string | number | boolean>,
) {
  const known = new Set(Object.keys(schema.parameters));
  for (const name of [...inheritFromB, ...Object.keys(generatedFields)]) {
    if (!known.has(name)) throw new ApiError(400, `Unknown crossover field: ${name}`, 'CROSSOVER_FIELD_UNKNOWN');
  }
  const parameters = { ...parentA };
  const inheritedFields: Record<string, 'A' | 'B' | 'GENERATED'> = Object.fromEntries(Object.keys(schema.parameters).map((name) => [name, 'A']));
  for (const name of inheritFromB) { parameters[name] = parentB[name]; inheritedFields[name] = 'B'; }
  Object.assign(parameters, generatedFields);
  for (const name of Object.keys(generatedFields)) inheritedFields[name] = 'GENERATED';
  const validation = validateStrategyParameterSet(schema, parameters);
  if (!validation.success) throw new ApiError(400, 'Crossover parameter combination is invalid.', 'CROSSOVER_PARAMETERS_INVALID', validation.issues);
  return { parameters: validation.parameters, inheritedFields, generatedFields };
}

export async function createCrossover(userId: string, input: CreateCrossoverInput, ipAddress?: string) {
  const parents = await prisma.tradingBot.findMany({
    where: { id: { in: [input.parentABotId, input.parentBBotId] }, userId, type: 'AUTONOMOUS' },
    select: { id: true, configuration: true, strategyVersion: { select: { parameterSchema: true, strategy: { select: { family: true } } } } },
  });
  const parentA = parents.find((parent) => parent.id === input.parentABotId);
  const parentB = parents.find((parent) => parent.id === input.parentBBotId);
  if (!parentA?.strategyVersion || !parentB?.strategyVersion) throw new ApiError(404, 'Crossover parent not found.', 'CROSSOVER_PARENT_NOT_FOUND');
  if (parentA.strategyVersion.strategy.family !== parentB.strategyVersion.strategy.family) throw new ApiError(409, 'Crossover strategy families are incompatible.', 'CROSSOVER_FAMILY_MISMATCH');
  const schemaA = strategyParameterSchemaSchema.safeParse(parentA.strategyVersion.parameterSchema);
  const schemaB = strategyParameterSchemaSchema.safeParse(parentB.strategyVersion.parameterSchema);
  if (!schemaA.success || !schemaB.success || !schemasAreCompatible(schemaA.data, schemaB.data)) throw new ApiError(409, 'Crossover strategy schemas are incompatible.', 'CROSSOVER_SCHEMA_MISMATCH');
  const combined = combineCrossoverParameters(schemaA.data, jsonObject(parentA.configuration), jsonObject(parentB.configuration), input.inheritFromB, input.generatedFields);
  return createCrossoverFactoryBot(userId, input.parentABotId, {
    name: input.name, parameters: combined.parameters, generationId: input.generationId, parentBBotId: input.parentBBotId,
    inheritedFields: combined.inheritedFields, generatedFields: combined.generatedFields,
  }, ipAddress);
}

export async function listCrossovers(userId: string, query: CrossoversQuery) {
  return prisma.botCrossover.findMany({
    where: { parentA: { userId, type: 'AUTONOMOUS' }, ...(query.generationId ? { generationId: query.generationId } : {}), ...(query.parentBotId ? { OR: [{ parentABotId: query.parentBotId }, { parentBBotId: query.parentBotId }] } : {}) },
    include: { parentA: { select: { name: true } }, parentB: { select: { name: true } }, child: { select: { name: true, lifecycleStatus: true, mode: true } }, generation: { select: { number: true, status: true } } },
    orderBy: { createdAt: 'desc' }, take: query.limit,
  });
}

function jsonObject(value: Prisma.JsonValue) {
  if (value === null || Array.isArray(value) || typeof value !== 'object') throw new ApiError(409, 'Crossover parent parameters are invalid.', 'CROSSOVER_PARENT_INVALID');
  return value as Record<string, unknown>;
}
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
