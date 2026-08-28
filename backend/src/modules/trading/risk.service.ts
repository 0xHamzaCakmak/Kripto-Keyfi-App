import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { ownedAccount } from './exchange-account.service.js';
import type { UpdateKillSwitchInput, UpdateRiskProfileInput } from './risk.schema.js';
import { TESTNET_ESTIMATED_ROUND_TRIP_COST_BPS } from '../ai-trading/universe.worker.js';

const riskSelect = {
  id: true, exchangeAccountId: true, enabled: true, accountKillSwitch: true, killSwitchReason: true,
  maxOrderNotional: true, maxInitialMargin: true, maxAccountOpenNotional: true,
  maxOpenPositions: true, paperMaxOpenPositions: true, testnetBotAllocationUsdt: true, testnetMinInitialMarginUsdt: true,
  maxSymbolPositions: true, minLeverage: true, maxLeverage: true, testnetStopLossBps: true, testnetTakeProfitBps: true, minAvailableBalance: true,
  maxOrdersPerMinute: true, maxDailyOrders: true, maxDailyLoss: true,
  maxRiskPerTradePct: true, maxDailyLossPct: true, maxWeeklyLossPct: true, maxDrawdownPct: true,
  maxSymbolOpenNotional: true, minRiskRewardRatio: true, stopLossRequired: true,
  marginModePolicy: true, cooldownSeconds: true, maxConsecutiveLosses: true,
  allowedSymbols: true, blockedSymbols: true, createdAt: true, updatedAt: true,
} satisfies Prisma.TradingRiskProfileSelect;

export async function getRiskProfile(userId: string, exchangeAccountId: string) {
  await ownedAccount(userId, exchangeAccountId);
  const [profile, global, bots] = await Promise.all([
    prisma.tradingRiskProfile.findUnique({ where: { exchangeAccountId }, select: riskSelect }),
    prisma.tradingRiskControl.findUnique({ where: { id: 'global' }, select: { globalKillSwitch: true, reason: true, activatedAt: true } }),
    prisma.tradingBot.findMany({
      where: { userId, exchangeAccountId, type: 'AUTONOMOUS', mode: { in: ['PAPER', 'DEMO'] }, lifecycleStatus: { not: 'ARCHIVED' } },
      select: { configuration: true },
    }),
  ]);
  if (!profile || !global) throw new ApiError(503, 'Risk profili hazır değil.', 'RISK_PROFILE_UNAVAILABLE');
  return { ...serializeProfile(profile), effectiveMaxOpenPositions: effectiveAutonomousPositionLimits(profile.maxOpenPositions, profile.paperMaxOpenPositions),
    entryPaused: bots.length > 0 && bots.every((bot) => configurationFlag(bot.configuration, 'entryPaused')),
    globalKillSwitch: global.globalKillSwitch, globalKillSwitchReason: global.reason, globalKillSwitchActivatedAt: global.activatedAt };
}

export function effectiveAutonomousPositionLimits(configured: number, paperConfigured = 100) {
  const paper = paperConfigured === 0 ? 0 : Math.max(1, Math.min(paperConfigured, 100));
  return { paper, futuresTestnet: configured === 0 ? 0 : Math.max(1, Math.min(configured, 20)), live: configured === 0 ? 0 : Math.max(1, Math.min(configured, 15)) };
}

export async function updateRiskProfile(userId: string, exchangeAccountId: string, input: UpdateRiskProfileInput, ipAddress?: string) {
  await ownedAccount(userId, exchangeAccountId);
  const current = await prisma.tradingRiskProfile.findUnique({ where: { exchangeAccountId }, select: riskSelect });
  if (!current) throw new ApiError(503, 'Risk profili hazır değil.', 'RISK_PROFILE_UNAVAILABLE');
  const maxOpenPositions = input.maxOpenPositions ?? current.maxOpenPositions;
  const maxSymbolPositions = input.maxSymbolPositions ?? current.maxSymbolPositions;
  if (maxOpenPositions > 0 && maxSymbolPositions > 0 && maxSymbolPositions > maxOpenPositions) throw new ApiError(400, 'Parite pozisyon limiti hesap limitini aşamaz.', 'INVALID_RISK_LIMITS');
  const botAllocationInput = input.botAllocationUsdt ?? input.testnetBotAllocationUsdt;
  const minimumMarginInput = input.minInitialMarginUsdt ?? input.testnetMinInitialMarginUsdt;
  const botAllocation = Number(botAllocationInput ?? current.testnetBotAllocationUsdt);
  const minimumInitialMargin = Number(minimumMarginInput ?? current.testnetMinInitialMarginUsdt);
  const minimumLeverage = input.minLeverage ?? current.minLeverage;
  const maximumLeverage = input.maxLeverage ?? current.maxLeverage;
  if (!Number.isFinite(botAllocation) || !Number.isFinite(minimumInitialMargin) || botAllocation <= 0 || minimumInitialMargin <= 0 || minimumInitialMargin > botAllocation) {
    throw new ApiError(400, 'Bot kotası/teminat profili geçersiz.', 'INVALID_BOT_SIZING');
  }
  if (minimumLeverage > maximumLeverage) {
    throw new ApiError(400, 'Asgari kaldıraç azami kaldıracı aşamaz.', 'INVALID_LEVERAGE_RANGE');
  }
  const data: Prisma.TradingRiskProfileUpdateInput = {};
  if (input.enabled !== undefined) data.enabled = input.enabled;
  if (input.maxOrderNotional !== undefined) data.maxOrderNotional = input.maxOrderNotional;
  if (input.maxInitialMargin !== undefined) data.maxInitialMargin = input.maxInitialMargin;
  if (input.maxAccountOpenNotional !== undefined) data.maxAccountOpenNotional = input.maxAccountOpenNotional;
  if (input.maxOpenPositions !== undefined) data.maxOpenPositions = input.maxOpenPositions;
  if (input.paperMaxOpenPositions !== undefined) data.paperMaxOpenPositions = input.paperMaxOpenPositions;
  if (botAllocationInput !== undefined) data.testnetBotAllocationUsdt = botAllocationInput;
  if (minimumMarginInput !== undefined) data.testnetMinInitialMarginUsdt = minimumMarginInput;
  if (input.maxSymbolPositions !== undefined) data.maxSymbolPositions = input.maxSymbolPositions;
  if (input.minLeverage !== undefined) data.minLeverage = input.minLeverage;
  if (input.maxLeverage !== undefined) data.maxLeverage = input.maxLeverage;
  if (input.stopLossBps !== undefined) data.testnetStopLossBps = input.stopLossBps;
  if (input.takeProfitBps !== undefined) data.testnetTakeProfitBps = input.takeProfitBps;
  if (input.minAvailableBalance !== undefined) data.minAvailableBalance = input.minAvailableBalance;
  if (input.maxOrdersPerMinute !== undefined) data.maxOrdersPerMinute = input.maxOrdersPerMinute;
  if (input.maxDailyOrders !== undefined) data.maxDailyOrders = input.maxDailyOrders;
  if (input.maxRiskPerTradePct !== undefined) data.maxRiskPerTradePct = input.maxRiskPerTradePct;
  if (input.maxDailyLossPct !== undefined) data.maxDailyLossPct = input.maxDailyLossPct;
  if (input.maxWeeklyLossPct !== undefined) data.maxWeeklyLossPct = input.maxWeeklyLossPct;
  if (input.maxDrawdownPct !== undefined) data.maxDrawdownPct = input.maxDrawdownPct;
  if (input.maxSymbolOpenNotional !== undefined) data.maxSymbolOpenNotional = input.maxSymbolOpenNotional;
  if (input.minRiskRewardRatio !== undefined) data.minRiskRewardRatio = input.minRiskRewardRatio;
  if (input.stopLossRequired !== undefined) data.stopLossRequired = input.stopLossRequired;
  if (input.marginModePolicy !== undefined) data.marginModePolicy = input.marginModePolicy;
  if (input.cooldownSeconds !== undefined) data.cooldownSeconds = input.cooldownSeconds;
  if (input.maxConsecutiveLosses !== undefined) data.maxConsecutiveLosses = input.maxConsecutiveLosses;
  if (input.allowedSymbols !== undefined) data.allowedSymbols = input.allowedSymbols === null ? Prisma.DbNull : input.allowedSymbols;
  if (input.blockedSymbols !== undefined) data.blockedSymbols = input.blockedSymbols === null ? Prisma.DbNull : input.blockedSymbols;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.tradingRiskProfile.update({
      where: { exchangeAccountId },
      data,
      select: riskSelect,
    });
    if (botAllocationInput !== undefined || minimumMarginInput !== undefined || input.minLeverage !== undefined || input.maxLeverage !== undefined
      || input.stopLossBps !== undefined || input.takeProfitBps !== undefined || input.entryPaused !== undefined) {
      const bots = await tx.tradingBot.findMany({
        where: { userId, exchangeAccountId, type: 'AUTONOMOUS', mode: { in: ['PAPER', 'DEMO'] }, lifecycleStatus: { not: 'ARCHIVED' } },
        select: { id: true, mode: true, configuration: true },
      });
      for (const bot of bots) {
        const source = bot.configuration && !Array.isArray(bot.configuration) && typeof bot.configuration === 'object'
          ? bot.configuration as Prisma.JsonObject : {};
        const configuredLeverage = Number(source.leverage);
        const leverage = Math.max(minimumLeverage, Math.min(maximumLeverage, Number.isFinite(configuredLeverage) ? Math.round(configuredLeverage) : minimumLeverage));
        const testnetProtection = bot.mode === 'DEMO' ? {
          stopLossBps: input.stopLossBps ?? current.testnetStopLossBps,
          takeProfitBps: input.takeProfitBps ?? current.testnetTakeProfitBps,
          estimatedRoundTripCostBps: TESTNET_ESTIMATED_ROUND_TRIP_COST_BPS,
          fixedTestnetProtectionTargets: true,
        } : {};
        const executionControl = input.entryPaused === undefined ? {} : { entryPaused: input.entryPaused };
        await tx.tradingBot.update({ where: { id: bot.id }, data: {
          configuration: { ...source, allocationUsdt: botAllocation, minimumInitialMarginUsdt: minimumInitialMargin, leverage, leverageMin: minimumLeverage, leverageMax: maximumLeverage, testnetMarginAllocationMode: true, ...testnetProtection, ...executionControl },
          startingPaperBalance: botAllocation,
          version: { increment: 1 },
        } });
      }
    }
    await tx.tradingAuditLog.create({ data: {
      userId, exchangeAccountId, action: 'RISK_PROFILE_UPDATED', entityType: 'TRADING_RISK_PROFILE', entityId: updated.id,
      metadata: { changedFields: Object.keys(input) }, ...(ipAddress ? { ipAddress } : {}),
    } });
    return { ...serializeProfile(updated), ...(input.entryPaused === undefined ? {} : { entryPaused: input.entryPaused }) };
  });
}

function configurationFlag(value: Prisma.JsonValue, key: string) {
  return Boolean(value && !Array.isArray(value) && typeof value === 'object' && (value as Prisma.JsonObject)[key] === true);
}

export async function updateKillSwitch(userId: string, input: UpdateKillSwitchInput, ipAddress?: string) {
  if (input.scope === 'ACCOUNT') await ownedAccount(userId, input.exchangeAccountId!);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    if (input.scope === 'GLOBAL') {
      const control = await tx.tradingRiskControl.update({ where: { id: 'global' }, data: {
        globalKillSwitch: input.active, reason: input.reason, activatedBy: userId, activatedAt: input.active ? now : null,
      } });
      await tx.tradingAuditLog.create({ data: {
        userId, action: input.active ? 'GLOBAL_KILL_SWITCH_ACTIVATED' : 'GLOBAL_KILL_SWITCH_RELEASED',
        entityType: 'TRADING_RISK_CONTROL', entityId: 'global', metadata: { reason: input.reason }, ...(ipAddress ? { ipAddress } : {}),
      } });
      const accounts = await tx.exchangeAccount.findMany({ where: { isActive: true }, select: { id: true, userId: true, provider: true } });
      for (const account of accounts) {
        await tx.tradingOutboxEvent.create({ data: {
          userId: account.userId, exchangeAccountId: account.id, provider: account.provider,
          topic: 'trading.risk', eventType: input.active ? 'GLOBAL_KILL_SWITCH_ACTIVATED' : 'GLOBAL_KILL_SWITCH_RELEASED',
          aggregateType: 'SYSTEM', aggregateId: 'global', deduplicationKey: `node:risk:global:${randomUUID()}`,
          payload: { active: input.active, reason: input.reason }, occurredAt: now,
        } });
      }
      return { scope: input.scope, active: control.globalKillSwitch, reason: control.reason, activatedAt: control.activatedAt };
    }

    const exchangeAccountId = input.exchangeAccountId!;
    const profile = await tx.tradingRiskProfile.update({ where: { exchangeAccountId }, data: {
      accountKillSwitch: input.active, killSwitchReason: input.reason,
    } });
    await tx.tradingAuditLog.create({ data: {
      userId, exchangeAccountId, action: input.active ? 'ACCOUNT_KILL_SWITCH_ACTIVATED' : 'ACCOUNT_KILL_SWITCH_RELEASED',
      entityType: 'TRADING_RISK_PROFILE', entityId: profile.id, metadata: { reason: input.reason }, ...(ipAddress ? { ipAddress } : {}),
    } });
    const account = await tx.exchangeAccount.findUniqueOrThrow({ where: { id: exchangeAccountId }, select: { provider: true } });
    await tx.tradingOutboxEvent.create({ data: {
      userId, exchangeAccountId, provider: account.provider,
      topic: 'trading.risk', eventType: input.active ? 'ACCOUNT_KILL_SWITCH_ACTIVATED' : 'ACCOUNT_KILL_SWITCH_RELEASED',
      aggregateType: 'ACCOUNT', aggregateId: exchangeAccountId, deduplicationKey: `node:risk:account:${randomUUID()}`,
      payload: { active: input.active, reason: input.reason }, occurredAt: now,
    } });
    return { scope: input.scope, exchangeAccountId, active: profile.accountKillSwitch, reason: profile.killSwitchReason };
  });
}

export async function listRiskEvents(userId: string, exchangeAccountId: string) {
  await ownedAccount(userId, exchangeAccountId);
  const events = await prisma.tradingRiskEvent.findMany({
    where: { userId, exchangeAccountId }, orderBy: { id: 'desc' }, take: 100,
    select: { id: true, tradingOrderId: true, source: true, decision: true, code: true, message: true, metrics: true, occurredAt: true },
  });
  return events.map((event) => ({ ...event, id: event.id.toString() }));
}

function serializeProfile<T extends { maxOrderNotional: Prisma.Decimal; maxInitialMargin: Prisma.Decimal; maxAccountOpenNotional: Prisma.Decimal; testnetBotAllocationUsdt: Prisma.Decimal; testnetMinInitialMarginUsdt: Prisma.Decimal; minAvailableBalance: Prisma.Decimal; maxDailyLoss: Prisma.Decimal | null; maxRiskPerTradePct: Prisma.Decimal; maxDailyLossPct: Prisma.Decimal; maxWeeklyLossPct: Prisma.Decimal; maxDrawdownPct: Prisma.Decimal; maxSymbolOpenNotional: Prisma.Decimal; minRiskRewardRatio: Prisma.Decimal }>(profile: T) {
  return { ...profile,
    ...('testnetStopLossBps' in profile ? { stopLossBps: profile.testnetStopLossBps } : {}),
    ...('testnetTakeProfitBps' in profile ? { takeProfitBps: profile.testnetTakeProfitBps } : {}),
    maxOrderNotional: profile.maxOrderNotional.toString(), maxInitialMargin: profile.maxInitialMargin.toString(),
    maxAccountOpenNotional: profile.maxAccountOpenNotional.toString(), testnetBotAllocationUsdt: profile.testnetBotAllocationUsdt.toString(),
    testnetMinInitialMarginUsdt: profile.testnetMinInitialMarginUsdt.toString(), botAllocationUsdt: profile.testnetBotAllocationUsdt.toString(),
    minInitialMarginUsdt: profile.testnetMinInitialMarginUsdt.toString(), minAvailableBalance: profile.minAvailableBalance.toString(),
    maxDailyLoss: profile.maxDailyLoss?.toString() ?? null,
    maxRiskPerTradePct: profile.maxRiskPerTradePct.toString(), maxDailyLossPct: profile.maxDailyLossPct.toString(),
    maxWeeklyLossPct: profile.maxWeeklyLossPct.toString(), maxDrawdownPct: profile.maxDrawdownPct.toString(),
    maxSymbolOpenNotional: profile.maxSymbolOpenNotional.toString(), minRiskRewardRatio: profile.minRiskRewardRatio.toString() };
}
