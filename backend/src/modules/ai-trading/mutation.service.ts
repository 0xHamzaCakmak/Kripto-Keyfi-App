import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { createMutationFactoryBot } from './bot-factory.service.js';
import type { CreateMutationInput, MutationsQuery } from './mutation.schema.js';
import { validateStrategyParameterSet } from './strategy-parameter-validator.js';
import { strategyParameterSchemaSchema, type StrategyParameterSchema } from './strategy-registry.schema.js';

type MutationSpec = CreateMutationInput['mutations'][number];

export function applyParameterMutations(
  schema: StrategyParameterSchema, current: Record<string, unknown>, mutations: MutationSpec[],
) {
  const next = { ...current };
  const diff: Record<string, { from: number; to: number; operation: MutationSpec['operation'] }> = {};
  for (const mutation of mutations) {
    const definition = schema.parameters[mutation.parameter];
    if (!definition) throw new ApiError(400, `Unknown mutation parameter: ${mutation.parameter}`, 'MUTATION_PARAMETER_UNKNOWN');
    if (definition.type !== 'number' && definition.type !== 'integer') {
      throw new ApiError(400, `Mutation parameter must be numeric: ${mutation.parameter}`, 'MUTATION_PARAMETER_NOT_NUMERIC');
    }
    const previous = current[mutation.parameter];
    if (typeof previous !== 'number' || !Number.isFinite(previous)) {
      throw new ApiError(409, `Stored parameter is not numeric: ${mutation.parameter}`, 'MUTATION_PARENT_INVALID');
    }
    const raw = mutation.operation === 'ADD' ? previous + mutation.value
      : mutation.operation === 'PERCENT' ? previous * (1 + mutation.value / 100) : mutation.value;
    const value = definition.type === 'integer' ? Math.round(raw) : raw;
    next[mutation.parameter] = value;
    diff[mutation.parameter] = { from: previous, to: value, operation: mutation.operation };
  }
  const validation = validateStrategyParameterSet(schema, next);
  if (!validation.success) {
    throw new ApiError(400, 'Mutation exceeds the registered strategy parameter schema.', 'MUTATION_OUT_OF_RANGE', validation.issues);
  }
  return { parameters: validation.parameters, diff };
}

export async function createMutation(userId: string, input: CreateMutationInput, ipAddress?: string) {
  const parent = await prisma.tradingBot.findFirst({
    where: { id: input.parentBotId, userId, type: 'AUTONOMOUS' },
    select: { id: true, configuration: true, timeframe: true, strategyVersion: { select: { parameterSchema: true, supportedTimeframes: true } } },
  });
  if (!parent?.strategyVersion) throw new ApiError(404, 'Mutation parent bot not found.', 'MUTATION_PARENT_NOT_FOUND');
  const parsedSchema = strategyParameterSchemaSchema.safeParse(parent.strategyVersion.parameterSchema);
  if (!parsedSchema.success) throw new ApiError(500, 'Stored strategy parameter schema is invalid.', 'STRATEGY_SCHEMA_INVALID');
  const current = jsonObject(parent.configuration);
  const result = applyParameterMutations(parsedSchema.data, current, input.mutations);
  const timeframe = input.timeframe ?? parent.timeframe ?? undefined;
  if (input.timeframe) assertTimeframeSupported(parent.strategyVersion.supportedTimeframes, input.timeframe);
  return createMutationFactoryBot(userId, input.parentBotId, {
    name: input.name, parameters: result.parameters, generationId: input.generationId, reason: input.reason,
    diff: { parameters: result.diff, timeframe: input.timeframe && input.timeframe !== parent.timeframe ? { from: parent.timeframe, to: input.timeframe } : null },
    mode: input.mode,
    ...(timeframe ? { timeframe } : {}),
  }, ipAddress);
}

export async function listMutations(userId: string, query: MutationsQuery) {
  return prisma.botMutation.findMany({
    where: { parentBot: { userId, type: 'AUTONOMOUS' }, ...(query.parentBotId ? { parentBotId: query.parentBotId } : {}), ...(query.generationId ? { generationId: query.generationId } : {}) },
    include: { parentBot: { select: { name: true, lifecycleStatus: true } }, childBot: { select: { name: true, lifecycleStatus: true, mode: true } }, generation: { select: { number: true, status: true } } },
    orderBy: { createdAt: 'desc' }, take: query.limit,
  });
}

function jsonObject(value: Prisma.JsonValue) {
  if (value === null || Array.isArray(value) || typeof value !== 'object') throw new ApiError(409, 'Parent parameters are invalid.', 'MUTATION_PARENT_INVALID');
  return value as Record<string, unknown>;
}
function assertTimeframeSupported(value: Prisma.JsonValue | null, timeframe: string) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string') || !value.includes(timeframe)) {
    throw new ApiError(400, 'Timeframe mutation is not supported by this strategy version.', 'MUTATION_TIMEFRAME_UNSUPPORTED');
  }
}
