import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { CORE_TRADING_UNIVERSE } from '../ai-trading/trading-universe.service.js';
import { ownedAccount } from './exchange-account.service.js';
import { getTradingEngineSnapshot } from './trading-engine.client.js';
import { createOrderPreview, getSymbolMarkPrice, listSymbols, submitOrder } from './manual-trading.service.js';
import type { PreviewOrderInput } from './manual-trading.schema.js';

const D = Prisma.Decimal;
export const batchInputSchema = z.object({
  exchangeAccountId: z.string().cuid(), symbols: z.array(z.string().regex(/^[A-Z0-9_]{3,40}$/)).min(1).max(30)
    .refine(v => new Set(v).size === v.length, 'Coinler tekrarlanamaz.'),
  side: z.enum(['BUY', 'SELL']), initialMargin: z.string().regex(/^\d+(\.\d{1,8})?$/).refine(v => new D(v).gt(0)),
  leverage: z.number().int().min(1).max(125),
  stopLossPercent: z.number().positive().lt(100), takeProfitPercent: z.number().positive().lt(100),
}).strict();
export type BatchInput = z.infer<typeof batchInputSchema>;
export type BatchItem = { symbol: string; quantity: string; markPrice: string; notional: string; margin: string;
  stopLoss: string; takeProfit: string; status: string; detail?: string; entryId?: string; slId?: string; tpId?: string };
export type BatchPlan = { input: BatchInput; items: BatchItem[]; totalMargin: string; totalNotional: string; leaseNote?: string };
export const batchJson = (value: BatchPlan) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

async function batchAccount(userId: string, id: string) {
  const account = await ownedAccount(userId, id);
  if (!account.isActive || !account.canTrade || account.connectionStatus !== 'CONNECTED' || account.executionEngine !== 'GO'
    || account.provider !== 'BINANCE' || account.environment !== 'TESTNET' || account.accountType !== 'USDT_M') {
    throw new ApiError(409, 'Toplu manuel işlem için bağlı Binance TESTNET vadeli hesabı gereklidir.', 'BATCH_ACCOUNT_NOT_READY');
  }
  return account;
}

export async function batchCandidates(userId: string, exchangeAccountId: string) {
  const account = await batchAccount(userId, exchangeAccountId);
  const [rules, universe, snapshot] = await Promise.all([
    listSymbols(userId, exchangeAccountId),
    prisma.tradingUniverseAsset.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
    getTradingEngineSnapshot(account),
  ]);
  const defaults = universe.length ? universe.filter(v => v.enabled).map(v => v.symbol) : CORE_TRADING_UNIVERSE.map(v => `${v[2]}USDT`);
  const availableBalance = snapshot.balances.filter(v => v.walletType === 'USD_M_FUTURES' && v.asset === 'USDT')
    .reduce((sum, v) => sum.add(v.availableBalance), new D(0)).toFixed();
  return { availableBalance, symbols: rules.map(v => ({ symbol: v.symbol, baseAsset: v.baseAsset,
    maxLeverage: v.maxLeverage, selectedByDefault: defaults.includes(v.symbol) })) };
}

export function batchLevels(markPrice: string, stepSize: string, tickSize: string, input: BatchInput) {
  const mark = new D(markPrice), tick = new D(tickSize);
  const quantity = new D(input.initialMargin).mul(input.leverage).div(mark).div(stepSize).floor().mul(stepSize);
  const long = input.side === 'BUY';
  const sl = mark.mul(new D(1).add(new D(input.stopLossPercent).div(100).mul(long ? -1 : 1))).div(tick).floor().mul(tick);
  const tp = mark.mul(new D(1).add(new D(input.takeProfitPercent).div(100).mul(long ? 1 : -1))).div(tick).floor().mul(tick);
  if (!quantity.gt(0) || !sl.gt(0) || !tp.gt(0) || (long ? !sl.lt(mark) || !tp.gt(mark) : !sl.gt(mark) || !tp.lt(mark))) {
    throw new ApiError(400, 'Teminat veya TP/SL yüzdesi paritenin fiyat/miktar adımına göre çok küçük.', 'BATCH_INVALID_LEVELS');
  }
  return { quantity: quantity.toFixed(), markPrice: mark.toFixed(), notional: quantity.mul(mark).toFixed(),
    margin: quantity.mul(mark).div(input.leverage).toFixed(), stopLoss: sl.toFixed(), takeProfit: tp.toFixed() };
}

export async function previewBatch(userId: string, input: BatchInput) {
  const account = await batchAccount(userId, input.exchangeAccountId);
  const rules = await listSymbols(userId, account.id);
  const items: BatchItem[] = [];
  // Bounded reads avoid a burst of authenticated exchange requests.
  for (const symbol of input.symbols) {
    const rule = rules.find(v => v.symbol === symbol);
    if (!rule || input.leverage > rule.maxLeverage) throw new ApiError(400, `${symbol}: parite veya kaldıraç uygun değil.`, 'BATCH_SYMBOL_INVALID');
    const { markPrice } = await getSymbolMarkPrice(userId, account.id, symbol);
    const levels = batchLevels(markPrice, rule.stepSize, rule.tickSize, input);
    if (new D(levels.quantity).lt(rule.minQuantity) || new D(levels.quantity).gt(rule.maxQuantity) || new D(levels.notional).lt(rule.minNotional)) {
      throw new ApiError(400, `${symbol}: emir miktarı borsa sınırlarını karşılamıyor.`, 'BATCH_QUANTITY_INVALID');
    }
    items.push({ symbol, ...levels, status: 'PENDING' });
  }
  const totalMargin = items.reduce((sum, i) => sum.add(i.margin), new D(0));
  const snapshot = await getTradingEngineSnapshot(account);
  const balance = snapshot.balances.filter(v => v.walletType === 'USD_M_FUTURES' && v.asset === 'USDT').reduce((sum, v) => sum.add(v.availableBalance), new D(0));
  if (totalMargin.gt(balance)) throw new ApiError(409, 'Seçili coinlerin toplam teminatı kullanılabilir bakiyeyi aşıyor.', 'INSUFFICIENT_BALANCE');
  const plan: BatchPlan = { input, items, totalMargin: totalMargin.toFixed(), totalNotional: items.reduce((sum, i) => sum.add(i.notional), new D(0)).toFixed() };
  const batch = await prisma.manualOrderBatch.create({ data: { id: randomUUID(), userId, exchangeAccountId: account.id,
    status: 'PREVIEW', expiresAt: new Date(Date.now() + 300_000), plan: batchJson(plan) } });
  return serializeBatch(batch);
}

export async function getBatch(userId: string, id: string, exchangeAccountId: string) {
  const batch = await prisma.manualOrderBatch.findFirst({ where: { id, userId, exchangeAccountId } });
  if (!batch) throw new ApiError(404, 'Toplu işlem bulunamadı.', 'BATCH_NOT_FOUND');
  return serializeBatch(batch);
}
export async function confirmBatch(userId: string, id: string, exchangeAccountId: string) {
  const batch = await getBatch(userId, id, exchangeAccountId);
  if (batch.status !== 'PREVIEW') return batch;
  if (new Date(batch.expiresAt) <= new Date()) throw new ApiError(410, 'Önizleme süresi doldu. Yeniden önizleyin.', 'BATCH_EXPIRED');
  await batchAccount(userId, exchangeAccountId);
  await prisma.$transaction(async tx => {
    const queued = await tx.manualOrderBatch.updateMany({ where: { id, userId, exchangeAccountId, status: 'PREVIEW', expiresAt: { gt: new Date() } }, data: { status: 'QUEUED' } });
    if (queued.count === 1) await tx.tradingAuditLog.create({ data: {
      userId, exchangeAccountId, action: 'MANUAL_BATCH_CONFIRMED', entityType: 'MANUAL_ORDER_BATCH', entityId: id,
      metadata: { symbols: batch.input.symbols, side: batch.input.side, leverage: batch.input.leverage,
        initialMargin: batch.input.initialMargin, stopLossPercent: batch.input.stopLossPercent,
        takeProfitPercent: batch.input.takeProfitPercent, testnet: true },
    } });
  });
  return getBatch(userId, id, exchangeAccountId);
}
function serializeBatch(batch: { id: string; exchangeAccountId: string; status: string; plan: Prisma.JsonValue; expiresAt: Date }) {
  return { id: batch.id, exchangeAccountId: batch.exchangeAccountId, status: batch.status, expiresAt: batch.expiresAt.toISOString(), ...(batch.plan as unknown as BatchPlan) };
}

async function placeBatchOrder(userId: string, batchId: string, symbol: string, leg: string, order: PreviewOrderInput) {
  const idempotencyKey = `batch_${batchId}_${symbol}_${leg}`;
  const existing = await prisma.tradingOrder.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
  if (existing) return existing;
  const preview = await createOrderPreview(userId, order);
  await submitOrder(userId, { previewId: preview.id, idempotencyKey });
  return prisma.tradingOrder.findUniqueOrThrow({ where: { userId_idempotencyKey: { userId, idempotencyKey } } });
}

export async function executeBatchEntry(userId: string, batchId: string, input: BatchInput, item: BatchItem): Promise<BatchItem> {
  const base = { exchangeAccountId: input.exchangeAccountId, symbol: item.symbol, quantity: item.quantity,
    leverage: input.leverage, marginMode: 'ISOLATED' as const };
  try {
    const entry = await placeBatchOrder(userId, batchId, item.symbol, 'entry', { ...base, side: input.side, type: 'MARKET', reduceOnly: false });
    item.entryId = entry.id;
    if (entry.status !== 'FILLED') return { ...item, status: 'ATTENTION', detail: `Giriş: ${entry.status}. Yeni emir gönderilmedi; emirler/pozisyonlar ekranını kontrol edin.` };
    return { ...item, status: 'ENTRY_FILLED', detail: 'Giriş gerçekleşti; TP/SL koruması sırada.' };
  } catch (error) {
    return { ...item, status: 'ATTENTION', detail: `${item.entryId ? 'Pozisyon açılmış olabilir; emirler/pozisyonları kontrol edin. ' : ''}${error instanceof ApiError ? error.message : 'Giriş emri sonucu doğrulanamadı; emirler ve pozisyonları kontrol edin.'}` };
  }
}

export async function executeBatchProtection(userId: string, batchId: string, input: BatchInput, item: BatchItem): Promise<BatchItem> {
  if (item.status !== 'ENTRY_FILLED') return item;
  const base = { exchangeAccountId: input.exchangeAccountId, symbol: item.symbol, quantity: item.quantity,
    leverage: input.leverage, marginMode: 'ISOLATED' as const };
  try {
    const side = input.side === 'BUY' ? 'SELL' : 'BUY';
    // Each protective leg has its own durable idempotency key; recovery never repeats a submitted entry.
    const sl = await placeBatchOrder(userId, batchId, item.symbol, 'sl', { ...base, side, type: 'STOP_MARKET', stopPrice: item.stopLoss, reduceOnly: true });
    item.slId = sl.id;
    if (!['OPEN', 'FILLED'].includes(sl.status)) return { ...item, status: 'ATTENTION', detail: `Pozisyon açıldı; SL: ${sl.status}. Koruma emirlerini kontrol edin.` };
    if (sl.status === 'FILLED') return { ...item, status: 'CLOSED', detail: 'Stop-loss gerçekleşti; TP gönderilmedi.' };
    const tp = await placeBatchOrder(userId, batchId, item.symbol, 'tp', { ...base, side, type: 'TAKE_PROFIT_MARKET', stopPrice: item.takeProfit, reduceOnly: true });
    item.tpId = tp.id;
    if (!['OPEN', 'FILLED'].includes(tp.status)) return { ...item, status: 'ATTENTION', detail: `Pozisyon ve SL açıldı; TP: ${tp.status}. Emirleri kontrol edin.` };
    return { ...item, status: 'PROTECTED', detail: 'Giriş gerçekleşti; borsaya SL ve TP emirleri gönderildi.' };
  } catch (error) {
    return { ...item, status: 'ATTENTION', detail: `Pozisyon açıldı; TP/SL emirlerini kontrol edin. ${error instanceof ApiError ? error.message : 'Koruma emri sonucu doğrulanamadı.'}` };
  }
}

export async function executeBatchItem(userId: string, batchId: string, input: BatchInput, item: BatchItem): Promise<BatchItem> {
  return executeBatchProtection(userId, batchId, input, await executeBatchEntry(userId, batchId, input, item));
}
