import type { AutonomousTradingStatus, Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { createMutation } from './mutation.service.js';
import { createCrossover, schemasAreCompatible } from './crossover.service.js';
import { cloneFactoryBot } from './bot-factory.service.js';
import { strategyParameterSchemaSchema, type StrategyParameterSchema } from './strategy-registry.schema.js';
import { DEFAULT_EVOLUTION_CONFIG, evolutionConfigSchema, type EvolutionConfig, type EvolutionRunsQuery, type RunEvolutionInput } from './evolution.schema.js';

export type EvolutionEvidence = {
  botId: string; score: number | null; totalTrades: number; lifecycleStatus: AutonomousTradingStatus;
};

export function selectEvolutionPopulation(evidence: EvolutionEvidence[], config: EvolutionConfig) {
  const protectedBots = evidence.filter((item) => item.lifecycleStatus === 'CHAMPION' || item.lifecycleStatus === 'LIVE' || item.lifecycleStatus === 'LIVE_ELIGIBLE');
  const mutable = evidence.filter((item) => !protectedBots.includes(item));
  const eligible = mutable.filter((item) => item.score !== null && item.totalTrades >= config.minimumTrades)
    .sort((left, right) => right.score! - left.score! || left.botId.localeCompare(right.botId));
  const survivors = eligible.slice(0, config.survivorCount);
  const weak = eligible.slice(config.survivorCount).filter((item) => !['CHAMPION', 'LIVE_ELIGIBLE', 'LIVE'].includes(item.lifecycleStatus));
  const insufficient = mutable.filter((item) => item.score === null || item.totalTrades < config.minimumTrades);
  return { eligible, survivors, weak, insufficient, protectedBots };
}

export async function runEvolution(userId: string, input: RunEvolutionInput, ipAddress?: string) {
  const config = evolutionConfigSchema.parse({ ...DEFAULT_EVOLUTION_CONFIG, ...input.config });
  const source = await prisma.generation.findFirst({
    where: { id: input.sourceGenerationId, createdById: userId },
    include: { bots: {
      where: { type: 'AUTONOMOUS' },
      include: {
        metrics: { orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }], take: 1 },
        strategyVersion: { select: { parameterSchema: true, strategy: { select: { family: true } } } },
      },
    } },
  });
  if (!source) throw new ApiError(404, 'Source generation not found.', 'EVOLUTION_SOURCE_NOT_FOUND');
  if (source.status !== 'EVALUATING' && source.status !== 'COMPLETED') throw new ApiError(409, 'Source generation is not ready for Evolution.', 'EVOLUTION_SOURCE_NOT_READY');
  if (source.number >= config.maxGenerations) throw new ApiError(409, 'Maximum generation count reached.', 'EVOLUTION_MAX_GENERATIONS');
  const evidence = source.bots.map((bot) => ({
    botId: bot.id, lifecycleStatus: bot.lifecycleStatus,
    score: bot.metrics[0]?.score?.toNumber() ?? null, totalTrades: bot.metrics[0]?.totalTrades ?? 0,
  }));
  const selection = selectEvolutionPopulation(evidence, config);
  if (selection.survivors.length < config.survivorCount) {
    throw new ApiError(409, 'Not enough bots satisfy minimum Evolution evidence.', 'EVOLUTION_EVIDENCE_INSUFFICIENT');
  }
  const hypotheses = config.researcherCandidateCount === 0 ? [] : await prisma.researchHypothesis.findMany({
    where: { createdById: userId, status: { in: ['DRAFT', 'ACCEPTED'] } }, orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
  });
  if (config.researcherCandidateCount > 0 && hypotheses.length === 0) {
    throw new ApiError(409, 'Researcher candidates requested but no hypotheses are available.', 'EVOLUTION_HYPOTHESES_MISSING');
  }
  const run = await prisma.evolutionRun.create({ data: {
    createdById: userId, sourceGenerationId: source.id, status: 'RUNNING', config,
    evidence: { fitness: 'BOT_SCORE', minimumTrades: config.minimumTrades, bots: evidence } as Prisma.InputJsonObject,
    selection: { survivorIds: selection.survivors.map((item) => item.botId), weakIds: selection.weak.map((item) => item.botId), insufficientIds: selection.insufficient.map((item) => item.botId), protectedIds: selection.protectedBots.map((item) => item.botId) },
  } });
  let targetGenerationId: string | undefined;
  try {
    const target = await prisma.generation.create({ data: {
      createdById: userId, number: source.number + 1, status: 'RUNNING', populationTarget: config.populationSize,
      metadata: { evolutionRunId: run.id, sourceGenerationId: source.id, mode: 'PAPER', liveEnabled: false },
    } });
    targetGenerationId = target.id;
    const survivorBots = source.bots.filter((bot) => selection.survivors.some((item) => item.botId === bot.id));
    const children = [];
    for (let index = 0; index < survivorBots.length; index++) {
      const survivor = survivorBots[index]!;
      children.push(await cloneFactoryBot(userId, survivor.id, {
        name: `g${target.number}-s${index + 1}-${survivor.name}`.slice(0, 100),
        generationId: target.id, mode: 'PAPER',
      }, ipAddress));
    }
    for (let index = 0; index < config.mutationCount; index++) {
      const parent = survivorBots[index % survivorBots.length]!;
      const mutation = deriveMutation(parent.strategyVersion?.parameterSchema, parent.configuration, index);
      children.push(await createMutation(userId, {
        parentBotId: parent.id, generationId: target.id, name: `g${target.number}-${index + 1}-${parent.name}`.slice(0, 100),
        reason: `EvolutionRun ${run.id}: score-based survivor mutation`, mutations: [mutation], mode: 'PAPER',
      }, ipAddress));
    }
    const crossoverPairs = compatibleCrossoverPairs(survivorBots);
    if (config.crossoverCount > 0 && crossoverPairs.length === 0) throw new ApiError(409, 'No compatible survivor pair exists for crossover.', 'EVOLUTION_CROSSOVER_UNAVAILABLE');
    for (let index = 0; index < config.crossoverCount; index++) {
      const [parentA, parentB, schema] = crossoverPairs[index % crossoverPairs.length]!;
      const fields = Object.keys(schema.parameters);
      children.push(await createCrossover(userId, {
        parentABotId: parentA.id, parentBBotId: parentB.id, generationId: target.id,
        name: `g${target.number}-x${index + 1}-${parentA.name}`.slice(0, 100),
        inheritFromB: fields.slice(Math.ceil(fields.length / 2)), generatedFields: {},
      }, ipAddress));
    }
    for (let index = 0; index < config.researcherCandidateCount; index++) {
      const hypothesis = hypotheses[index % hypotheses.length]!;
      const compatible = survivorBots.filter((bot) => bot.strategyVersion?.strategy.family === hypothesis.targetStrategyFamily);
      if (compatible.length === 0) throw new ApiError(409, `No survivor matches hypothesis family ${hypothesis.targetStrategyFamily}.`, 'EVOLUTION_HYPOTHESIS_INCOMPATIBLE');
      const parent = compatible[index % compatible.length]!;
      const mutation = deriveMutation(parent.strategyVersion?.parameterSchema, parent.configuration, index, suggestedKeyword(hypothesis.suggestedChange));
      children.push(await createMutation(userId, {
        parentBotId: parent.id, generationId: target.id, name: `g${target.number}-r${index + 1}-${parent.name}`.slice(0, 100),
        reason: `EvolutionRun ${run.id}: ResearchHypothesis ${hypothesis.id}`, mutations: [mutation], mode: 'PAPER',
      }, ipAddress));
    }
    await retireSourcePopulation(userId, source.bots.map((bot) => bot.id), selection.protectedBots.map((bot) => bot.botId), run.id, ipAddress);
    await prisma.$transaction([
      prisma.tradingBot.updateMany({
        where: { id: { in: children.map((child) => child.id) }, userId, type: 'AUTONOMOUS', mode: 'PAPER' },
        data: { lifecycleStatus: 'PAPER', state: 'STARTING', desiredState: 'RUNNING', intervalSeconds: 15, stateReason: `Evolution ${run.id} PAPER evaluation started.`, schedulerOwner: null, leaseExpiresAt: null, version: { increment: 1 } },
      }),
      prisma.generation.update({ where: { id: target.id }, data: { status: 'EVALUATING', metadata: { evolutionRunId: run.id, sourceGenerationId: source.id, mode: 'PAPER', liveEnabled: false, childIds: children.map((child) => child.id) } } }),
      prisma.generation.update({ where: { id: source.id }, data: { status: 'COMPLETED', completedAt: new Date() } }),
      prisma.evolutionRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', targetGenerationId: target.id, completedAt: new Date(), selection: { survivorIds: selection.survivors.map((item) => item.botId), archivedIds: selection.weak.map((item) => item.botId), childIds: children.map((child) => child.id), liveChanged: false } } }),
      prisma.tradingAuditLog.create({ data: { userId, action: 'AI_EVOLUTION_COMPLETED', entityType: 'EVOLUTION_RUN', entityId: run.id, metadata: { sourceGenerationId: source.id, targetGenerationId: target.id, fitness: 'BOT_SCORE', childCount: children.length, liveChanged: false }, ...(ipAddress ? { ipAddress } : {}) } }),
    ]);
    return { runId: run.id, sourceGenerationId: source.id, targetGenerationId: target.id, survivors: selection.survivors.length, archived: selection.weak.length, children: children.length, mode: 'PAPER', liveChanged: false };
  } catch (error) {
    await prisma.$transaction([
      ...(targetGenerationId ? [prisma.generation.update({ where: { id: targetGenerationId }, data: { status: 'FAILED', completedAt: new Date() } })] : []),
      prisma.evolutionRun.update({ where: { id: run.id }, data: { status: 'FAILED', ...(targetGenerationId ? { targetGenerationId } : {}), completedAt: new Date(), errorMessage: error instanceof Error ? error.message.slice(0, 1000) : 'Evolution failed.' } }),
    ]);
    throw error;
  }
}

export async function listEvolutionRuns(userId: string, query: EvolutionRunsQuery) {
  return prisma.evolutionRun.findMany({ where: { createdById: userId, ...(query.status ? { status: query.status } : {}) }, include: { sourceGeneration: { select: { number: true, status: true } }, targetGeneration: { select: { number: true, status: true } } }, orderBy: { createdAt: 'desc' }, take: query.limit });
}

async function retireSourcePopulation(userId: string, sourceIds: string[], protectedIds: string[], runId: string, ipAddress?: string) {
  const retired = sourceIds.filter((id) => !protectedIds.includes(id));
  if (retired.length === 0) return;
  await prisma.$transaction([
    prisma.tradingBot.updateMany({ where: { id: { in: retired }, userId, type: 'AUTONOMOUS' }, data: { lifecycleStatus: 'ARCHIVED', state: 'STOPPED', desiredState: 'STOPPED', schedulerOwner: null, leaseExpiresAt: null, stateReason: `Retired after Evolution ${runId}.`, version: { increment: 1 } } }),
    prisma.tradingAuditLog.create({ data: { userId, action: 'AI_EVOLUTION_SOURCE_RETIRED', entityType: 'EVOLUTION_RUN', entityId: runId, metadata: { retiredBotIds: retired, protectedBotIds: protectedIds, liveChanged: false }, ...(ipAddress ? { ipAddress } : {}) } }),
  ]);
}

function deriveMutation(schemaValue: Prisma.JsonValue | undefined, configuration: Prisma.JsonValue, index: number, keyword?: string) {
  const schema = strategyParameterSchemaSchema.safeParse(schemaValue);
  if (!schema.success) throw new ApiError(409, 'Survivor strategy schema is invalid.', 'EVOLUTION_SCHEMA_INVALID');
  if (configuration === null || Array.isArray(configuration) || typeof configuration !== 'object') throw new ApiError(409, 'Survivor parameters are invalid.', 'EVOLUTION_PARAMETERS_INVALID');
  const candidates = numericParameters(schema.data, keyword);
  if (candidates.length === 0) throw new ApiError(409, 'No compatible numeric mutation parameter exists.', 'EVOLUTION_MUTATION_UNAVAILABLE');
  const [name, definition] = candidates[index % candidates.length]!;
  const current = (configuration as Prisma.JsonObject)[name];
  if (typeof current !== 'number') throw new ApiError(409, 'Survivor numeric parameter is invalid.', 'EVOLUTION_PARAMETERS_INVALID');
  const step = definition.step ?? (definition.max - definition.min) / 20;
  const up = current + step <= definition.max; const value = up ? current + step : current - step;
  return { parameter: name, operation: 'SET' as const, value: definition.type === 'integer' ? Math.round(value) : Number(value.toFixed(12)) };
}
function numericParameters(schema: StrategyParameterSchema, keyword?: string) {
  const values = Object.entries(schema.parameters).filter((entry): entry is [string, Extract<StrategyParameterSchema['parameters'][string], { type: 'number' | 'integer' }>] =>
    (entry[1].type === 'number' || entry[1].type === 'integer') && entry[1].min < entry[1].max);
  return keyword ? [...values.filter(([name]) => name.toLowerCase().includes(keyword)), ...values.filter(([name]) => !name.toLowerCase().includes(keyword))] : values;
}
function suggestedKeyword(value: Prisma.JsonValue) {
  if (value === null || Array.isArray(value) || typeof value !== 'object') return undefined;
  const type = (value as Prisma.JsonObject).type;
  if (typeof type !== 'string') return undefined;
  if (type.includes('CONFIDENCE')) return 'confidence'; if (type.includes('COOLDOWN')) return 'cooldown'; if (type.includes('FUNDING')) return 'funding';
  return undefined;
}

function compatibleCrossoverPairs<T extends { id: string; strategyVersion: { parameterSchema: Prisma.JsonValue; strategy: { family: string } } | null }>(bots: T[]) {
  const pairs: Array<[T, T, StrategyParameterSchema]> = [];
  for (let left = 0; left < bots.length; left++) {
    for (let right = left + 1; right < bots.length; right++) {
      const parentA = bots[left]!; const parentB = bots[right]!;
      if (!parentA.strategyVersion || !parentB.strategyVersion || parentA.strategyVersion.strategy.family !== parentB.strategyVersion.strategy.family) continue;
      const schemaA = strategyParameterSchemaSchema.safeParse(parentA.strategyVersion.parameterSchema);
      const schemaB = strategyParameterSchemaSchema.safeParse(parentB.strategyVersion.parameterSchema);
      if (schemaA.success && schemaB.success && schemasAreCompatible(schemaA.data, schemaB.data)) pairs.push([parentA, parentB, schemaA.data]);
    }
  }
  return pairs;
}
