import { Prisma, type AutonomousTradingStatus, type BotCreationMethod, type TradingBotMode } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import type {
  CloneFactoryBotInput,
  CreateFactoryBotInput,
  CreateParameterVariantInput,
} from './bot-factory.schema.js';
import { assertBotLifecycleTransition } from './bot-lifecycle.js';
import { validateStrategyParameterSet } from './strategy-parameter-validator.js';
import { strategyParameterSchemaSchema } from './strategy-registry.schema.js';

const botFactorySelect = {
  id: true, name: true, type: true, mode: true, state: true, desiredState: true,
  lifecycleStatus: true, factoryCreationMethod: true, strategyVersionId: true,
  generationId: true, parentBotId: true, riskProfileId: true, exchangeAccountId: true,
  startingPaperBalance: true, symbols: true, timeframe: true, configuration: true,
  createdAt: true, updatedAt: true, version: true,
  strategyVersion: { select: { version: true, strategy: { select: { id: true, name: true, family: true } } } },
} satisfies Prisma.TradingBotSelect;

type FactoryCreateData = {
  name: string;
  strategyVersionId: string;
  exchangeAccountId: string;
  parameters: Record<string, unknown>;
  startingPaperBalance: string;
  symbols: string[];
  timeframe: string;
  mode: 'PAPER' | 'SHADOW';
  riskProfileId: string;
  generationId?: string;
  parentBotId?: string;
  creationMethod: BotCreationMethod;
  lifecycleStatus: AutonomousTradingStatus;
  mutation?: { reason: string; diff: Prisma.InputJsonObject };
};

export type MutationFactoryInput = {
  name: string;
  parameters: Record<string, unknown>;
  timeframe?: string;
  generationId: string;
  reason: string;
  diff: Prisma.InputJsonObject;
};

export function mergeParameterVariant(
  parameters: Record<string, unknown>,
  overrides: Record<string, unknown>,
) {
  return { ...parameters, ...overrides };
}

export async function listFactoryBots(userId: string) {
  return prisma.tradingBot.findMany({
    where: { userId, type: 'AUTONOMOUS' },
    select: botFactorySelect,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getFactoryBot(userId: string, id: string) {
  return ownedFactoryBot(userId, id);
}

export async function createFactoryBot(userId: string, input: CreateFactoryBotInput, ipAddress?: string) {
  const { generationId, ...required } = input;
  return persistFactoryBot(userId, {
    ...required,
    ...(generationId ? { generationId } : {}),
    creationMethod: 'MANUAL',
    lifecycleStatus: 'DRAFT',
  }, ipAddress);
}

export async function cloneFactoryBot(
  userId: string,
  parentBotId: string,
  input: CloneFactoryBotInput,
  ipAddress?: string,
) {
  const parent = await ownedFactoryBot(userId, parentBotId);
  return persistFactoryBot(userId, {
    name: input.name,
    strategyVersionId: parent.strategyVersionId!,
    exchangeAccountId: parent.exchangeAccountId,
    parameters: jsonObject(parent.configuration, 'BOT_PARAMETERS_INVALID'),
    startingPaperBalance: input.startingPaperBalance ?? parent.startingPaperBalance.toString(),
    symbols: input.symbols ?? jsonStringArray(parent.symbols, parent.symbol),
    timeframe: input.timeframe ?? parent.timeframe ?? secondsToTimeframe(parent.intervalSeconds),
    mode: input.mode,
    riskProfileId: input.riskProfileId ?? parent.riskProfileId!,
    ...(input.generationId ?? parent.generationId ? { generationId: input.generationId ?? parent.generationId! } : {}),
    parentBotId,
    creationMethod: 'CLONE',
    lifecycleStatus: 'DRAFT',
  }, ipAddress);
}

export async function createParameterVariant(
  userId: string,
  parentBotId: string,
  input: CreateParameterVariantInput,
  ipAddress?: string,
) {
  const parent = await ownedFactoryBot(userId, parentBotId);
  const parameters = mergeParameterVariant(
    jsonObject(parent.configuration, 'BOT_PARAMETERS_INVALID'),
    input.parameterOverrides,
  );
  return persistFactoryBot(userId, {
    name: input.name,
    strategyVersionId: parent.strategyVersionId!,
    exchangeAccountId: parent.exchangeAccountId,
    parameters,
    startingPaperBalance: input.startingPaperBalance ?? parent.startingPaperBalance.toString(),
    symbols: input.symbols ?? jsonStringArray(parent.symbols, parent.symbol),
    timeframe: input.timeframe ?? parent.timeframe ?? secondsToTimeframe(parent.intervalSeconds),
    mode: input.mode,
    riskProfileId: input.riskProfileId ?? parent.riskProfileId!,
    ...(input.generationId ?? parent.generationId ? { generationId: input.generationId ?? parent.generationId! } : {}),
    parentBotId,
    creationMethod: 'PARAMETER_VARIANT',
    lifecycleStatus: 'CANDIDATE',
  }, ipAddress);
}

export async function createMutationFactoryBot(
  userId: string, parentBotId: string, input: MutationFactoryInput, ipAddress?: string,
) {
  const parent = await ownedFactoryBot(userId, parentBotId);
  return persistFactoryBot(userId, {
    name: input.name, strategyVersionId: parent.strategyVersionId!, exchangeAccountId: parent.exchangeAccountId,
    parameters: input.parameters, startingPaperBalance: parent.startingPaperBalance.toString(),
    symbols: jsonStringArray(parent.symbols, parent.symbol),
    timeframe: input.timeframe ?? parent.timeframe ?? secondsToTimeframe(parent.intervalSeconds),
    mode: parent.mode === 'SHADOW' ? 'SHADOW' : 'PAPER', riskProfileId: parent.riskProfileId!,
    generationId: input.generationId, parentBotId, creationMethod: 'PARAMETER_VARIANT', lifecycleStatus: 'CANDIDATE',
    mutation: { reason: input.reason, diff: input.diff },
  }, ipAddress);
}

export async function transitionFactoryBot(
  userId: string,
  id: string,
  target: AutonomousTradingStatus,
  ipAddress?: string,
) {
  const bot = await ownedFactoryBot(userId, id);
  assertBotLifecycleTransition(bot.lifecycleStatus, target, false);
  return prisma.$transaction(async (tx) => {
    const changed = await tx.tradingBot.updateMany({
      where: { id, userId, type: 'AUTONOMOUS', version: bot.version },
      data: { lifecycleStatus: target, version: { increment: 1 } },
    });
    if (changed.count !== 1) {
      throw new ApiError(409, 'Bot lifecycle changed concurrently; refresh and retry.', 'BOT_VERSION_CONFLICT');
    }
    await tx.tradingAuditLog.create({ data: {
      userId,
      exchangeAccountId: bot.exchangeAccountId,
      action: 'AI_BOT_LIFECYCLE_CHANGED',
      entityType: 'TRADING_BOT',
      entityId: id,
      metadata: { from: bot.lifecycleStatus, to: target, liveTradingEnabled: false },
      ...(ipAddress ? { ipAddress } : {}),
    } });
    return tx.tradingBot.findUniqueOrThrow({ where: { id }, select: botFactorySelect });
  });
}

async function persistFactoryBot(userId: string, data: FactoryCreateData, ipAddress?: string) {
  const dependencies = await validateDependencies(userId, data);
  const parsedSchema = strategyParameterSchemaSchema.safeParse(dependencies.strategyVersion.parameterSchema);
  if (!parsedSchema.success) throw new ApiError(500, 'Stored strategy parameter schema is invalid.', 'STRATEGY_SCHEMA_INVALID');
  const parameterResult = validateStrategyParameterSet(parsedSchema.data, data.parameters);
  if (!parameterResult.success) {
    throw new ApiError(400, 'Bot parameters failed strategy validation.', 'STRATEGY_PARAMETERS_INVALID', parameterResult.issues);
  }
  assertSupportedTimeframe(dependencies.strategyVersion.supportedTimeframes, data.timeframe);

  try {
    return await prisma.$transaction(async (tx) => {
      const bot = await tx.tradingBot.create({ data: {
        userId,
        exchangeAccountId: data.exchangeAccountId,
        name: data.name,
        type: 'AUTONOMOUS',
        mode: data.mode as TradingBotMode,
        symbol: data.symbols[0]!,
        symbols: data.symbols,
        timeframe: data.timeframe,
        intervalSeconds: timeframeToSeconds(data.timeframe),
        configuration: parameterResult.parameters as Prisma.InputJsonValue,
        strategyVersionId: data.strategyVersionId,
        riskProfileId: data.riskProfileId,
        startingPaperBalance: data.startingPaperBalance,
        factoryCreationMethod: data.creationMethod,
        lifecycleStatus: data.lifecycleStatus,
        ...(data.generationId ? { generationId: data.generationId } : {}),
        ...(data.parentBotId ? { parentBotId: data.parentBotId } : {}),
      }, select: botFactorySelect });
      if (data.mutation && data.generationId && data.parentBotId) {
        await tx.botMutation.create({ data: {
          parentBotId: data.parentBotId, childBotId: bot.id, generationId: data.generationId,
          reason: data.mutation.reason, diff: data.mutation.diff,
        } });
      }
      await tx.tradingAuditLog.create({ data: {
        userId,
        exchangeAccountId: data.exchangeAccountId,
        action: 'AI_BOT_FACTORY_CREATED',
        entityType: 'TRADING_BOT',
        entityId: bot.id,
        metadata: {
          creationMethod: data.creationMethod,
          mode: data.mode,
          lifecycleStatus: data.lifecycleStatus,
          strategyVersionId: data.strategyVersionId,
          parentBotId: data.parentBotId ?? null,
          mutation: data.mutation ?? null,
          liveTradingEnabled: false,
        },
        ...(ipAddress ? { ipAddress } : {}),
      } });
      return bot;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(409, 'A bot with this name already exists.', 'TRADING_BOT_EXISTS');
    }
    throw error;
  }
}

async function validateDependencies(userId: string, data: FactoryCreateData) {
  const [strategyVersion, account, riskProfile, generation] = await Promise.all([
    prisma.strategyVersion.findFirst({
      where: { id: data.strategyVersionId, strategy: { createdById: userId } },
      select: { id: true, parameterSchema: true, supportedTimeframes: true },
    }),
    prisma.exchangeAccount.findFirst({
      where: { id: data.exchangeAccountId, userId },
      select: { id: true, environment: true, isActive: true },
    }),
    prisma.tradingRiskProfile.findFirst({
      where: { id: data.riskProfileId, userId, exchangeAccountId: data.exchangeAccountId },
      select: { id: true, enabled: true, accountKillSwitch: true },
    }),
    data.generationId
      ? prisma.generation.findFirst({ where: { id: data.generationId, createdById: userId }, select: { id: true } })
      : Promise.resolve(null),
  ]);
  if (!strategyVersion) throw new ApiError(404, 'Strategy version not found.', 'STRATEGY_VERSION_NOT_FOUND');
  if (!account) throw new ApiError(404, 'Exchange account not found.', 'EXCHANGE_ACCOUNT_NOT_FOUND');
  if (!account.isActive) throw new ApiError(409, 'Exchange account is disabled.', 'BOT_ACCOUNT_DISABLED');
  if (account.environment !== 'TESTNET' && account.environment !== 'DEMO') {
    throw new ApiError(403, 'Bot Factory can only bind testnet/demo accounts.', 'LIVE_BOT_FORBIDDEN');
  }
  if (!riskProfile) throw new ApiError(404, 'Matching risk profile not found.', 'RISK_PROFILE_NOT_FOUND');
  if (!riskProfile.enabled || riskProfile.accountKillSwitch) {
    throw new ApiError(409, 'Risk profile does not permit bot creation.', 'BOT_RISK_PROFILE_BLOCKED');
  }
  if (data.generationId && !generation) throw new ApiError(404, 'Generation not found.', 'GENERATION_NOT_FOUND');
  return { strategyVersion, account, riskProfile, generation };
}

async function ownedFactoryBot(userId: string, id: string) {
  const bot = await prisma.tradingBot.findFirst({
    where: { id, userId, type: 'AUTONOMOUS' },
    select: { ...botFactorySelect, symbol: true, intervalSeconds: true },
  });
  if (!bot) throw new ApiError(404, 'Factory bot not found.', 'FACTORY_BOT_NOT_FOUND');
  if (!bot.strategyVersionId || !bot.riskProfileId) {
    throw new ApiError(409, 'Factory bot dependencies are incomplete.', 'FACTORY_BOT_INVALID');
  }
  return bot;
}

function assertSupportedTimeframe(value: Prisma.JsonValue | null, timeframe: string) {
  if (value === null) return;
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new ApiError(500, 'Stored supported timeframes are invalid.', 'STRATEGY_SCHEMA_INVALID');
  }
  if (!value.includes(timeframe)) {
    throw new ApiError(400, 'Timeframe is not supported by this strategy version.', 'STRATEGY_TIMEFRAME_UNSUPPORTED');
  }
}

function jsonObject(value: Prisma.JsonValue, code: string): Record<string, unknown> {
  if (value === null || Array.isArray(value) || typeof value !== 'object') {
    throw new ApiError(409, 'Stored bot parameters are invalid.', code);
  }
  return value as Record<string, unknown>;
}

function jsonStringArray(value: Prisma.JsonValue | null, fallback: string): string[] {
  if (Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string')) return value;
  return [fallback];
}

export function timeframeToSeconds(timeframe: string) {
  const match = /^(\d{1,4})([mhdw])$/.exec(timeframe);
  if (!match) throw new ApiError(400, 'Invalid timeframe.', 'INVALID_TIMEFRAME');
  const multiplier = { m: 60, h: 3600, d: 86400, w: 604800 }[match[2] as 'm' | 'h' | 'd' | 'w'];
  return Number(match[1]) * multiplier;
}

function secondsToTimeframe(seconds: number) {
  if (seconds % 604800 === 0) return `${seconds / 604800}w`;
  if (seconds % 86400 === 0) return `${seconds / 86400}d`;
  if (seconds % 3600 === 0) return `${seconds / 3600}h`;
  return `${Math.max(1, Math.floor(seconds / 60))}m`;
}
