import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  CreateStrategyInput,
  CreateStrategyVersionInput,
  ValidateStrategyParametersInput,
} from './strategy-registry.schema.js';
import { strategyParameterSchemaSchema } from './strategy-registry.schema.js';
import {
  allowedParameterRangesFor,
  defaultParametersFor,
  validateStrategyParameterSet,
} from './strategy-parameter-validator.js';

const strategyInclude = {
  versions: { orderBy: { version: 'desc' as const } },
} satisfies Prisma.StrategyInclude;

export async function listStrategies(createdById: string) {
  const strategies = await prisma.strategy.findMany({
    where: { createdById },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    orderBy: { createdAt: 'desc' },
  });
  return strategies.map(presentStrategy);
}

export async function getStrategy(createdById: string, id: string) {
  const strategy = await ownedStrategy(createdById, id);
  return presentStrategy(strategy);
}

export async function createStrategy(createdById: string, input: CreateStrategyInput) {
  const defaults = defaultParametersFor(input.initialVersion.parameterSchema);
  try {
    const strategy = await prisma.$transaction(async (tx) => {
      const created = await tx.strategy.create({ data: {
        createdById,
        family: input.family,
        name: input.name,
        ...(input.description ? { description: input.description } : {}),
        versions: { create: {
          createdById,
          version: 1,
          parameterSchema: input.initialVersion.parameterSchema as Prisma.InputJsonValue,
          defaultParameters: defaults as Prisma.InputJsonValue,
          allowedMarkets: input.initialVersion.allowedMarkets,
          supportedTimeframes: input.initialVersion.supportedTimeframes,
        } },
      }, include: strategyInclude });
      await tx.tradingAuditLog.create({ data: {
        userId: createdById,
        action: 'AI_STRATEGY_CREATED',
        entityType: 'STRATEGY',
        entityId: created.id,
        metadata: { family: created.family, version: 1, status: created.status },
      } });
      return created;
    });
    return presentStrategy(strategy);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(409, 'Bu isimde bir strategy zaten mevcut.', 'STRATEGY_EXISTS');
    }
    throw error;
  }
}

export async function createStrategyVersion(createdById: string, strategyId: string, input: CreateStrategyVersionInput) {
  await ownedStrategy(createdById, strategyId);
  const defaults = defaultParametersFor(input.parameterSchema);
  try {
    const version = await prisma.$transaction(async (tx) => {
      const latest = await tx.strategyVersion.aggregate({ where: { strategyId }, _max: { version: true } });
      const nextVersion = (latest._max.version ?? 0) + 1;
      const created = await tx.strategyVersion.create({ data: {
        strategyId,
        createdById,
        version: nextVersion,
        parameterSchema: input.parameterSchema as Prisma.InputJsonValue,
        defaultParameters: defaults as Prisma.InputJsonValue,
        allowedMarkets: input.allowedMarkets,
        supportedTimeframes: input.supportedTimeframes,
      } });
      await tx.tradingAuditLog.create({ data: {
        userId: createdById,
        action: 'AI_STRATEGY_VERSION_CREATED',
        entityType: 'STRATEGY_VERSION',
        entityId: created.id,
        metadata: { strategyId, version: nextVersion, status: created.status },
      } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return presentVersion(version);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(409, 'Strategy version eşzamanlı olarak oluşturuldu; tekrar deneyin.', 'STRATEGY_VERSION_CONFLICT');
    }
    throw error;
  }
}

export async function validateStrategyParameters(
  createdById: string,
  strategyId: string,
  input: ValidateStrategyParametersInput,
) {
  const version = await prisma.strategyVersion.findFirst({
    where: {
      strategyId,
      strategy: { createdById },
      ...(input.version === undefined ? {} : { version: input.version }),
    },
    orderBy: { version: 'desc' },
  });
  if (!version) throw new ApiError(404, 'Strategy veya version bulunamadı.', 'STRATEGY_VERSION_NOT_FOUND');
  const parsedSchema = strategyParameterSchemaSchema.safeParse(version.parameterSchema);
  if (!parsedSchema.success) {
    throw new ApiError(500, 'Kayıtlı strategy parameter schema geçersiz.', 'STRATEGY_SCHEMA_INVALID');
  }
  const result = validateStrategyParameterSet(parsedSchema.data, input.parameters);
  if (!result.success) {
    throw new ApiError(400, 'Strategy parametreleri doğrulanamadı.', 'STRATEGY_PARAMETERS_INVALID', result.issues);
  }
  return { valid: true as const, strategyId, strategyVersionId: version.id, version: version.version, parameters: result.parameters };
}

async function ownedStrategy(createdById: string, id: string) {
  const strategy = await prisma.strategy.findFirst({ where: { id, createdById }, include: strategyInclude });
  if (!strategy) throw new ApiError(404, 'Strategy bulunamadı.', 'STRATEGY_NOT_FOUND');
  return strategy;
}

function presentStrategy<T extends { versions: Array<Parameters<typeof presentVersion>[0]> }>(strategy: T) {
  return { ...strategy, versions: strategy.versions.map(presentVersion) };
}

function presentVersion<T extends { parameterSchema: Prisma.JsonValue }>(version: T) {
  const parsed = strategyParameterSchemaSchema.safeParse(version.parameterSchema);
  return {
    ...version,
    allowedParameterRanges: parsed.success ? allowedParameterRangesFor(parsed.data) : null,
  };
}
