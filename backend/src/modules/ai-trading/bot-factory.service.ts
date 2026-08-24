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
import { loadCurrentPromotionEvidence } from './champion-selection.service.js';

const botFactorySelect = {
  id: true, name: true, type: true, mode: true, state: true, desiredState: true,
  lifecycleStatus: true, factoryCreationMethod: true, strategyVersionId: true,
  generationId: true, parentBotId: true, riskProfileId: true, exchangeAccountId: true,
  startingPaperBalance: true, symbols: true, timeframe: true, configuration: true,
  stateReason: true, lastErrorCode: true, lastErrorMessage: true, heartbeatAt: true, lastDecisionAt: true,
  createdAt: true, updatedAt: true, version: true,
  strategyVersion: { select: { version: true, strategy: { select: { id: true, name: true, family: true } } } },
  paperPosition: { select: {
    tradingBotId: true, symbol: true, netQuantity: true, avgEntryPrice: true, realizedPnl: true,
    unrealizedPnl: true, totalFees: true, lastMarkPrice: true, openedAt: true, lastFilledAt: true, updatedAt: true,
  } },
  _count: { select: { paperFills: true, paperTrades: true } },
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
  crossover?: { parentBBotId: string; inheritedFields: Prisma.InputJsonObject; generatedFields: Prisma.InputJsonObject };
};

export type MutationFactoryInput = {
  name: string;
  parameters: Record<string, unknown>;
  timeframe?: string;
  generationId: string;
  reason: string;
  diff: Prisma.InputJsonObject;
  mode?: 'PAPER' | 'SHADOW';
};

export type CrossoverFactoryInput = {
  name: string; parameters: Record<string, unknown>; generationId: string; parentBBotId: string;
  inheritedFields: Prisma.InputJsonObject; generatedFields: Prisma.InputJsonObject;
};

export function mergeParameterVariant(
  parameters: Record<string, unknown>,
  overrides: Record<string, unknown>,
) {
  return { ...parameters, ...overrides };
}

export async function listFactoryBots(userId: string) {
  const [bots, evidence] = await Promise.all([
    prisma.tradingBot.findMany({
      where: { userId, type: 'AUTONOMOUS' },
      select: botFactorySelect,
      orderBy: { createdAt: 'desc' },
    }),
    loadCurrentPromotionEvidence(userId),
  ]);
  const evidenceByBot = new Map(evidence.map((item) => [item.botId, item]));
  return bots.map((bot) => ({ ...bot, promotionEvidence: evidenceByBot.get(bot.id) ?? null }));
}

export async function getFactoryBot(userId: string, id: string) {
  return ownedFactoryBot(userId, id);
}

export async function getFactoryBotPaperPerformance(userId: string, id: string) {
  await ownedFactoryBot(userId, id);
  const [position, fills, trades, closedAggregate, closedWins, closedLosses] = await Promise.all([
    prisma.tradingBotPaperPosition.findUnique({ where: { tradingBotId: id } }),
    prisma.tradingBotPaperFill.findMany({ where: { tradingBotId: id }, orderBy: { id: 'desc' }, take: 100 }),
    prisma.paperTrade.findMany({ where: { tradingBotId: id }, orderBy: { openedAt: 'desc' }, take: 100 }),
    prisma.paperTrade.aggregate({
      where: { tradingBotId: id, status: { in: ['CLOSED', 'LIQUIDATED'] } },
      _count: { _all: true }, _sum: { realizedPnl: true, fees: true },
    }),
    prisma.paperTrade.count({ where: { tradingBotId: id, status: { in: ['CLOSED', 'LIQUIDATED'] }, realizedPnl: { gt: 0 } } }),
    prisma.paperTrade.count({ where: { tradingBotId: id, status: { in: ['CLOSED', 'LIQUIDATED'] }, realizedPnl: { lt: 0 } } }),
  ]);
  return {
    position: position ? {
      ...position,
      netQuantity: position.netQuantity.toString(), avgEntryPrice: position.avgEntryPrice.toString(),
      realizedPnl: position.realizedPnl.toString(), unrealizedPnl: position.unrealizedPnl.toString(),
      totalFees: position.totalFees.toString(), lastMarkPrice: position.lastMarkPrice.toString(),
      netPnl: position.realizedPnl.sub(position.totalFees).add(position.unrealizedPnl).toString(),
    } : null,
    fills: fills.map((fill) => ({
      ...fill, id: fill.id.toString(), decisionId: fill.decisionId.toString(), quantity: fill.quantity.toString(),
      markPrice: fill.markPrice.toString(), fillPrice: fill.fillPrice.toString(), notional: fill.notional.toString(),
      fee: fill.fee.toString(), realizedPnl: fill.realizedPnl.toString(), slippageBps: fill.slippageBps.toString(), feeBps: fill.feeBps.toString(),
    })),
    trades: trades.map((trade) => {
      const isOpen = trade.status === 'OPEN';
      const markPrice = isOpen && position?.symbol === trade.symbol
        ? position.lastMarkPrice
        : trade.exitPrice ?? trade.entryPrice;
      const priceMove = trade.side === 'BUY'
        ? markPrice.sub(trade.entryPrice)
        : trade.entryPrice.sub(markPrice);
      const unrealizedPnl = isOpen ? priceMove.mul(trade.quantity) : new Prisma.Decimal(0);
      // CLOSED/LIQUIDATED realizedPnl is already fee-net. OPEN trades may have
      // partial realized value, so include current unrealized and deduct the
      // entry/partial fees accumulated so far.
      const netPnl = isOpen
        ? trade.realizedPnl.add(unrealizedPnl).sub(trade.fees)
        : trade.realizedPnl;
      const leverage = Math.max(1, trade.leverage);
      const notional = trade.entryPrice.mul(trade.quantity);
      const initialMargin = notional.div(leverage);
      const pnlPct = initialMargin.isZero() ? new Prisma.Decimal(0) : netPnl.div(initialMargin).mul(100);
      return {
        id: trade.id, symbol: trade.symbol, side: trade.side, status: trade.status,
        entryPrice: trade.entryPrice.toString(), exitPrice: trade.exitPrice?.toString() ?? null,
        markPrice: markPrice.toString(), quantity: trade.quantity.toString(), leverage,
        notional: notional.toString(), initialMargin: initialMargin.toString(),
        fees: trade.fees.toString(), realizedPnl: trade.realizedPnl.toString(),
        unrealizedPnl: unrealizedPnl.toString(), netPnl: netPnl.toString(), pnlPct: pnlPct.toString(),
        stopLoss: trade.stopLoss?.toString() ?? null, takeProfit: trade.takeProfit?.toString() ?? null,
        closeReason: trade.closeReason, openedAt: trade.openedAt, closedAt: trade.closedAt,
      };
    }),
    closedSummary: {
      tradeCount: closedAggregate._count._all, wins: closedWins, losses: closedLosses,
      // paper_trades.realizedPnl is persisted net of entry and exit fees.
      netPnl: closedAggregate._sum.realizedPnl?.toString() ?? '0',
      fees: closedAggregate._sum.fees?.toString() ?? '0',
    },
  };
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
    mode: input.mode ?? (parent.mode === 'SHADOW' ? 'SHADOW' : 'PAPER'), riskProfileId: parent.riskProfileId!,
    generationId: input.generationId, parentBotId, creationMethod: 'PARAMETER_VARIANT', lifecycleStatus: 'CANDIDATE',
    mutation: { reason: input.reason, diff: input.diff },
  }, ipAddress);
}

export async function createCrossoverFactoryBot(
  userId: string, parentABotId: string, input: CrossoverFactoryInput, ipAddress?: string,
) {
  const [parentA, parentB] = await Promise.all([ownedFactoryBot(userId, parentABotId), ownedFactoryBot(userId, input.parentBBotId)]);
  if (parentA.id === parentB.id) throw new ApiError(400, 'Crossover parents must be different.', 'CROSSOVER_PARENTS_IDENTICAL');
  if (parentA.exchangeAccountId !== parentB.exchangeAccountId || parentA.riskProfileId !== parentB.riskProfileId) {
    throw new ApiError(409, 'Crossover parents must share account and risk profile.', 'CROSSOVER_EXECUTION_CONTEXT_MISMATCH');
  }
  return persistFactoryBot(userId, {
    name: input.name, strategyVersionId: parentA.strategyVersionId!, exchangeAccountId: parentA.exchangeAccountId,
    parameters: input.parameters, startingPaperBalance: parentA.startingPaperBalance.toString(),
    symbols: jsonStringArray(parentA.symbols, parentA.symbol),
    timeframe: parentA.timeframe ?? secondsToTimeframe(parentA.intervalSeconds), mode: 'PAPER', riskProfileId: parentA.riskProfileId!,
    generationId: input.generationId, parentBotId: parentABotId, creationMethod: 'CROSSOVER', lifecycleStatus: 'CANDIDATE',
    crossover: { parentBBotId: input.parentBBotId, inheritedFields: input.inheritedFields, generatedFields: input.generatedFields },
  }, ipAddress);
}

export async function transitionFactoryBot(
  userId: string,
  id: string,
  target: AutonomousTradingStatus,
  ipAddress?: string,
) {
  const bot = await ownedFactoryBot(userId, id);
  if (target === 'LIVE_ELIGIBLE') {
    throw new ApiError(403, 'LIVE_ELIGIBLE requires the evidence gate.', 'LIVE_ELIGIBILITY_GATE_REQUIRED');
  }
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
      if (data.crossover && data.generationId && data.parentBotId) {
        await tx.botCrossover.create({ data: {
          parentABotId: data.parentBotId, parentBBotId: data.crossover.parentBBotId, childBotId: bot.id,
          generationId: data.generationId, inheritedFields: data.crossover.inheritedFields, generatedFields: data.crossover.generatedFields,
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
          crossover: data.crossover ?? null,
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
