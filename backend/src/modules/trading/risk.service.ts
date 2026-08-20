import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { ownedAccount } from './exchange-account.service.js';
import type { UpdateKillSwitchInput, UpdateRiskProfileInput } from './risk.schema.js';

const riskSelect = {
  id: true, exchangeAccountId: true, enabled: true, accountKillSwitch: true, killSwitchReason: true,
  maxOrderNotional: true, maxInitialMargin: true, maxAccountOpenNotional: true,
  maxOpenPositions: true, maxSymbolPositions: true, maxLeverage: true, minAvailableBalance: true,
  maxOrdersPerMinute: true, maxDailyOrders: true, maxDailyLoss: true,
  maxRiskPerTradePct: true, maxDailyLossPct: true, maxWeeklyLossPct: true, maxDrawdownPct: true,
  maxSymbolOpenNotional: true, minRiskRewardRatio: true, stopLossRequired: true,
  marginModePolicy: true, cooldownSeconds: true, maxConsecutiveLosses: true,
  allowedSymbols: true, blockedSymbols: true, createdAt: true, updatedAt: true,
} satisfies Prisma.TradingRiskProfileSelect;

export async function getRiskProfile(userId: string, exchangeAccountId: string) {
  await ownedAccount(userId, exchangeAccountId);
  const [profile, global] = await Promise.all([
    prisma.tradingRiskProfile.findUnique({ where: { exchangeAccountId }, select: riskSelect }),
    prisma.tradingRiskControl.findUnique({ where: { id: 'global' }, select: { globalKillSwitch: true, reason: true, activatedAt: true } }),
  ]);
  if (!profile || !global) throw new ApiError(503, 'Risk profili hazır değil.', 'RISK_PROFILE_UNAVAILABLE');
  return { ...serializeProfile(profile), globalKillSwitch: global.globalKillSwitch, globalKillSwitchReason: global.reason, globalKillSwitchActivatedAt: global.activatedAt };
}

export async function updateRiskProfile(userId: string, exchangeAccountId: string, input: UpdateRiskProfileInput, ipAddress?: string) {
  await ownedAccount(userId, exchangeAccountId);
  const current = await prisma.tradingRiskProfile.findUnique({ where: { exchangeAccountId }, select: riskSelect });
  if (!current) throw new ApiError(503, 'Risk profili hazır değil.', 'RISK_PROFILE_UNAVAILABLE');
  const maxOpenPositions = input.maxOpenPositions ?? current.maxOpenPositions;
  const maxSymbolPositions = input.maxSymbolPositions ?? current.maxSymbolPositions;
  if (maxSymbolPositions > maxOpenPositions) throw new ApiError(400, 'Parite pozisyon limiti hesap limitini aşamaz.', 'INVALID_RISK_LIMITS');
  const data: Prisma.TradingRiskProfileUpdateInput = {};
  if (input.enabled !== undefined) data.enabled = input.enabled;
  if (input.maxOrderNotional !== undefined) data.maxOrderNotional = input.maxOrderNotional;
  if (input.maxInitialMargin !== undefined) data.maxInitialMargin = input.maxInitialMargin;
  if (input.maxAccountOpenNotional !== undefined) data.maxAccountOpenNotional = input.maxAccountOpenNotional;
  if (input.maxOpenPositions !== undefined) data.maxOpenPositions = input.maxOpenPositions;
  if (input.maxSymbolPositions !== undefined) data.maxSymbolPositions = input.maxSymbolPositions;
  if (input.maxLeverage !== undefined) data.maxLeverage = input.maxLeverage;
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
    await tx.tradingAuditLog.create({ data: {
      userId, exchangeAccountId, action: 'RISK_PROFILE_UPDATED', entityType: 'TRADING_RISK_PROFILE', entityId: updated.id,
      metadata: { changedFields: Object.keys(input) }, ...(ipAddress ? { ipAddress } : {}),
    } });
    return serializeProfile(updated);
  });
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

function serializeProfile<T extends { maxOrderNotional: Prisma.Decimal; maxInitialMargin: Prisma.Decimal; maxAccountOpenNotional: Prisma.Decimal; minAvailableBalance: Prisma.Decimal; maxDailyLoss: Prisma.Decimal | null; maxRiskPerTradePct: Prisma.Decimal; maxDailyLossPct: Prisma.Decimal; maxWeeklyLossPct: Prisma.Decimal; maxDrawdownPct: Prisma.Decimal; maxSymbolOpenNotional: Prisma.Decimal; minRiskRewardRatio: Prisma.Decimal }>(profile: T) {
  return { ...profile, maxOrderNotional: profile.maxOrderNotional.toString(), maxInitialMargin: profile.maxInitialMargin.toString(),
    maxAccountOpenNotional: profile.maxAccountOpenNotional.toString(), minAvailableBalance: profile.minAvailableBalance.toString(),
    maxDailyLoss: profile.maxDailyLoss?.toString() ?? null,
    maxRiskPerTradePct: profile.maxRiskPerTradePct.toString(), maxDailyLossPct: profile.maxDailyLossPct.toString(),
    maxWeeklyLossPct: profile.maxWeeklyLossPct.toString(), maxDrawdownPct: profile.maxDrawdownPct.toString(),
    maxSymbolOpenNotional: profile.maxSymbolOpenNotional.toString(), minRiskRewardRatio: profile.minRiskRewardRatio.toString() };
}
