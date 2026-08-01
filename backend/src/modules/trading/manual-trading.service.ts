import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { assertPositiveDecimal, compareDecimals, isStepAligned, multiplyDecimals, normalizeDecimal } from './decimal.js';
import { adapterFor, exchangeCall, ownedAccount } from './exchange-account.service.js';
import { ExchangeAdapterError } from './exchanges/exchange-adapter.js';
import type { ExchangeAdapter } from './exchanges/exchange-adapter.js';
import type { CancelOrderInput, ClosePositionInput, PreviewOrderInput, SubmitOrderInput } from './manual-trading.schema.js';

const PREVIEW_TTL_MS = 2 * 60 * 1000;

export async function listSymbols(userId: string, exchangeAccountId: string) {
  const { adapter } = await tradingContext(userId, exchangeAccountId);
  return exchangeCall(() => adapter.getSymbols());
}

export async function createOrderPreview(userId: string, input: PreviewOrderInput) {
  const { account, adapter } = await tradingContext(userId, input.exchangeAccountId);
  const symbols = await exchangeCall(() => adapter.getSymbols());
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
  const markPrice = normalizeDecimal(await exchangeCall(() => adapter.getMarkPrice(input.symbol)));
  const estimatedNotional = multiplyDecimals(quantity, price ?? markPrice);
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

  const adapter = adapterFor(preview.exchangeAccount);
  try {
    if (!preview.reduceOnly) {
      await exchangeCall(() => adapter.configurePosition(preview.symbol, preview.leverage, preview.marginMode));
    }
    const exchangeOrder = await exchangeCall(() => adapter.placeOrder({
      symbol: preview.symbol, side: preview.side, type: preview.type, quantity: preview.quantity.toString(),
      ...(preview.price ? { price: preview.price.toString() } : {}), ...(preview.stopPrice ? { stopPrice: preview.stopPrice.toString() } : {}),
      reduceOnly: preview.reduceOnly, clientOrderId,
    }));
    const status = exchangeOrder.status === 'FILLED' ? 'FILLED' : 'OPEN';
    const completed = await prisma.$transaction(async (tx) => {
      const order = await tx.tradingOrder.update({ where: { id: stored.id }, data: { exchangeOrderId: exchangeOrder.exchangeOrderId, status, submittedAt: new Date() } });
      await tx.tradingAuditLog.create({ data: {
        userId, exchangeAccountId: preview.exchangeAccountId, action: 'MANUAL_ORDER_SUBMITTED', entityType: 'TRADING_ORDER', entityId: order.id,
        metadata: { symbol: order.symbol, side: order.side, type: order.type, quantity: order.quantity.toString(), leverage: order.leverage, marginMode: order.marginMode, reduceOnly: order.reduceOnly, environment: preview.exchangeAccount.environment },
        ...(ipAddress ? { ipAddress } : {}),
      } });
      return order;
    });
    return { ...serializeStoredOrder(completed, false), exchange: exchangeOrder };
  } catch (error) {
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
    throw error;
  }
}

export async function listOpenOrders(userId: string, exchangeAccountId: string) {
  const { adapter } = await tradingContext(userId, exchangeAccountId);
  return exchangeCall(() => adapter.getOpenOrders());
}

export async function cancelOpenOrder(userId: string, exchangeOrderId: string, input: CancelOrderInput, ipAddress?: string) {
  const { adapter } = await tradingContext(userId, input.exchangeAccountId);
  const current = await exchangeCall(() => adapter.getOpenOrders());
  const order = current.find((item) => item.exchangeOrderId === exchangeOrderId && item.symbol === input.symbol);
  if (!order) throw new ApiError(404, 'Açık emir bulunamadı veya daha önce sonuçlandı.', 'OPEN_ORDER_NOT_FOUND');
  const canceled = await exchangeCall(() => adapter.cancelOrder(order.symbol, order.exchangeOrderId));
  await prisma.$transaction([
    prisma.tradingOrder.updateMany({ where: { userId, exchangeAccountId: input.exchangeAccountId, exchangeOrderId }, data: { status: 'CANCELED' } }),
    prisma.tradingAuditLog.create({ data: { userId, exchangeAccountId: input.exchangeAccountId, action: 'ORDER_CANCELED', entityType: 'EXCHANGE_ORDER', entityId: exchangeOrderId, metadata: { symbol: order.symbol }, ...(ipAddress ? { ipAddress } : {}) } }),
  ]);
  return canceled;
}

export async function listPositions(userId: string, exchangeAccountId: string) {
  const { adapter } = await tradingContext(userId, exchangeAccountId);
  return exchangeCall(() => adapter.getPositions());
}

export async function closePosition(userId: string, positionKey: string, input: ClosePositionInput, ipAddress?: string) {
  const { adapter } = await tradingContext(userId, input.exchangeAccountId);
  const positions = await exchangeCall(() => adapter.getPositions());
  const position = positions.find((item) => item.positionKey === positionKey);
  if (!position) throw new ApiError(404, 'Açık pozisyon bulunamadı.', 'POSITION_NOT_FOUND');
  const quantity = input.quantity ? normalizeDecimal(input.quantity) : position.quantity;
  assertPositiveDecimal(quantity, 'Kapatma miktarı');
  if (compareDecimals(quantity, position.quantity) > 0) throw new ApiError(400, 'Kapatma miktarı açık pozisyonu aşamaz.', 'CLOSE_QUANTITY_EXCEEDED');
  const symbols = await exchangeCall(() => adapter.getSymbols());
  const rules = symbols.find((item) => item.symbol === position.symbol);
  if (!rules || !isStepAligned(quantity, rules.stepSize)) throw new ApiError(400, 'Kapatma miktarı parite adımına uygun değil.', 'QUANTITY_STEP_MISMATCH');
  const preview = await createOrderPreview(userId, {
    exchangeAccountId: input.exchangeAccountId, symbol: position.symbol, side: position.side === 'LONG' ? 'SELL' : 'BUY',
    type: 'MARKET', quantity, leverage: Math.max(1, Math.trunc(Number(position.leverage))), marginMode: position.marginMode, reduceOnly: true,
  });
  const result = await submitOrder(userId, { previewId: preview.id, idempotencyKey: input.idempotencyKey }, ipAddress);
  await prisma.tradingAuditLog.create({ data: {
    userId, exchangeAccountId: input.exchangeAccountId, action: quantity === position.quantity ? 'POSITION_CLOSED' : 'POSITION_PARTIALLY_CLOSED',
    entityType: 'EXCHANGE_POSITION', entityId: positionKey, metadata: { symbol: position.symbol, quantity }, ...(ipAddress ? { ipAddress } : {}),
  } });
  return result;
}

async function tradingContext(userId: string, exchangeAccountId: string): Promise<{ account: Awaited<ReturnType<typeof ownedAccount>>; adapter: ExchangeAdapter }> {
  const account = await ownedAccount(userId, exchangeAccountId);
  assertTradableAccount(account);
  return { account, adapter: adapterFor(account) };
}

function assertTradableAccount(account: { isActive: boolean; canTrade: boolean }) {
  if (!account.isActive) throw new ApiError(409, 'Pasif borsa hesabında işlem yapılamaz.', 'EXCHANGE_ACCOUNT_DISABLED');
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
