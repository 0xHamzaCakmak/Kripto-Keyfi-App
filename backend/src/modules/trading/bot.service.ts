import { randomUUID } from 'node:crypto';
import { Prisma, type TradingBotState } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { ownedAccount } from './exchange-account.service.js';
import type { CreateBotInput } from './bot.schema.js';

const botSelect = {
  id: true, exchangeAccountId: true, name: true, type: true, mode: true, state: true, desiredState: true,
  symbol: true, intervalSeconds: true, configuration: true, stateReason: true, lastErrorCode: true,
  lastErrorMessage: true, heartbeatAt: true, lastDecisionAt: true, startedAt: true, stoppedAt: true,
  createdAt: true, updatedAt: true,
  exchangeAccount: { select: { name: true, provider: true, environment: true, connectionStatus: true, isActive: true } },
} satisfies Prisma.TradingBotSelect;

type BotAction = 'VALIDATE' | 'START' | 'PAUSE' | 'RESUME' | 'STOP' | 'EMERGENCY_STOP';

const allowedActions: Record<BotAction, readonly TradingBotState[]> = {
  VALIDATE: ['DRAFT', 'STOPPED', 'RISK_BLOCKED', 'ERROR'],
  START: ['STOPPED'],
  PAUSE: ['STARTING', 'RUNNING', 'RECONCILING', 'RISK_BLOCKED'],
  RESUME: ['PAUSED'],
  STOP: ['VALIDATING', 'STARTING', 'RUNNING', 'PAUSED', 'RISK_BLOCKED', 'RECONCILING', 'ERROR'],
  EMERGENCY_STOP: ['VALIDATING', 'STARTING', 'RUNNING', 'PAUSED', 'STOPPED', 'RISK_BLOCKED', 'RECONCILING', 'ERROR'],
};

export async function listBots(userId: string) {
  return prisma.tradingBot.findMany({
    where: { userId, type: { in: ['SCALPING', 'GRID'] } },
    select: botSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export async function listBotDecisions(userId: string, botId: string) {
  await ownedBot(userId, botId);
  const decisions = await prisma.tradingBotDecision.findMany({
    where: { tradingBotId: botId, userId }, orderBy: { id: 'desc' }, take: 50,
    select: { id: true, type: true, mode: true, symbol: true, kind: true, summary: true, markPrice: true,
      referencePrice: true, hypotheticalOrder: true, metrics: true, occurredAt: true },
  });
  return decisions.map((item) => ({ ...item, id: item.id.toString(), markPrice: item.markPrice.toString(), referencePrice: item.referencePrice?.toString() ?? null }));
}

type BotSignalRow = {
  id: string; decisionId: string | null; source: 'RULE_ENGINE' | 'AI_MODEL'; action: 'HOLD' | 'BUY' | 'SELL';
  status: 'OBSERVED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'; confidence: string; rationale: string;
  modelProvider: string | null; modelName: string | null; promptVersion: string | null;
  features: Prisma.JsonValue | null; safetyChecks: Prisma.JsonValue; expiresAt: Date | null; decidedAt: Date | null; createdAt: Date;
};

export async function listBotSignals(userId: string, botId: string) {
  await ownedBot(userId, botId);
  return prisma.$queryRaw<BotSignalRow[]>(Prisma.sql`
    SELECT CAST(id AS CHAR) AS id, CAST(decisionId AS CHAR) AS decisionId, source, action, status,
      CAST(confidence AS CHAR) AS confidence, rationale, modelProvider, modelName, promptVersion,
      features, safetyChecks, expiresAt, decidedAt, createdAt
    FROM trading_bot_signals
    WHERE tradingBotId = ${botId} AND userId = ${userId}
    ORDER BY id DESC
    LIMIT 50
  `);
}

export async function getPaperPerformance(userId: string, botId: string) {
  await ownedBot(userId, botId);
  const [position, fills] = await Promise.all([
    prisma.tradingBotPaperPosition.findUnique({ where: { tradingBotId: botId } }),
    prisma.tradingBotPaperFill.findMany({ where: { tradingBotId: botId }, orderBy: { id: 'desc' }, take: 50 }),
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
  };
}

export async function createBot(userId: string, input: CreateBotInput, ipAddress?: string) {
  const account = await ownedAccount(userId, input.exchangeAccountId);
  if (!account.isActive) throw new ApiError(409, 'Borsa hesabı devre dışı.', 'BOT_ACCOUNT_DISABLED');
  if (account.environment !== 'TESTNET' && account.environment !== 'DEMO') {
    throw new ApiError(403, 'Botlar yalnızca testnet/demo hesaplarında oluşturulabilir.', 'LIVE_BOT_FORBIDDEN');
  }
  return prisma.$transaction(async (tx) => {
    const bot = await tx.tradingBot.create({ data: {
      userId, exchangeAccountId: input.exchangeAccountId, name: input.name, type: input.type, mode: input.mode,
      symbol: input.symbol, intervalSeconds: input.intervalSeconds,
      configuration: input.configuration as Prisma.InputJsonValue,
    }, select: botSelect });
    await tx.tradingAuditLog.create({ data: {
      userId, exchangeAccountId: input.exchangeAccountId, action: 'TRADING_BOT_CREATED', entityType: 'TRADING_BOT', entityId: bot.id,
      metadata: { type: input.type, mode: input.mode, symbol: input.symbol }, ...(ipAddress ? { ipAddress } : {}),
    } });
    return bot;
  });
}

export async function validateBot(userId: string, botId: string, ipAddress?: string) {
  const bot = await ownedBot(userId, botId);
  assertAction(bot.state, 'VALIDATE');
  const gate = await loadSafetyGate(userId, bot.exchangeAccountId);
  const blocked = gate.code !== null;
  return persistTransition(userId, bot, 'VALIDATE', {
    state: blocked ? 'RISK_BLOCKED' : 'STOPPED', desiredState: 'STOPPED', stateReason: gate.message,
    lastErrorCode: blocked ? gate.code : null, lastErrorMessage: blocked ? gate.message : null,
    schedulerOwner: null, leaseExpiresAt: null,
  }, ipAddress);
}

export async function startBot(userId: string, botId: string, ipAddress?: string) {
  return requestRun(userId, botId, 'START', ipAddress);
}

export async function resumeBot(userId: string, botId: string, ipAddress?: string) {
  return requestRun(userId, botId, 'RESUME', ipAddress);
}

async function requestRun(userId: string, botId: string, action: 'START' | 'RESUME', ipAddress?: string) {
  const bot = await ownedBot(userId, botId);
  assertAction(bot.state, action);
  if (bot.mode === 'DEMO') throw new ApiError(403, 'Demo emir modu shadow kabulü tamamlanmadan kilitlidir.', 'BOT_DEMO_MODE_LOCKED');
  const gate = await loadSafetyGate(userId, bot.exchangeAccountId);
  if (gate.code) throw new ApiError(409, gate.message ?? 'Bot güvenlik kontrolünden geçemedi.', gate.code);
  return persistTransition(userId, bot, action, {
    state: 'STARTING', desiredState: 'RUNNING', stateReason: 'Scheduler lease bekleniyor.',
    lastErrorCode: null, lastErrorMessage: null, schedulerOwner: null, leaseExpiresAt: null, stoppedAt: null,
  }, ipAddress);
}

export async function pauseBot(userId: string, botId: string, ipAddress?: string) {
  const bot = await ownedBot(userId, botId);
  assertAction(bot.state, 'PAUSE');
  return persistTransition(userId, bot, 'PAUSE', {
    state: 'PAUSED', desiredState: 'PAUSED', stateReason: 'Kullanıcı tarafından duraklatıldı.', schedulerOwner: null, leaseExpiresAt: null,
  }, ipAddress);
}

export async function stopBot(userId: string, botId: string, ipAddress?: string) {
  const bot = await ownedBot(userId, botId);
  assertAction(bot.state, 'STOP');
  return persistTransition(userId, bot, 'STOP', {
    state: 'STOPPED', desiredState: 'STOPPED', stateReason: 'Kullanıcı tarafından durduruldu.',
    schedulerOwner: null, leaseExpiresAt: null, stoppedAt: new Date(),
  }, ipAddress);
}

export async function emergencyStopBot(userId: string, botId: string, ipAddress?: string) {
  const bot = await ownedBot(userId, botId);
  assertAction(bot.state, 'EMERGENCY_STOP');
  return persistTransition(userId, bot, 'EMERGENCY_STOP', {
    state: 'EMERGENCY_STOPPED', desiredState: 'STOPPED', stateReason: 'Acil durdurma uygulandı.',
    schedulerOwner: null, leaseExpiresAt: null, stoppedAt: new Date(),
  }, ipAddress);
}

async function ownedBot(userId: string, id: string) {
  const bot = await prisma.tradingBot.findFirst({ where: { id, userId }, select: {
    id: true, userId: true, exchangeAccountId: true, state: true, mode: true, version: true, type: true,
  } });
  if (!bot) throw new ApiError(404, 'Bot bulunamadı.', 'TRADING_BOT_NOT_FOUND');
  if (bot.type === 'AUTONOMOUS') {
    throw new ApiError(404, 'Bot bulunamadı.', 'TRADING_BOT_NOT_FOUND');
  }
  return bot;
}

function assertAction(state: TradingBotState, action: BotAction) {
  if (!allowedActions[action].includes(state)) {
    throw new ApiError(409, `${state} durumundaki bot için ${action} işlemi geçersiz.`, 'INVALID_BOT_TRANSITION');
  }
}

async function loadSafetyGate(userId: string, exchangeAccountId: string) {
  const [account, profile, control] = await Promise.all([
    prisma.exchangeAccount.findFirst({ where: { id: exchangeAccountId, userId }, select: { isActive: true, connectionStatus: true } }),
    prisma.tradingRiskProfile.findUnique({ where: { exchangeAccountId }, select: { enabled: true, accountKillSwitch: true } }),
    prisma.tradingRiskControl.findUnique({ where: { id: 'global' }, select: { globalKillSwitch: true } }),
  ]);
  if (!account?.isActive) return { code: 'BOT_ACCOUNT_DISABLED', message: 'Borsa hesabı devre dışı.' };
  if (account.connectionStatus !== 'CONNECTED') return { code: 'BOT_ACCOUNT_NOT_READY', message: 'Borsa bağlantısı hazır değil.' };
  if (!profile?.enabled) return { code: 'BOT_RISK_PROFILE_DISABLED', message: 'Risk profili etkin değil.' };
  if (control?.globalKillSwitch) return { code: 'GLOBAL_KILL_SWITCH_ACTIVE', message: 'Global acil durdurma aktif.' };
  if (profile.accountKillSwitch) return { code: 'ACCOUNT_KILL_SWITCH_ACTIVE', message: 'Hesap acil durdurması aktif.' };
  return { code: null, message: 'Bağlantı ve risk kontrolleri hazır.' };
}

async function persistTransition(
  userId: string,
  bot: { id: string; exchangeAccountId: string; version: number },
  action: BotAction,
  data: Prisma.TradingBotUpdateInput,
  ipAddress?: string,
) {
  return prisma.$transaction(async (tx) => {
    const changed = await tx.tradingBot.updateMany({ where: { id: bot.id, userId, version: bot.version }, data: { ...data, version: { increment: 1 } } });
    if (changed.count !== 1) throw new ApiError(409, 'Bot durumu eşzamanlı olarak değişti; listeyi yenileyin.', 'BOT_VERSION_CONFLICT');
    const updated = await tx.tradingBot.findUniqueOrThrow({ where: { id: bot.id }, select: botSelect });
    await tx.tradingAuditLog.create({ data: {
      userId, exchangeAccountId: bot.exchangeAccountId, action: `TRADING_BOT_${action}`, entityType: 'TRADING_BOT', entityId: bot.id,
      metadata: { state: updated.state, desiredState: updated.desiredState }, ...(ipAddress ? { ipAddress } : {}),
    } });
    await tx.tradingOutboxEvent.create({ data: {
      userId, exchangeAccountId: bot.exchangeAccountId, provider: updated.exchangeAccount.provider,
      topic: 'trading.bot', eventType: `BOT_${action}`, aggregateType: 'TRADING_BOT', aggregateId: bot.id,
      deduplicationKey: `node:bot:${bot.id}:${randomUUID()}`,
      payload: { botId: bot.id, state: updated.state, desiredState: updated.desiredState, reason: updated.stateReason }, occurredAt: new Date(),
    } });
    return updated;
  });
}
