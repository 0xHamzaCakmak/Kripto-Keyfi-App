import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { getTradingEngineSnapshot } from '../trading/trading-engine.client.js';
import type { ManualBotCampaignCreateInput, ManualBotCampaignPreviewInput } from './autonomous-admin.schema.js';

function jsonObject(value: Prisma.JsonValue): Record<string, unknown> {
  return value !== null && !Array.isArray(value) && typeof value === 'object' ? value as Record<string, unknown> : {};
}

async function campaignContext(userId: string, exchangeAccountId: string) {
  const account = await prisma.exchangeAccount.findFirst({
    where: { id: exchangeAccountId, userId, provider: 'BINANCE', environment: 'TESTNET', accountType: 'USDT_M', isActive: true, canTrade: true, executionEngine: 'GO' },
    select: { id: true, name: true, userId: true, provider: true, environment: true, accountType: true },
  });
  if (!account) throw new ApiError(409, 'Toplu bot işlemi için bağlı, işlem yetkili ve Go execution kullanan Binance TESTNET hesabı gereklidir.', 'MANUAL_BOT_ACCOUNT_NOT_READY');
  const [bots, snapshot, profile] = await Promise.all([
    prisma.tradingBot.findMany({
      where: { userId, exchangeAccountId, type: 'AUTONOMOUS', mode: 'DEMO', lifecycleStatus: 'PAPER' },
      orderBy: [{ symbol: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, symbol: true, state: true, desiredState: true, configuration: true },
    }),
    getTradingEngineSnapshot(account),
    prisma.tradingRiskProfile.findUnique({ where: { exchangeAccountId }, select: {
      enabled: true, accountKillSwitch: true, minLeverage: true, maxLeverage: true, maxOrderNotional: true,
      maxInitialMargin: true, minAvailableBalance: true,
    } }),
  ]);
  if (!profile?.enabled || profile.accountKillSwitch) throw new ApiError(409, 'Risk profili kapalı veya hesap kill switch etkin.', 'MANUAL_BOT_RISK_GATE_CLOSED');
  const positionBySymbol = new Map(snapshot.positions
    .filter((position) => new Prisma.Decimal(position.quantity).abs().gt(0))
    .map((position) => [position.symbol, position]));
  const positionByBot = new Map(bots.map((bot) => [bot.id, positionBySymbol.get(bot.symbol) ?? null]));
  const availableBalance = snapshot.balances
    .filter((balance) => balance.walletType === 'USD_M_FUTURES' && (balance.asset === 'USDT' || balance.asset === 'USDC'))
    .reduce((sum, balance) => sum.add(new Prisma.Decimal(balance.availableBalance ?? 0).mul(balance.priceUsdt || 1)), new Prisma.Decimal(0));
  return {
    account: { id: account.id, name: account.name }, bots,
    accountSummary: { availableBalance: availableBalance.toString() }, profile, positionByBot,
  };
}

export async function listManualBotCampaignCandidates(userId: string, exchangeAccountId: string) {
  const context = await campaignContext(userId, exchangeAccountId);
  return {
    account: context.account,
    availableBalance: context.accountSummary.availableBalance,
    bots: context.bots.map((bot) => {
      const configuration = jsonObject(bot.configuration);
      const position = context.positionByBot.get(bot.id) ?? null;
      const pendingInstruction = jsonObject(configuration.manualBotEntry as Prisma.JsonValue).id;
      const ready = bot.state === 'RUNNING' && bot.desiredState === 'RUNNING' && configuration.entryPaused !== true && !position && !pendingInstruction;
      return {
        id: bot.id, name: bot.name, symbol: bot.symbol, state: bot.state, desiredState: bot.desiredState,
        position: position ? { side: position.side, quantity: position.quantity, unrealizedPnl: position.unrealizedPnl } : null,
        ready,
        blocker: ready ? null : position ? 'EXISTING_POSITION' : pendingInstruction ? 'INSTRUCTION_PENDING' : configuration.entryPaused === true ? 'ENTRY_PAUSED' : 'BOT_NOT_RUNNING',
      };
    }),
  };
}

export async function previewManualBotCampaign(userId: string, input: ManualBotCampaignPreviewInput) {
  const context = await campaignContext(userId, input.exchangeAccountId);
  const requested = new Set(input.botIds);
  const selected = context.bots.filter((bot) => requested.has(bot.id));
  if (selected.length !== requested.size) throw new ApiError(404, 'Seçilen botlardan biri bu TESTNET hesabında bulunamadı.', 'MANUAL_BOT_NOT_FOUND');
  if (input.leverage < context.profile.minLeverage || input.leverage > context.profile.maxLeverage) {
    throw new ApiError(409, `Kaldıraç ${context.profile.minLeverage}x-${context.profile.maxLeverage}x aralığında olmalıdır.`, 'MANUAL_BOT_LEVERAGE_REJECTED');
  }
  const initialMargin = new Prisma.Decimal(input.initialMarginUsdt);
  const notional = initialMargin.mul(input.leverage);
  if (context.profile.maxInitialMargin.gt(0) && initialMargin.gt(context.profile.maxInitialMargin)) {
    throw new ApiError(409, 'Bot başına teminat risk profilindeki emir başına azami teminatı aşıyor.', 'RISK_MAX_INITIAL_MARGIN_EXCEEDED');
  }
  if (context.profile.maxOrderNotional.gt(0) && notional.gt(context.profile.maxOrderNotional)) {
    throw new ApiError(409, 'Bot başına notional risk profilindeki emir başına azami notional değeri aşıyor.', 'RISK_MAX_ORDER_NOTIONAL_EXCEEDED');
  }
  const items = selected.map((bot) => {
    const configuration = jsonObject(bot.configuration);
    const position = context.positionByBot.get(bot.id) ?? null;
    const pendingInstruction = jsonObject(configuration.manualBotEntry as Prisma.JsonValue).id;
    const status = position ? 'SKIPPED_EXISTING_POSITION' : pendingInstruction ? 'SKIPPED_PENDING_INSTRUCTION'
      : configuration.entryPaused === true ? 'SKIPPED_ENTRY_PAUSED'
        : bot.state !== 'RUNNING' || bot.desiredState !== 'RUNNING' ? 'SKIPPED_NOT_RUNNING' : 'QUEUED';
    return { botId: bot.id, name: bot.name, symbol: bot.symbol, status };
  });
  const queued = items.filter((item) => item.status === 'QUEUED').length;
  const totalInitialMargin = initialMargin.mul(queued);
  const totalNotional = notional.mul(queued);
  const availableAfterReserve = Prisma.Decimal.max(new Prisma.Decimal(0), new Prisma.Decimal(context.accountSummary.availableBalance).sub(context.profile.minAvailableBalance));
  const affordable = totalInitialMargin.lte(availableAfterReserve);
  return {
    account: context.account,
    side: input.side,
    leverage: input.leverage,
    stopLossPercent: input.stopLossPercent,
    takeProfitPercent: input.takeProfitPercent,
    perBotInitialMargin: initialMargin.toString(),
    perBotNotional: notional.toString(),
    selectedBots: selected.length,
    queuedBots: queued,
    skippedBots: selected.length - queued,
    totalInitialMargin: totalInitialMargin.toString(),
    totalNotional: totalNotional.toString(),
    availableBalance: context.accountSummary.availableBalance,
    protectedBalance: context.profile.minAvailableBalance.toString(),
    availableAfterReserve: availableAfterReserve.toString(),
    affordable,
    items,
  };
}

export async function createManualBotCampaign(userId: string, input: ManualBotCampaignCreateInput, ipAddress?: string) {
  const preview = await previewManualBotCampaign(userId, input);
  if (preview.queuedBots === 0) throw new ApiError(409, 'Emir gönderilebilecek boşta ve çalışan bot bulunamadı.', 'MANUAL_BOT_NO_ELIGIBLE_BOTS');
  if (!preview.affordable) throw new ApiError(409, 'Korunacak bakiye düşüldükten sonra toplu kampanya için yeterli kullanılabilir bakiye yok.', 'INSUFFICIENT_BALANCE');
  const campaignId = randomUUID();
  const now = new Date();
  const stopLossBps = new Prisma.Decimal(input.stopLossPercent).mul(100);
  const takeProfitBps = new Prisma.Decimal(input.takeProfitPercent).mul(100);
  const itemByBot = new Map(preview.items.map((item) => [item.botId, { ...item, id: randomUUID() }]));
  await prisma.$transaction(async (tx) => {
    await tx.manualBotCampaign.create({ data: {
      id: campaignId, userId, exchangeAccountId: input.exchangeAccountId, side: input.side,
      initialMarginUsdt: new Prisma.Decimal(input.initialMarginUsdt), leverage: input.leverage,
      stopLossBps, takeProfitBps, existingPositionRule: input.existingPositionRule, status: 'QUEUED',
    } });
    await tx.manualBotCampaignItem.createMany({ data: preview.items.map((item) => ({
      id: itemByBot.get(item.botId)!.id, campaignId, tradingBotId: item.botId, symbol: item.symbol,
      status: item.status, reasonCode: item.status === 'QUEUED' ? null : item.status,
      detail: item.status === 'QUEUED' ? 'Scheduler execution kuyruğuna alındı.' : 'Mevcut durum nedeniyle güvenli biçimde atlandı.',
    })) });
    for (const item of preview.items.filter((row) => row.status === 'QUEUED')) {
      const campaignItem = itemByBot.get(item.botId)!;
      const instruction = JSON.stringify({
        id: campaignItem.id, campaignId, side: input.side, initialMarginUsdt: input.initialMarginUsdt,
        leverage: input.leverage, stopLossBps: stopLossBps.toNumber(), takeProfitBps: takeProfitBps.toNumber(),
        existingPositionRule: input.existingPositionRule, requestedAt: now.toISOString(),
      });
      await tx.$executeRaw(Prisma.sql`UPDATE trading_bots
        SET configuration = JSON_SET(COALESCE(configuration, JSON_OBJECT()), '$.manualBotEntry', CAST(${instruction} AS JSON)),
            lastDecisionAt = NULL, version = version + 1
        WHERE id = ${item.botId} AND userId = ${userId} AND exchangeAccountId = ${input.exchangeAccountId}`);
    }
    await tx.tradingAuditLog.create({ data: {
      userId, exchangeAccountId: input.exchangeAccountId, action: 'MANUAL_BOT_CAMPAIGN_QUEUED', entityType: 'MANUAL_BOT_CAMPAIGN', entityId: campaignId,
      metadata: { side: input.side, leverage: input.leverage, initialMarginUsdt: input.initialMarginUsdt, stopLossPercent: input.stopLossPercent,
        takeProfitPercent: input.takeProfitPercent, selectedBots: preview.selectedBots, queuedBots: preview.queuedBots, skippedBots: preview.skippedBots,
        confirmation: input.confirmation, productionLive: false },
      ...(ipAddress ? { ipAddress } : {}),
    } });
  });
  return getManualBotCampaign(userId, campaignId);
}

export async function getManualBotCampaign(userId: string, campaignId: string) {
  const campaign = await prisma.manualBotCampaign.findFirst({
    where: { id: campaignId, userId },
    include: { items: { orderBy: [{ symbol: 'asc' }, { id: 'asc' }], include: { tradingBot: { select: { name: true } } } } },
  });
  if (!campaign) throw new ApiError(404, 'Toplu bot kampanyası bulunamadı.', 'MANUAL_BOT_CAMPAIGN_NOT_FOUND');
  return {
    id: campaign.id, exchangeAccountId: campaign.exchangeAccountId, side: campaign.side,
    initialMarginUsdt: campaign.initialMarginUsdt.toString(), leverage: campaign.leverage,
    stopLossPercent: campaign.stopLossBps.div(100).toNumber(), takeProfitPercent: campaign.takeProfitBps.div(100).toNumber(),
    status: campaign.status, createdAt: campaign.createdAt, updatedAt: campaign.updatedAt,
    items: campaign.items.map((item) => ({
      id: item.id, botId: item.tradingBotId, name: item.tradingBot.name, symbol: item.symbol, status: item.status,
      reasonCode: item.reasonCode, detail: item.detail, decisionId: item.decisionId?.toString() ?? null,
      attemptedAt: item.attemptedAt, executedAt: item.executedAt,
    })),
  };
}
