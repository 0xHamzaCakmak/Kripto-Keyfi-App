import { randomUUID } from 'node:crypto';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';
import { batchJson, executeBatchEntry, executeBatchProtection, type BatchPlan } from './manual-batch.service.js';
import { ownedAccount } from './exchange-account.service.js';
import { getTradingEngineSnapshot } from './trading-engine.client.js';
import { cancelOpenOrder } from './manual-trading.service.js';

const ENTRY_CONCURRENCY = 20;

export async function runManualBatch(id: string) {
  const leaseToken = randomUUID();
  const claimed = await prisma.manualOrderBatch.updateMany({ where: { id, status: { in: ['QUEUED', 'RUNNING'] },
    OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: new Date() } }] },
    data: { status: 'RUNNING', leaseToken, leaseExpiresAt: new Date(Date.now() + 180_000) } });
  if (claimed.count !== 1) return;
  const batch = await prisma.manualOrderBatch.findUniqueOrThrow({ where: { id } });
  const plan = batch.plan as unknown as BatchPlan;
  const saveProgress = async () => {
    const saved = await prisma.manualOrderBatch.updateMany({ where: { id, leaseToken }, data: {
      plan: batchJson(plan), status: 'RUNNING', leaseExpiresAt: new Date(Date.now() + 180_000),
    } });
    if (saved.count !== 1) throw new Error(`Manual batch lease lost: ${id}`);
  };

  // Start up to twenty entries together. Binance USD-M accepts at most five
  // orders in one batchOrders request, while the engine deliberately keeps its
  // per-order risk, audit and idempotency flow. A bounded group of twenty
  // independent requests gives the campaign near-simultaneous entries without
  // allowing the API's thirty-symbol input to create an unbounded burst.
  const pendingEntries = plan.items.map((item, index) => ({ item, index })).filter(({ item }) => item.status === 'PENDING');
  for (let offset = 0; offset < pendingEntries.length; offset += ENTRY_CONCURRENCY) {
    const wave = pendingEntries.slice(offset, offset + ENTRY_CONCURRENCY);
    const results = await Promise.all(wave.map(({ item }) => executeBatchEntry(batch.userId, id, plan.input, item)));
    results.forEach((result, index) => { plan.items[wave[index]!.index] = result; });
    await saveProgress();
  }

  // Only after every entry attempt has completed, add protection sequentially.
  // A durable status write follows each coin so restart recovery can resume it.
  for (let index = 0; index < plan.items.length; index++) {
    if (plan.items[index]!.status !== 'ENTRY_FILLED') continue;
    plan.items[index] = await executeBatchProtection(batch.userId, id, plan.input, plan.items[index]!);
    await saveProgress();
  }

  const attention = plan.items.some(item => item.status === 'ATTENTION');
  const incomplete = plan.items.some(item => item.status === 'PENDING' || item.status === 'ENTRY_FILLED');
  await prisma.manualOrderBatch.updateMany({ where: { id, leaseToken }, data: {
    plan: batchJson(plan), status: incomplete ? 'QUEUED' : attention ? 'ATTENTION' : 'COMPLETED', leaseToken: null, leaseExpiresAt: null,
  } });
}

export function scheduleManualBatches() {
  let busy = false;
  const timer = setInterval(() => {
    if (busy) return;
    busy = true;
    void (async () => {
      const batches = await prisma.manualOrderBatch.findMany({ where: { status: { in: ['QUEUED', 'RUNNING'] },
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: new Date() } }] }, take: 10, orderBy: { createdAt: 'asc' } });
      for (const batch of batches) await runManualBatch(batch.id);
      const monitored = await prisma.manualOrderBatch.findMany({ where: { status: 'COMPLETED', updatedAt: { lt: new Date(Date.now() - 10_000) } }, take: 10, orderBy: { updatedAt: 'asc' } });
      for (const batch of monitored) await monitorManualBatch(batch.id);
    })().catch(error => logger.error({ error }, 'Toplu manuel işlem işleyicisi başarısız')).finally(() => { busy = false; });
  }, 2000);
  timer.unref();
  return () => clearInterval(timer);
}

// Exchange TP/SL orders survive application downtime. Cancel the remaining leg
// after a close; do not leave it attached to a later manually opened position.
export async function monitorManualBatch(id: string) {
  const leaseToken = randomUUID();
  const claim = await prisma.manualOrderBatch.updateMany({ where: { id, status: 'COMPLETED',
    OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: new Date() } }] }, data: { leaseToken, leaseExpiresAt: new Date(Date.now() + 180_000) } });
  if (claim.count !== 1) return;
  try {
    const batch = await prisma.manualOrderBatch.findUniqueOrThrow({ where: { id } });
    const plan = batch.plan as unknown as BatchPlan;
    const account = await ownedAccount(batch.userId, batch.exchangeAccountId);
    const snapshot = await getTradingEngineSnapshot(account);
    for (const item of plan.items.filter(i => i.status === 'PROTECTED')) {
      const legs = await prisma.tradingOrder.findMany({ where: { id: { in: [item.slId!, item.tpId!] }, userId: batch.userId, exchangeAccountId: account.id } });
      const side = plan.input.side === 'BUY' ? 'LONG' : 'SHORT';
      const positionRemains = snapshot.positions.some(p => p.symbol === item.symbol && p.side === side && Number(p.quantity) !== 0);
      if (positionRemains && !legs.some(l => l.status === 'FILLED')) continue;
      for (const leg of legs) {
        if (!leg.exchangeOrderId || !snapshot.orders.some(o => o.exchangeOrderId === leg.exchangeOrderId && o.symbol === item.symbol)) continue;
        await cancelOpenOrder(batch.userId, leg.exchangeOrderId, { exchangeAccountId: account.id, symbol: item.symbol, idempotencyKey: `batch_close_${leg.id}` });
      }
      item.status = 'CLOSED'; item.detail = 'Pozisyon kapandı; kalan TP/SL emirleri temizlendi.';
    }
    await prisma.manualOrderBatch.updateMany({ where: { id, leaseToken }, data: { plan: batchJson(plan),
      status: plan.items.some(i => i.status === 'PROTECTED') ? 'COMPLETED' : 'SETTLED', leaseToken: null, leaseExpiresAt: null } });
  } catch (error) {
    await prisma.manualOrderBatch.updateMany({ where: { id, leaseToken }, data: { leaseToken: null, leaseExpiresAt: null } });
    logger.warn({ batchId: id, error }, 'Toplu manuel işlem koruma emirleri kontrol edilemedi');
  }
}
