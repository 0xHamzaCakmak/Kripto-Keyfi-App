import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { adapterFor, exchangeCall, ownedAccount } from './exchange-account.service.js';
import { getTradingEngineOpenOrders, previewTradingEngineOrder, executeTradingEngineOrder, cancelTradingEngineOrder } from './trading-engine.client.js';
import type { ExchangeOrder } from './exchanges/exchange-adapter.js';
import type { BatchPlan } from './manual-batch.service.js';
import type { PreviewOrderInput } from './manual-trading.schema.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 28);
const active = (order: ExchangeOrder) => ['OPEN', 'NEW', 'PARTIALLY_FILLED'].includes(order.status);
async function accountFor(userId: string, id: string, write = false) {
  const account = await ownedAccount(userId, id);
  if (!account.isActive || !['TESTNET', 'DEMO'].includes(account.environment)) throw new ApiError(409, 'Aktif demo/testnet hesabı seçin.', 'ORDER_ACCOUNT_UNAVAILABLE');
  if (write && (!account.canTrade || account.connectionStatus !== 'CONNECTED' || account.executionEngine !== 'GO')) throw new ApiError(409, 'Emir yönetimi için Go Engine üzerinden bağlı, işleme açık hesap gerekir.', 'ORDER_ACCOUNT_NOT_READY');
  return account;
}
async function readOrders(account: Awaited<ReturnType<typeof accountFor>>) {
  return account.executionEngine === 'GO' ? getTradingEngineOpenOrders(account) : exchangeCall(() => adapterFor(account).getOpenOrders());
}
export async function exchangeOrders(userId: string, accountId: string) {
  const account = await accountFor(userId, accountId);
  const orders = await readOrders(account);
  const local = await prisma.tradingOrder.findMany({ where: { userId, exchangeAccountId: accountId, OR: [
    { exchangeOrderId: { in: orders.map(o => o.exchangeOrderId) } },
    { status: { in: ['SUBMITTING', 'CANCELING', 'CLOSING', 'RECONCILIATION_REQUIRED'] } },
  ] } });
  const rows = orders.map(order => {
    const stored = local.find(o => o.exchangeOrderId === order.exchangeOrderId && o.symbol === order.symbol);
    const pending = Boolean(stored && ['SUBMITTING', 'CANCELING', 'CLOSING', 'RECONCILIATION_REQUIRED'].includes(stored.status));
    return { ...order, pending, status: pending ? stored!.status : order.status,
      canCancel: !pending && active(order) && account.executionEngine === 'GO' && (account.accountType === 'SPOT' ? ['LIMIT', 'MARKET'] : ['LIMIT', 'MARKET', 'STOP_MARKET', 'STOP_LIMIT', 'TAKE_PROFIT_MARKET']).includes(order.type),
      canEdit: !pending && active(order) && account.executionEngine === 'GO' && stored?.source === 'MANUAL' && !stored.id.startsWith('ex_') && stored.status === 'OPEN' && new Prisma.Decimal(order.executedQuantity).isZero() && ['LIMIT', 'STOP_MARKET', 'TAKE_PROFIT_MARKET'].includes(order.type),
      editReason: stored?.source === 'MANUAL' ? 'Yalnız gerçekleşmemiş limit ve TP/SL emirleri düzenlenebilir.' : 'Bot koruması bot/risk ayarlarından yönetilir; dış emirlerde fiyat düzenleme henüz desteklenmiyor.' };
  });
  const pending = local.filter(o => ['SUBMITTING', 'CANCELING', 'CLOSING', 'RECONCILIATION_REQUIRED'].includes(o.status) && !orders.some(row => row.exchangeOrderId === o.exchangeOrderId && row.symbol === o.symbol));
  return { accountType: account.accountType, rows: [...rows, ...pending.map(o => ({
    exchangeOrderId: o.exchangeOrderId ?? `local:${o.id}`, clientOrderId: o.clientOrderId, symbol: o.symbol,
    side: o.side, type: o.type, status: o.status, quantity: o.quantity.toString(), executedQuantity: '0',
    price: o.price?.toString(), stopPrice: o.stopPrice?.toString(), reduceOnly: o.reduceOnly, pending: true, canEdit: false,
  }))], fetchedAt: new Date().toISOString() };
}

async function currentOrder(userId: string, accountId: string, id: string, symbol: string) {
  const account = await accountFor(userId, accountId, true);
  const order = (await readOrders(account)).find(o => o.exchangeOrderId === id && o.symbol === symbol);
  if (!order || !active(order)) throw new ApiError(409, 'Emir artık açık değil. Listeyi yenileyin.', 'ORDER_NO_LONGER_OPEN');
  return { account, order };
}

export async function cancelExchangeOrder(userId: string, accountId: string, id: string, symbol: string) {
  const { account, order } = await currentOrder(userId, accountId, id, symbol);
  if (!(account.accountType === 'SPOT' ? ['LIMIT', 'MARKET'] : ['LIMIT', 'MARKET', 'STOP_MARKET', 'STOP_LIMIT', 'TAKE_PROFIT_MARKET']).includes(order.type)) throw new ApiError(409, 'Bu emir türünün iptalini borsa uygulamasından yapın.', 'ORDER_CANCEL_UNSUPPORTED');
  // Go cancellation needs a durable local identity, including exchange-created orders.
  const localId = `ex_${hash(`${userId}:${accountId}:${symbol}:${id}`)}`;
  const existing = await prisma.tradingOrder.findFirst({ where: { userId, exchangeAccountId: accountId, exchangeOrderId: id, symbol } });
  if (!existing) await prisma.tradingOrder.upsert({ where: { id: localId }, update: {}, create: {
    id: localId, userId, exchangeAccountId: accountId, exchangeOrderId: id, idempotencyKey: localId,
    clientOrderId: order.clientOrderId || localId, symbol, side: order.side, type: order.type,
    positionSide: order.positionSide ?? null, quantity: order.quantity, price: order.price ?? null, stopPrice: order.stopPrice ?? null,
    leverage: 1, marginMode: 'ISOLATED', reduceOnly: order.reduceOnly, source: 'MANUAL', executionEngine: 'GO',
    status: order.status === 'PARTIALLY_FILLED' ? 'PARTIALLY_FILLED' : 'OPEN',
  } });
  const result = await cancelTradingEngineOrder(account, id, symbol, `cancel_${hash(`${accountId}:${symbol}:${id}`)}`);
  if (result.order.status !== 'CANCELED') throw new ApiError(409, 'İptal sonucu doğrulanamadı; yeni emir gönderilmedi.', 'CANCEL_UNCONFIRMED');
  await prisma.tradingAuditLog.create({ data: { userId, exchangeAccountId: accountId, action: 'EXCHANGE_ORDER_CANCELED', entityType: 'EXCHANGE_ORDER', entityId: id, metadata: { symbol } } });
  return result.order;
}

export async function editExchangeOrder(userId: string, accountId: string, id: string, symbol: string, value: string) {
  const { account, order } = await currentOrder(userId, accountId, id, symbol);
  const stored = await prisma.tradingOrder.findFirst({ where: { userId, exchangeAccountId: accountId, exchangeOrderId: id, symbol, source: 'MANUAL', status: 'OPEN' } });
  if (!stored || stored.id.startsWith('ex_') || !['LIMIT', 'STOP_MARKET', 'TAKE_PROFIT_MARKET'].includes(order.type) || !new Prisma.Decimal(order.executedQuantity).isZero()) throw new ApiError(409, 'Bu emir güvenli fiyat düzenleme kapsamına girmiyor.', 'ORDER_EDIT_UNSUPPORTED');
  const input: PreviewOrderInput = { exchangeAccountId: accountId, symbol, side: stored.side, type: stored.type,
    quantity: order.quantity, leverage: stored.leverage, marginMode: stored.marginMode, reduceOnly: stored.reduceOnly,
    ...(stored.positionSide === 'LONG' || stored.positionSide === 'SHORT' ? { positionSide: stored.positionSide } : {}),
    ...(order.type === 'LIMIT' ? { price: value } : { stopPrice: value }),
  };
  // Validate tick/quantity/notional before touching the original order.
  const preview = await previewTradingEngineOrder(account, input);
  if (order.type !== 'LIMIT') {
    const above = order.type === 'TAKE_PROFIT_MARKET' ? order.side === 'SELL' : order.side === 'BUY';
    if (above ? new Prisma.Decimal(value).lte(preview.markPrice) : new Prisma.Decimal(value).gte(preview.markPrice)) throw new ApiError(400, 'Tetik fiyatı mevcut piyasa fiyatını geçmiş; eski emir değiştirilmedi.', 'TRIGGER_ALREADY_REACHED');
  }
  const jobId = `edit_${hash(`${userId}:${accountId}:${symbol}:${id}`)}`;
  try { await prisma.tradingAuditLog.create({ data: { id: jobId, userId, exchangeAccountId: accountId, action: 'ORDER_EDIT_STARTED', entityType: 'EXCHANGE_ORDER', entityId: id, metadata: { symbol, value } } }); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError(409, 'Bu emir için düzenleme zaten başlatıldı. Sonucu emirler ekranından kontrol edin.', 'ORDER_EDIT_ALREADY_STARTED');
    throw error;
  }
  let canceled = false;
  const leasedBatches: string[] = [];
  try {
    const batches = await prisma.manualOrderBatch.findMany({ where: { userId, exchangeAccountId: accountId, status: { in: ['QUEUED', 'RUNNING', 'COMPLETED', 'ATTENTION'] } } });
    for (const batch of batches) {
      const plan = batch.plan as unknown as BatchPlan;
      if (!plan.items.some(i => i.slId === stored.id || i.tpId === stored.id)) continue;
      const claim = await prisma.manualOrderBatch.updateMany({ where: { id: batch.id, status: { in: ['COMPLETED', 'ATTENTION'] }, OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: new Date() } }] }, data: { leaseToken: jobId, leaseExpiresAt: new Date(Date.now() + 180_000) } });
      if (claim.count !== 1) throw new Error('Toplu işlem koruması güncelleniyor; işlem tamamlandıktan sonra düzenleyin.');
      leasedBatches.push(batch.id);
    }
    const result = await cancelExchangeOrder(userId, accountId, id, symbol);
    canceled = true;
    // A fill racing cancellation must never be replaced with the original quantity.
    if (!new Prisma.Decimal(result.executedQuantity || (order.type !== 'LIMIT' ? '0' : 'NaN')).isZero()) throw new Error('İptal sırasında gerçekleşen miktar sıfır olarak doğrulanamadı; yeni emir gönderilmedi.');
    const replacement = await prisma.tradingOrder.create({ data: {
      userId, exchangeAccountId: accountId, idempotencyKey: jobId, clientOrderId: jobId,
      symbol, side: stored.side, type: stored.type, quantity: order.quantity, leverage: stored.leverage,
      marginMode: stored.marginMode, positionSide: stored.positionSide, reduceOnly: stored.reduceOnly,
      source: 'MANUAL', executionEngine: 'GO', ...(order.type === 'LIMIT' ? { price: value } : { stopPrice: value }),
    } });
    await executeTradingEngineOrder(account, replacement, replacement);
    // Keep the existing bulk-position monitor linked to the replacement leg.
    await prisma.$transaction(async tx => {
      const batches = await tx.manualOrderBatch.findMany({ where: { id: { in: leasedBatches }, leaseToken: jobId } });
      for (const batch of batches) {
        const plan = batch.plan as unknown as BatchPlan;
        let changed = false;
        for (const item of plan.items) {
          if (item.slId === stored.id) { item.slId = replacement.id; item.stopLoss = value; changed = true; }
          if (item.tpId === stored.id) { item.tpId = replacement.id; item.takeProfit = value; changed = true; }
        }
        if (changed) await tx.manualOrderBatch.update({ where: { id: batch.id, leaseToken: jobId }, data: { plan: JSON.parse(JSON.stringify(plan)) } });
      }
      await tx.tradingAuditLog.update({ where: { id: jobId }, data: { action: 'ORDER_EDIT_COMPLETED', metadata: { symbol, value, replacementId: replacement.id } } });
    });
    return { message: 'Eski emir iptal edildi; yeni fiyatlı emir borsaya gönderildi.' };
  } catch (error) {
    if (canceled) await prisma.manualOrderBatch.updateMany({ where: { id: { in: leasedBatches }, leaseToken: jobId }, data: { status: 'ATTENTION' } });
    await prisma.tradingAuditLog.update({ where: { id: jobId }, data: { action: 'ORDER_EDIT_ATTENTION', metadata: { symbol, value, canceled } } });
    throw new ApiError(409, `${canceled ? 'Eski emir iptal edildi; yeni emrin/korumanın durumunu kontrol edin.' : 'İptal sonucu doğrulanamadı; yeni emir gönderilmedi.'} ${error instanceof Error ? error.message : ''}`, 'ORDER_EDIT_ATTENTION');
  } finally {
    await prisma.manualOrderBatch.updateMany({ where: { id: { in: leasedBatches }, leaseToken: jobId }, data: { leaseToken: null, leaseExpiresAt: null } });
  }
}
