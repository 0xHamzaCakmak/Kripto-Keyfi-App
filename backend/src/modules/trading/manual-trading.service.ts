import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { assertPositiveDecimal, compareDecimals, isStepAligned, multiplyDecimals, normalizeDecimal } from './decimal.js';
import { adapterFor, exchangeCall, ownedAccount, readExchangeState } from './exchange-account.service.js';
import { ExchangeAdapterError } from './exchanges/exchange-adapter.js';
import type { ExchangeAdapter } from './exchanges/exchange-adapter.js';
import type { CancelOrderInput, ClosePositionInput, PreviewOrderInput, PublishMentorSignalInput, SubmitOrderInput } from './manual-trading.schema.js';
import { scheduleShadowComparison } from './shadow-compare.js';
import { cancelTradingEngineOrder, executeTradingEngineOrder, getTradingEngineSnapshot, previewTradingEngineOrder } from './trading-engine.client.js';
import { appendTradingEvent } from './trading-events.service.js';
import { assertCentralRiskExecution } from './execution-safety.js';

const PREVIEW_TTL_MS = 2 * 60 * 1000;

export async function listSymbols(userId: string, exchangeAccountId: string) {
  const account = await readableTradingAccount(userId, exchangeAccountId);
  const symbols = await readExchangeState(account.executionEngine,
    async () => (await getTradingEngineSnapshot(account)).symbols,
    () => exchangeCall(() => adapterFor(account).getSymbols()));
  if (account.executionEngine === 'TYPESCRIPT') scheduleShadowComparison(userId, exchangeAccountId, 'symbols', symbols);
  return symbols;
}

export async function createOrderPreview(userId: string, input: PreviewOrderInput) {
  const account = await tradingAccount(userId, input.exchangeAccountId);
  if (account.provider === 'BINANCE' && !input.reduceOnly && !input.symbol.endsWith('USDC')) {
    throw new ApiError(400, 'Manuel yeni işlemler bot sermayesinden ayrılmak için USDC vadeli paritelerinde açılmalıdır.', 'MANUAL_USDC_REQUIRED');
  }
  if (account.provider === 'BINANCE' && !input.reduceOnly) {
    const botConflict = await prisma.tradingBot.count({
      where: { userId, exchangeAccountId: account.id, type: 'AUTONOMOUS', mode: 'DEMO', symbol: input.symbol, lifecycleStatus: { not: 'ARCHIVED' } },
    });
    if (botConflict > 0) {
      throw new ApiError(409, 'Bu USDC paritesi aktif bir bot tarafından kullanılıyor. Manuel ve bot pozisyonlarının birleşmemesi için başka bir USDC paritesi seçin.', 'MANUAL_SYMBOL_BOT_CONFLICT');
    }
  }
  const goPreview = account.executionEngine === 'GO' ? await previewTradingEngineOrder(account, input) : undefined;
  const adapter = account.executionEngine === 'TYPESCRIPT' ? adapterFor(account) : undefined;
  const symbols = goPreview ? [goPreview.rule] : await exchangeCall(() => adapter!.getSymbols());
  const rules = symbols.find((item) => item.symbol === input.symbol);
  if (!rules) throw new ApiError(404, 'İşleme açık vadeli parite bulunamadı.', 'TRADING_SYMBOL_NOT_FOUND');
  if (input.leverage > rules.maxLeverage) throw new ApiError(400, `Bu paritede en fazla ${rules.maxLeverage}x kaldıraç kullanılabilir.`, 'LEVERAGE_LIMIT_EXCEEDED');

  const quantity = normalizeDecimal(input.quantity);
  assertPositiveDecimal(quantity, 'Miktar');
  if (compareDecimals(quantity, rules.minQuantity) < 0 || compareDecimals(quantity, rules.maxQuantity) > 0) {
    throw new ApiError(400, `Miktar ${rules.minQuantity} ile ${rules.maxQuantity} arasında olmalıdır.`, 'QUANTITY_OUT_OF_RANGE');
  }
  if (!isStepAligned(quantity, rules.stepSize)) throw new ApiError(400, `Miktar adımı ${rules.stepSize} olmalıdır.`, 'QUANTITY_STEP_MISMATCH');

  const price = input.price ? validatePrice(input.price, rules.tickSize, 'Fiyat') : undefined;
  const stopPrice = input.stopPrice ? validatePrice(input.stopPrice, rules.tickSize, 'Tetikleme fiyatı') : undefined;
  const markPrice = normalizeDecimal(goPreview?.markPrice ?? await exchangeCall(() => adapter!.getMarkPrice(input.symbol)));
  const estimatedNotional = normalizeDecimal(goPreview?.estimatedNotional ?? multiplyDecimals(quantity, price ?? markPrice));
  if (compareDecimals(estimatedNotional, rules.minNotional) < 0) {
    throw new ApiError(400, `Tahmini emir büyüklüğü en az ${rules.minNotional} USDT olmalıdır.`, 'MIN_NOTIONAL_NOT_MET');
  }

  const expiresAt = new Date(Date.now() + PREVIEW_TTL_MS);
  const preview = await prisma.manualOrderPreview.create({
    data: {
      userId, exchangeAccountId: account.id, symbol: input.symbol, side: input.side, type: input.type,
      quantity, ...(price ? { price } : {}), ...(stopPrice ? { stopPrice } : {}), leverage: input.leverage,
      marginMode: input.marginMode, reduceOnly: input.reduceOnly, markPrice, estimatedNotional, expiresAt,
    },
  });
  return {
    id: preview.id, exchangeAccountId: account.id, accountName: account.name, provider: account.provider,
    symbol: preview.symbol, side: preview.side, type: preview.type, quantity: preview.quantity.toString(),
    price: preview.price?.toString(), stopPrice: preview.stopPrice?.toString(), leverage: preview.leverage,
    marginMode: preview.marginMode, reduceOnly: preview.reduceOnly, markPrice: preview.markPrice.toString(),
    estimatedNotional: preview.estimatedNotional.toString(), minNotional: rules.minNotional,
    estimatedInitialMargin: divideByInteger(preview.estimatedNotional.toString(), preview.leverage),
    expiresAt: preview.expiresAt,
    warnings: ['Testnet/demo emridir; gerçek para kullanılmaz.', 'Piyasa emirlerinde gerçekleşme fiyatı mark fiyatından farklı olabilir.'],
  };
}

export async function submitOrder(userId: string, input: SubmitOrderInput, ipAddress?: string) {
  const duplicate = await prisma.tradingOrder.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
  });
  if (duplicate) return serializeStoredOrder(duplicate, true);

  const preview = await prisma.manualOrderPreview.findFirst({ where: { id: input.previewId, userId }, include: { exchangeAccount: true } });
  if (!preview) throw new ApiError(404, 'Emir önizlemesi bulunamadı.', 'ORDER_PREVIEW_NOT_FOUND');
  if (preview.consumedAt) throw new ApiError(409, 'Bu emir önizlemesi daha önce kullanıldı.', 'ORDER_PREVIEW_CONSUMED');
  if (preview.expiresAt <= new Date()) throw new ApiError(410, 'Emir önizlemesinin süresi doldu. Yeniden önizleme oluşturun.', 'ORDER_PREVIEW_EXPIRED');
  assertTradableAccount(preview.exchangeAccount);
  assertCentralRiskExecution({ executionEngine: preview.exchangeAccount.executionEngine, reduceOnly: preview.reduceOnly });

  const clientOrderId = `kk_${randomUUID().replaceAll('-', '').slice(0, 30)}`;
  let stored;
  try {
    stored = await prisma.$transaction(async (tx) => {
      const consumed = await tx.manualOrderPreview.updateMany({ where: { id: preview.id, consumedAt: null }, data: { consumedAt: new Date() } });
      if (consumed.count !== 1) throw new ApiError(409, 'Bu emir önizlemesi başka bir istek tarafından kullanıldı.', 'ORDER_PREVIEW_CONSUMED');
      return tx.tradingOrder.create({
        data: {
          userId, exchangeAccountId: preview.exchangeAccountId, previewId: preview.id, idempotencyKey: input.idempotencyKey,
          clientOrderId, symbol: preview.symbol, side: preview.side, type: preview.type, quantity: preview.quantity,
          price: preview.price, stopPrice: preview.stopPrice, leverage: preview.leverage, marginMode: preview.marginMode,
          reduceOnly: preview.reduceOnly,
          executionEngine: preview.exchangeAccount.executionEngine,
        },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.tradingOrder.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } } });
      if (existing) return serializeStoredOrder(existing, true);
    }
    throw error;
  }

  const goExecution = preview.exchangeAccount.executionEngine === 'GO';
  const adapter = goExecution ? undefined : adapterFor(preview.exchangeAccount);
  await emitTradingState({
    userId, exchangeAccountId: preview.exchangeAccountId, provider: preview.exchangeAccount.provider,
    eventType: 'ORDER_STATE_CHANGED', aggregateType: 'ORDER', aggregateId: stored.id,
    payload: { localOrderId: stored.id, clientOrderId, symbol: preview.symbol, status: 'SUBMITTING' },
  });
  try {
    const exchangeOrder = goExecution
      ? (await executeTradingEngineOrder(preview.exchangeAccount, preview, stored)).order
      : await submitTypeScriptOrder(adapter!, preview as typeof preview & { type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'STOP_LIMIT' }, clientOrderId);
    const status = exchangeOrder.status === 'FILLED' ? 'FILLED' : 'OPEN';
    const completed = await prisma.$transaction(async (tx) => {
      const order = goExecution
        ? await tx.tradingOrder.findUniqueOrThrow({ where: { id: stored.id } })
        : await tx.tradingOrder.update({ where: { id: stored.id }, data: { exchangeOrderId: exchangeOrder.exchangeOrderId, status, submittedAt: new Date(), executionAttemptedAt: new Date() } });
      await tx.tradingAuditLog.create({ data: {
        userId, exchangeAccountId: preview.exchangeAccountId, action: 'MANUAL_ORDER_SUBMITTED', entityType: 'TRADING_ORDER', entityId: order.id,
        metadata: { symbol: order.symbol, side: order.side, type: order.type, quantity: order.quantity.toString(), leverage: order.leverage, marginMode: order.marginMode, reduceOnly: order.reduceOnly, environment: preview.exchangeAccount.environment },
        ...(ipAddress ? { ipAddress } : {}),
      } });
      return order;
    });
    await emitTradingState({
      userId, exchangeAccountId: preview.exchangeAccountId, provider: preview.exchangeAccount.provider,
      eventType: 'ORDER_STATE_CHANGED', aggregateType: 'ORDER', aggregateId: completed.exchangeOrderId ?? completed.id,
      payload: { localOrderId: completed.id, exchangeOrderId: completed.exchangeOrderId, symbol: completed.symbol, status: completed.status },
    });
    return { ...serializeStoredOrder(completed, false), exchange: exchangeOrder };
  } catch (error) {
    if (goExecution) {
      const failed = await prisma.tradingOrder.findUniqueOrThrow({ where: { id: stored.id } });
      if (failed.exchangeOrderId && ['OPEN', 'PARTIALLY_FILLED', 'FILLED'].includes(failed.status)) {
        return serializeStoredOrder(failed, false);
      }
      const action = failed.status === 'RECONCILIATION_REQUIRED'
        ? 'ORDER_RECONCILIATION_REQUIRED'
        : failed.status === 'SUBMITTING' ? 'ORDER_RESPONSE_UNCERTAIN' : 'MANUAL_ORDER_FAILED';
      await prisma.tradingAuditLog.create({ data: {
        userId, exchangeAccountId: preview.exchangeAccountId,
        action,
        entityType: 'TRADING_ORDER', entityId: stored.id,
        metadata: { symbol: preview.symbol, clientOrderId, code: failed.failureCode ?? 'GO_EXECUTION_FAILED', executor: 'GO' },
        ...(ipAddress ? { ipAddress } : {}),
      } });
      await emitTradingState({
        userId, exchangeAccountId: preview.exchangeAccountId, provider: preview.exchangeAccount.provider,
        eventType: 'ORDER_STATE_CHANGED', aggregateType: 'ORDER', aggregateId: stored.id,
        payload: { localOrderId: stored.id, symbol: preview.symbol, status: failed.status, failureCode: failed.failureCode },
      });
      throw error;
    }
    const uncertain = isUncertainExchangeFailure(error);
    const code = error instanceof ApiError ? error.code : 'ORDER_SUBMISSION_FAILED';
    const message = error instanceof Error ? error.message : 'Emir gönderilemedi.';
    await prisma.tradingOrder.update({ where: { id: stored.id }, data: uncertain
      ? { failureCode: 'RECONCILIATION_REQUIRED', failureMessage: 'Borsa yanıtı alınamadı; emir durumu mutabakat gerektiriyor.' }
      : { status: 'FAILED', failureCode: code, failureMessage: message } });
    await prisma.tradingAuditLog.create({ data: {
      userId, exchangeAccountId: preview.exchangeAccountId, action: uncertain ? 'ORDER_RECONCILIATION_REQUIRED' : 'MANUAL_ORDER_FAILED',
      entityType: 'TRADING_ORDER', entityId: stored.id, metadata: { symbol: preview.symbol, clientOrderId, code }, ...(ipAddress ? { ipAddress } : {}),
    } });
    await emitTradingState({
      userId, exchangeAccountId: preview.exchangeAccountId, provider: preview.exchangeAccount.provider,
      eventType: 'ORDER_STATE_CHANGED', aggregateType: 'ORDER', aggregateId: stored.id,
      payload: { localOrderId: stored.id, symbol: preview.symbol, status: uncertain ? 'RECONCILIATION_REQUIRED' : 'FAILED', failureCode: code },
    });
    throw error;
  }
}

export async function listOpenOrders(userId: string, exchangeAccountId: string) {
  const account = await readableTradingAccount(userId, exchangeAccountId);
  const orders = await readExchangeState(account.executionEngine,
    async () => (await getTradingEngineSnapshot(account)).orders,
    () => exchangeCall(() => adapterFor(account).getOpenOrders()));
  if (account.executionEngine === 'TYPESCRIPT') scheduleShadowComparison(userId, exchangeAccountId, 'orders', orders);
  const localPending = await prisma.tradingOrder.findMany({
    where: { userId, exchangeAccountId, status: { in: ['SUBMITTING', 'CANCELING', 'CLOSING', 'RECONCILIATION_REQUIRED'] } },
    orderBy: { createdAt: 'asc' },
  });
  const exchangeIds = new Set(orders.map((order) => order.exchangeOrderId));
  return [
    ...orders,
    ...localPending.filter((order) => !order.exchangeOrderId || !exchangeIds.has(order.exchangeOrderId)).map((order) => ({
      exchangeOrderId: order.exchangeOrderId ?? `local:${order.id}`,
      clientOrderId: order.clientOrderId, symbol: order.symbol, side: order.side, type: order.type,
      status: order.status, quantity: order.quantity.toString(), executedQuantity: '0',
      price: order.price?.toString(), stopPrice: order.stopPrice?.toString(), reduceOnly: order.reduceOnly,
      createdAt: order.createdAt.toISOString(), localOrderId: order.id, pending: true,
    })),
  ];
}

export async function cancelOpenOrder(userId: string, exchangeOrderId: string, input: CancelOrderInput, ipAddress?: string) {
  const account = await tradingAccount(userId, input.exchangeAccountId);
  const adapter = account.executionEngine === 'TYPESCRIPT' ? adapterFor(account) : undefined;
  const current = await readExchangeState(account.executionEngine,
    async () => (await getTradingEngineSnapshot(account)).orders,
    () => exchangeCall(() => adapterFor(account).getOpenOrders()));
  const order = current.find((item) => item.exchangeOrderId === exchangeOrderId && item.symbol === input.symbol);
  if (!order) throw new ApiError(404, 'Açık emir bulunamadı veya daha önce sonuçlandı.', 'OPEN_ORDER_NOT_FOUND');
  await emitTradingState({ userId, exchangeAccountId: input.exchangeAccountId, provider: account.provider,
    eventType: 'ORDER_STATE_CHANGED', aggregateType: 'ORDER', aggregateId: exchangeOrderId,
    payload: { exchangeOrderId, symbol: order.symbol, status: 'CANCELING' } });
  let canceled;
  try {
    canceled = account.executionEngine === 'GO'
      ? (await cancelTradingEngineOrder(account, order.exchangeOrderId, order.symbol, input.idempotencyKey)).order
      : await exchangeCall(() => adapter!.cancelOrder(order.symbol, order.exchangeOrderId));
  } catch (error) {
    await emitTradingState({ userId, exchangeAccountId: input.exchangeAccountId, provider: account.provider,
      eventType: 'ORDER_STATE_CHANGED', aggregateType: 'ORDER', aggregateId: exchangeOrderId,
      payload: { exchangeOrderId, symbol: order.symbol, status: 'CANCEL_FAILED' } });
    throw error;
  }
  await prisma.$transaction([
    prisma.tradingOrder.updateMany({ where: { userId, exchangeAccountId: input.exchangeAccountId, exchangeOrderId }, data: { status: 'CANCELED' } }),
    prisma.tradingAuditLog.create({ data: { userId, exchangeAccountId: input.exchangeAccountId, action: 'ORDER_CANCELED', entityType: 'EXCHANGE_ORDER', entityId: exchangeOrderId, metadata: { symbol: order.symbol }, ...(ipAddress ? { ipAddress } : {}) } }),
  ]);
  await emitTradingState({ userId, exchangeAccountId: input.exchangeAccountId, provider: account.provider,
    eventType: 'ORDER_STATE_CHANGED', aggregateType: 'ORDER', aggregateId: exchangeOrderId,
    payload: { exchangeOrderId, symbol: order.symbol, status: 'CANCELED' } });
  return canceled;
}

export async function listPositions(userId: string, exchangeAccountId: string) {
  const account = await readableTradingAccount(userId, exchangeAccountId);
  const positions = await readExchangeState(account.executionEngine,
    async () => (await getTradingEngineSnapshot(account)).positions,
    () => exchangeCall(() => adapterFor(account).getPositions()));
  if (account.executionEngine === 'TYPESCRIPT') scheduleShadowComparison(userId, exchangeAccountId, 'positions', positions);
  return positions;
}

export async function listManualMentorPositions(userId: string, exchangeAccountId: string) {
  const positions = await listPositions(userId, exchangeAccountId);
  const manualEntries = await prisma.tradingOrder.findMany({
    where: {
      userId, exchangeAccountId, source: 'MANUAL', reduceOnly: false,
      status: { in: ['OPEN', 'PARTIALLY_FILLED', 'FILLED'] },
      symbol: { in: positions.map((position) => position.symbol) },
    },
    orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, symbol: true },
  });
  const entryBySymbol = new Map<string, string>();
  for (const entry of manualEntries) if (!entryBySymbol.has(entry.symbol)) entryBySymbol.set(entry.symbol, entry.id);
  const published = await prisma.tradingAuditLog.findMany({
    where: { userId, exchangeAccountId, action: 'MANUAL_MENTOR_SIGNAL_PUBLISHED' },
    orderBy: { createdAt: 'desc' }, take: 500, select: { entityId: true },
  });
  const publishedIds = new Set(published.map((item) => item.entityId));
  return positions.flatMap((position) => {
    const manualEntryId = entryBySymbol.get(position.symbol);
    if (!manualEntryId || !position.symbol.endsWith('USDC')) return [];
    const signalKey = mentorSignalKey(exchangeAccountId, position.positionKey, manualEntryId, position.entryPrice);
    return [{ ...position, manualEntryId, mentorPublished: publishedIds.has(signalKey), mentorEligible: Number(position.unrealizedPnl) > 0 }];
  });
}

export async function publishManualMentorSignal(
  userId: string,
  positionKey: string,
  input: PublishMentorSignalInput,
  ipAddress?: string,
) {
  const account = await tradingAccount(userId, input.exchangeAccountId);
  const positions = await listManualMentorPositions(userId, input.exchangeAccountId);
  const position = positions.find((item) => item.positionKey === positionKey);
  if (!position) throw new ApiError(404, 'Mentor sinyali için eşleşen açık manuel USDC pozisyonu bulunamadı.', 'MANUAL_MENTOR_POSITION_NOT_FOUND');
  if (Number(position.unrealizedPnl) <= 0) throw new ApiError(409, 'Mentor sinyali yalnızca pozitif PnL gösteren manuel pozisyonlardan gönderilebilir.', 'MANUAL_MENTOR_PROFIT_REQUIRED');

  const signalKey = mentorSignalKey(input.exchangeAccountId, position.positionKey, position.manualEntryId, position.entryPrice);
  const duplicate = await prisma.tradingAuditLog.findFirst({
    where: { userId, exchangeAccountId: input.exchangeAccountId, action: 'MANUAL_MENTOR_SIGNAL_PUBLISHED', entityId: signalKey },
    select: { id: true },
  });
  if (duplicate) throw new ApiError(409, 'Bu manuel pozisyon daha önce mentor sinyali olarak gönderildi.', 'MANUAL_MENTOR_ALREADY_PUBLISHED');

  const baseAsset = stablecoinBaseAsset(position.symbol);
  const regimeSnapshot = await prisma.marketRegimeSnapshot.findFirst({
    where: { symbol: { in: [position.symbol, `${baseAsset}USDT`, `${baseAsset}USDC`] } },
    orderBy: [{ observedAt: 'desc' }, { id: 'desc' }],
    select: { regime: true, confidence: true, timeframe: true, features: true, observedAt: true },
  });
  const action = position.side === 'LONG' ? 'BUY' : 'SELL';
  const evidence = {
    signalKey,
    baseAsset,
    sourceSymbol: position.symbol,
    action,
    entryPrice: position.entryPrice,
    observedPrice: position.markPrice,
    unrealizedPnl: position.unrealizedPnl,
    leverage: position.leverage,
    marginMode: position.marginMode,
    regime: regimeSnapshot?.regime ?? 'UNKNOWN',
    regimeConfidence: regimeSnapshot?.confidence.toString() ?? '0',
    regimeTimeframe: regimeSnapshot?.timeframe ?? null,
    marketFeatures: regimeSnapshot?.features ?? null,
    mentorObservedAt: new Date().toISOString(),
    outcomeState: 'POSITIVE_OPEN_SNAPSHOT',
    forcesTrade: false,
  } satisfies Prisma.JsonObject;

  const candidates = await prisma.tradingBot.findMany({
    where: { userId, exchangeAccountId: input.exchangeAccountId, type: 'AUTONOMOUS', mode: 'DEMO', lifecycleStatus: { not: 'ARCHIVED' } },
    select: {
      id: true, symbol: true, configuration: true,
      metrics: { orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }], take: 1, select: { totalTrades: true, wins: true, netPnl: true, score: true } },
    },
  });
  const targeted = candidates.filter((bot) => {
    if (stablecoinBaseAsset(bot.symbol) !== baseAsset) return false;
    const metric = bot.metrics[0];
    if (!metric || metric.totalTrades < 10) return false;
    const winRate = metric.totalTrades > 0 ? metric.wins / metric.totalTrades : 0;
    return winRate < 0.5 || metric.netPnl.isNegative() || (metric.score?.toNumber() ?? 100) < 50;
  });
  const updates = targeted.map((bot) => {
    const configuration = bot.configuration && !Array.isArray(bot.configuration) && typeof bot.configuration === 'object'
      ? { ...(bot.configuration as Prisma.JsonObject) }
      : {};
    const previous = Array.isArray(configuration.mentorEvidence)
      ? configuration.mentorEvidence.filter((item): item is Prisma.JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
      : [];
    configuration.mentorEvidence = [...previous.filter((item) => item.signalKey !== signalKey), evidence].slice(-20);
    return prisma.tradingBot.update({ where: { id: bot.id }, data: { configuration: configuration as Prisma.InputJsonValue, version: { increment: 1 } } });
  });
  await prisma.$transaction([
    ...updates,
    prisma.tradingAuditLog.create({ data: {
      userId, exchangeAccountId: input.exchangeAccountId, action: 'MANUAL_MENTOR_SIGNAL_PUBLISHED', entityType: 'MANUAL_POSITION', entityId: signalKey,
      metadata: { ...evidence, manualEntryId: position.manualEntryId, targetedBotIds: targeted.map((bot) => bot.id), targetedBotCount: targeted.length, recommendationWeight: 0.2 },
      ...(ipAddress ? { ipAddress } : {}),
    } }),
  ]);
  return { signalKey, targetedBotCount: targeted.length, action, baseAsset, outcomeState: evidence.outcomeState, forcesTrade: false };
}

export async function closePosition(userId: string, positionKey: string, input: ClosePositionInput, ipAddress?: string) {
  const account = await tradingAccount(userId, input.exchangeAccountId);
  const positions = await listPositions(userId, input.exchangeAccountId);
  const position = positions.find((item) => item.positionKey === positionKey);
  if (!position) throw new ApiError(404, 'Açık pozisyon bulunamadı.', 'POSITION_NOT_FOUND');
  const quantity = input.quantity ? normalizeDecimal(input.quantity) : position.quantity;
  assertPositiveDecimal(quantity, 'Kapatma miktarı');
  if (compareDecimals(quantity, position.quantity) > 0) throw new ApiError(400, 'Kapatma miktarı açık pozisyonu aşamaz.', 'CLOSE_QUANTITY_EXCEEDED');
  const symbols = await listSymbols(userId, input.exchangeAccountId);
  const rules = symbols.find((item) => item.symbol === position.symbol);
  if (!rules || !isStepAligned(quantity, rules.stepSize)) throw new ApiError(400, 'Kapatma miktarı parite adımına uygun değil.', 'QUANTITY_STEP_MISMATCH');
  await emitTradingState({ userId, exchangeAccountId: input.exchangeAccountId, provider: account.provider,
    eventType: 'POSITION_STATE_CHANGED', aggregateType: 'POSITION', aggregateId: positionKey,
    payload: { positionKey, symbol: position.symbol, status: 'CLOSING' } });
  const preview = await createOrderPreview(userId, {
    exchangeAccountId: input.exchangeAccountId, symbol: position.symbol, side: position.side === 'LONG' ? 'SELL' : 'BUY',
    type: input.type, quantity, ...(input.type === 'LIMIT' && input.price ? { price: input.price } : {}),
    leverage: Math.max(1, Math.trunc(Number(position.leverage))), marginMode: position.marginMode, reduceOnly: true,
  });
  await guardAutonomousReentryAfterManualClose(userId, input.exchangeAccountId, position.symbol, positionKey, input.type, ipAddress);
  let result;
  try {
    result = await submitOrder(userId, { previewId: preview.id, idempotencyKey: input.idempotencyKey }, ipAddress);
  } catch (error) {
    await emitTradingState({ userId, exchangeAccountId: input.exchangeAccountId, provider: account.provider,
      eventType: 'POSITION_STATE_CHANGED', aggregateType: 'POSITION', aggregateId: positionKey,
      payload: { positionKey, symbol: position.symbol, status: 'CLOSE_FAILED' } });
    throw error;
  }
  await prisma.tradingAuditLog.create({ data: {
    userId, exchangeAccountId: input.exchangeAccountId,
    action: input.type === 'LIMIT' ? 'POSITION_LIMIT_CLOSE_SUBMITTED' : quantity === position.quantity ? 'POSITION_CLOSED' : 'POSITION_PARTIALLY_CLOSED',
    entityType: 'EXCHANGE_POSITION', entityId: positionKey, metadata: { symbol: position.symbol, quantity, type: input.type, price: input.price ?? null, reduceOnly: true }, ...(ipAddress ? { ipAddress } : {}),
  } });
  const finalStatus = input.type === 'LIMIT' ? 'CLOSE_ORDER_OPEN' : 'CLOSED';
  await emitTradingState({ userId, exchangeAccountId: input.exchangeAccountId, provider: account.provider,
    eventType: 'POSITION_STATE_CHANGED', aggregateType: 'POSITION', aggregateId: positionKey,
    payload: { positionKey, symbol: position.symbol, status: finalStatus, closeType: input.type } });
  return result;
}

async function guardAutonomousReentryAfterManualClose(
  userId: string,
  exchangeAccountId: string,
  symbol: string,
  positionKey: string,
  closeType: 'MARKET' | 'LIMIT',
  ipAddress?: string,
) {
  const currentCandleOpenMs = Math.floor(Date.now() / 900_000) * 900_000;
  const bots = await prisma.tradingBot.findMany({
    where: { userId, exchangeAccountId, type: 'AUTONOMOUS', mode: 'DEMO', symbol, lifecycleStatus: { not: 'ARCHIVED' } },
    select: { id: true, configuration: true },
  });
  const updates = bots.map((bot) => {
    const configuration = bot.configuration && !Array.isArray(bot.configuration) && typeof bot.configuration === 'object'
      ? { ...(bot.configuration as Prisma.JsonObject) }
      : {};
    configuration.testnetReentryAfterCandleOpenMs = currentCandleOpenMs;
    configuration.testnetReentryGuardReason = `MANUAL_${closeType}_CLOSE`;
    configuration.testnetReentryGuardedAt = new Date().toISOString();
    return prisma.tradingBot.update({ where: { id: bot.id }, data: { configuration: configuration as Prisma.InputJsonValue, version: { increment: 1 } } });
  });
  await prisma.$transaction([
    ...updates,
    prisma.tradingAuditLog.create({ data: {
      userId, exchangeAccountId, action: 'AUTONOMOUS_REENTRY_GUARD_SET', entityType: 'EXCHANGE_POSITION', entityId: positionKey,
      metadata: { symbol, closeType, botCount: bots.length, currentCandleOpenMs, nextEvaluationTimeframe: '15m', productionLive: false },
      ...(ipAddress ? { ipAddress } : {}),
    } }),
  ]);
}

async function tradingAccount(userId: string, exchangeAccountId: string) {
  const account = await ownedAccount(userId, exchangeAccountId);
  assertTradableAccount(account);
  return account;
}

async function readableTradingAccount(userId: string, exchangeAccountId: string) {
  const account = await ownedAccount(userId, exchangeAccountId);
  if (!account.isActive) throw new ApiError(409, 'Pasif borsa hesabı okunamaz.', 'EXCHANGE_ACCOUNT_DISABLED');
  return account;
}

async function submitTypeScriptOrder(adapter: ExchangeAdapter, preview: {
  symbol: string; side: 'BUY' | 'SELL'; type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'STOP_LIMIT'; quantity: Prisma.Decimal;
  price: Prisma.Decimal | null; stopPrice: Prisma.Decimal | null; leverage: number; marginMode: 'ISOLATED' | 'CROSS'; reduceOnly: boolean;
}, clientOrderId: string) {
  assertCentralRiskExecution({ executionEngine: 'TYPESCRIPT', reduceOnly: preview.reduceOnly });
  if (!preview.reduceOnly) await exchangeCall(() => adapter.configurePosition(preview.symbol, preview.leverage, preview.marginMode));
  return exchangeCall(() => adapter.placeOrder({
    symbol: preview.symbol, side: preview.side, type: preview.type, quantity: preview.quantity.toString(),
    ...(preview.price ? { price: preview.price.toString() } : {}), ...(preview.stopPrice ? { stopPrice: preview.stopPrice.toString() } : {}),
    reduceOnly: preview.reduceOnly, clientOrderId,
  }));
}

function assertTradableAccount(account: { isActive: boolean; canTrade: boolean; connectionStatus: string }) {
  if (!account.isActive) throw new ApiError(409, 'Pasif borsa hesabında işlem yapılamaz.', 'EXCHANGE_ACCOUNT_DISABLED');
  if (account.connectionStatus !== 'CONNECTED') throw new ApiError(409, 'Borsa hesabı bağlantı veya mutabakat nedeniyle işlem kabul etmiyor.', 'EXCHANGE_ACCOUNT_NOT_READY');
  if (!account.canTrade) throw new ApiError(409, 'Borsa hesabının vadeli işlem yetkisi bulunmuyor.', 'EXCHANGE_TRADING_NOT_ALLOWED');
}

function validatePrice(value: string, tickSize: string, label: string): string {
  const normalized = normalizeDecimal(value); assertPositiveDecimal(normalized, label);
  if (!isStepAligned(normalized, tickSize)) throw new ApiError(400, `${label} adımı ${tickSize} olmalıdır.`, 'PRICE_TICK_MISMATCH');
  return normalized;
}

function divideByInteger(value: string, divisor: number): string {
  const [whole = '0', fraction = ''] = value.split('.');
  const scaled = BigInt(`${whole}${fraction}`); const scale = fraction.length + 8;
  const quotient = scaled * 100000000n / BigInt(divisor);
  const digits = quotient.toString().padStart(scale + 1, '0');
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function stablecoinBaseAsset(symbol: string) {
  return symbol.replace(/(?:USDT|USDC)$/u, '');
}

function mentorSignalKey(exchangeAccountId: string, positionKey: string, manualEntryId: string, entryPrice: string) {
  return createHash('sha256').update(`${exchangeAccountId}:${positionKey}:${manualEntryId}:${entryPrice}`).digest('hex').slice(0, 40);
}

function serializeStoredOrder(order: { id: string; exchangeAccountId: string; clientOrderId: string; exchangeOrderId: string | null; symbol: string; side: string; type: string; quantity: Prisma.Decimal; price: Prisma.Decimal | null; stopPrice: Prisma.Decimal | null; leverage: number; marginMode: string; reduceOnly: boolean; status: string; failureCode: string | null; failureMessage: string | null; submittedAt: Date | null; createdAt: Date }, idempotentReplay: boolean) {
  return {
    id: order.id, exchangeAccountId: order.exchangeAccountId, clientOrderId: order.clientOrderId, exchangeOrderId: order.exchangeOrderId,
    symbol: order.symbol, side: order.side, type: order.type, quantity: order.quantity.toString(), price: order.price?.toString(),
    stopPrice: order.stopPrice?.toString(), leverage: order.leverage, marginMode: order.marginMode, reduceOnly: order.reduceOnly,
    status: order.status, failureCode: order.failureCode, failureMessage: order.failureMessage, submittedAt: order.submittedAt,
    createdAt: order.createdAt, idempotentReplay,
  };
}

function isUncertainExchangeFailure(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'EXCHANGE_UNAVAILABLE' || error instanceof ExchangeAdapterError && error.code === 'EXCHANGE_UNAVAILABLE';
}

function emitTradingState(input: Omit<Parameters<typeof appendTradingEvent>[0], 'topic'>) {
  return appendTradingEvent({ ...input, topic: input.aggregateType === 'POSITION' ? 'trading.position' : 'trading.order' })
    .then(() => undefined).catch(() => undefined);
}
