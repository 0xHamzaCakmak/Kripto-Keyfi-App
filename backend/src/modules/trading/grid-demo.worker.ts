import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type TradingBot, type TradingOrder } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';
import { ApiError } from '../../utils/api-error.js';
import { adapterFor, ownedAccount } from './exchange-account.service.js';
import { executeTradingEngineOrder, cancelTradingEngineOrder } from './trading-engine.client.js';
import { GridExchangeReader } from './grid-demo-exchange.js';
import { gridConfiguration, gridJson, type GridCycle } from './grid-demo.service.js';
import { recordBotPnl } from './bot-pnl.service.js';
import { gridPnlEntries } from './grid-pnl.js';

const D = Prisma.Decimal;
const terminal = (status: string) => ['FILLED', 'CANCELED', 'CANCELLED', 'PARTIALLYFILLEDCANCELED', 'EXPIRED', 'REJECTED'].includes(status.toUpperCase());
const owner = `grid-v2:${randomUUID()}`;

export function scheduleDemoGrids() {
  let stopped = false, busy = false;
  const tick = async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      const bots = await prisma.tradingBot.findMany({ where: { type: 'GRID', mode: 'DEMO', state: { notIn: ['DRAFT', 'STOPPED'] }, configuration: { path: '$.gridVersion', equals: 2 }, OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: new Date() } }] }, take: 20, orderBy: { heartbeatAt: 'asc' } });
      for (const bot of bots) { if (stopped) break; await runDemoGrid(bot); }
    } catch (err) { logger.error({ err }, 'demo grid worker failed'); }
    finally { busy = false; }
  };
  const timer = setInterval(() => void tick(), 2000);
  timer.unref(); void tick();
  return () => { stopped = true; clearInterval(timer); };
}

export async function runDemoGrid(candidate: TradingBot) {
  const claimed = await prisma.tradingBot.updateMany({ where: { id: candidate.id, OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: new Date() } }] }, data: { schedulerOwner: owner, leaseExpiresAt: new Date(Date.now() + 60000) } });
  if (!claimed.count) return;
  const bot = await prisma.tradingBot.findUniqueOrThrow({ where: { id: candidate.id } });
  try {
    const c = gridConfiguration(bot), r = c.runtime;
    if (!c.confirmedAt) return;
    if (bot.lastErrorCode === 'GRID_RECONCILIATION_REQUIRED') {
      for (const cycle of r.cycles) {
        if (!cycle.entry) continue;
        const failed = await prisma.tradingOrder.findUnique({ where: { id: cycle.entry } });
        if (failed?.status === 'FAILED' && !failed.exchangeOrderId) {
          bot.lastErrorCode = failed.failureCode ?? 'GRID_ORDER_FAILED';
          bot.lastErrorMessage = failed.failureMessage ?? (failed.executionAttemptedAt
            ? 'Emir mutabakat sonunda başarısız olarak sonuçlandı. Yeni girişler durduruldu; emir tekrar gönderilmedi.'
            : 'Emrin borsaya gönderim kaydı oluşmadı. Go Engine bağlantısını kontrol edin. Yeni girişler durduruldu; emir tekrar gönderilmedi.');
          break;
        }
      }
    }
    const account = await ownedAccount(bot.userId, bot.exchangeAccountId);
    const adapter = adapterFor(account), reader = new GridExchangeReader(account);
    const [mark, positions, risk, global] = await Promise.all([adapter.getMarkPrice(bot.symbol), adapter.getPositions(), prisma.tradingRiskProfile.findUnique({ where: { exchangeAccountId: account.id } }), prisma.tradingRiskControl.findUnique({ where: { id: 'global' } })]);
    r.markPrice = mark;
    r.unrealized = positions.filter(p => p.symbol === bot.symbol).reduce((sum, p) => sum.add(p.unrealizedPnl), new D(0)).toFixed();
    if (bot.stateReason === 'GRID_CLOSE_REQUESTED') { r.closing = true; r.closeReason = 'Kullanıcı botu sonlandırdı.'; }
    if (new D(mark).lte(c.input.stopLowerPrice) || (c.input.stopUpperPrice && new D(mark).gte(c.input.stopUpperPrice))) { r.closing = true; r.closeReason = 'Grid stop fiyatına ulaşıldı.'; }
    if (new D(r.realized).add(r.pendingRealized ?? '0').sub(r.fees).sub(r.pendingFees ?? '0').add(r.unrealized).add(r.funding ?? '0').lte(new D(c.input.maxLoss).neg())) { r.closing = true; r.closeReason = 'Bot toplam zarar sınırına ulaşıldı.'; }
    if (positions.some(p => p.symbol === bot.symbol && p.liquidationPrice && (p.side === 'LONG' ? new D(mark).lte(new D(p.liquidationPrice).mul('1.02')) : new D(mark).gte(new D(p.liquidationPrice).mul('0.98'))))) { r.closing = true; r.closeReason = 'Likidasyon güvenlik mesafesine ulaşıldı.'; }
    const blocked = !risk?.enabled || risk.accountKillSwitch || !global || global.globalKillSwitch || !account.isActive || !account.canTrade;
    if (global?.globalKillSwitch || risk?.accountKillSwitch) { r.closing = true; r.closeReason = 'Acil risk durdurması.'; }
    const inRange = new D(mark).gt(c.input.lowerPrice) && new D(mark).lt(c.input.upperPrice);
    const mayOpen = !blocked && !risk?.entryPaused && !r.closing && inRange && bot.desiredState === 'RUNNING' && !['ERROR', 'RISK_BLOCKED'].includes(bot.state);

    const save = async () => {
      const updated = await prisma.tradingBot.updateMany({ where: { id: bot.id, schedulerOwner: owner, leaseExpiresAt: { gt: new Date() } }, data: { configuration: gridJson(c), heartbeatAt: new Date(), leaseExpiresAt: new Date(Date.now() + 60000) } });
      if (updated.count !== 1) throw new ApiError(409, 'Grid yürütme sahipliği değişti.', 'GRID_LEASE_LOST');
    };
    const submit = async (pairIndex: number, cycle: GridCycle, role: 'entry' | 'exit' | 'stop', quantity: string, market = false) => {
      const p = c.plan.pairs[pairIndex]!;
      const opening = role === 'entry';
      if (opening) {
        const current = await prisma.tradingBot.findUniqueOrThrow({ where: { id: bot.id }, select: { desiredState: true, state: true, stateReason: true } });
        if (current.desiredState !== 'RUNNING' || current.stateReason === 'GRID_CLOSE_REQUESTED' || current.state === 'ERROR') return;
        // Never send a marketable entry when price crossed a reviewed level between polls.
        const latest = new D(await adapter.getMarkPrice(bot.symbol));
        if (p.direction === 'LONG' ? latest.lte(p.entryPrice) : latest.gte(p.entryPrice)) return;
      }
      const key = `grid:${bot.id}:${p.index}:${cycle.cycle}:${role}${market ? ':close' : ''}`;
      let order = await prisma.tradingOrder.findUnique({ where: { userId_idempotencyKey: { userId: bot.userId, idempotencyKey: key } } });
      if (!order) order = await prisma.tradingOrder.create({ data: { userId: bot.userId, exchangeAccountId: bot.exchangeAccountId, idempotencyKey: key, clientOrderId: `kg_${createHash('sha256').update(key).digest('hex').slice(0,30)}`, symbol: bot.symbol, side: (p.direction === 'LONG') === opening ? 'BUY' : 'SELL', positionSide: c.hedgeMode ? p.direction : null, type: role === 'stop' ? 'STOP_MARKET' : market ? 'MARKET' : 'LIMIT', quantity, price: role !== 'stop' && !market ? opening ? p.entryPrice : p.exitPrice : null, stopPrice: role === 'stop' ? p.direction === 'LONG' ? c.input.stopLowerPrice : c.input.stopUpperPrice! : null, leverage: c.input.leverage, marginMode: 'ISOLATED', reduceOnly: !opening, source: 'GRID_BOT', executionEngine: 'GO' } });
      cycle[role] = order.id;
      await save(); // Durable intent BEFORE any network mutation; replay uses the same clientOrderId.
      if (order.status === 'FAILED') throw new ApiError(409, order.failureMessage ?? 'Grid emri reddedildi.', order.failureCode ?? 'GRID_ORDER_REJECTED');
      if (!order.exchangeOrderId) await executeTradingEngineOrder(account, order, order);
      if (opening) r.nextEntryAt = Date.now() + Math.max(1000, Math.ceil(60000 / Math.max(1, risk?.maxOrdersPerMinute ?? 1)));
    };
    const stored = (id: string) => prisma.tradingOrder.findUniqueOrThrow({ where: { id } });
    const snapshot = async (order: TradingOrder) => {
      if (order.status === 'FAILED' && !order.exchangeOrderId) return { status: 'REJECTED', executed: '0', quote: '0', fee: '0', baseFee: '0', feesComplete: true };
      if (!order.exchangeOrderId) throw new ApiError(409, 'Borsa emir sonucu kesinleşmedi; yeniden emir gönderilmiyor.', 'GRID_RECONCILIATION_REQUIRED');
      return reader.order(bot.symbol, order.exchangeOrderId, c.baseAsset, order.type === 'STOP_MARKET', order.clientOrderId);
    };
    const cancel = async (id: string) => {
      const order = await stored(id);
      const state = await snapshot(order);
      if (!terminal(state.status)) {
        await cancelTradingEngineOrder(account, order.exchangeOrderId!, bot.symbol, `grid-cancel:${order.id}`);
        return snapshot(await stored(id));
      }
      return state;
    };
    let pairError: unknown;
    // Exit/protection work always precedes new entries, including while paused or outside the range.
    for (let i = 0; i < c.plan.pairs.length; i++) {
      const cycle = r.cycles[i]!, pair = c.plan.pairs[i]!;
      if (!cycle.entry || cycle.settled) continue;
      try {
      await save();
      const entry = await stored(cycle.entry);
      let fill = await snapshot(entry);
      if ((!mayOpen || new D(fill.executed).gt(0)) && !terminal(fill.status)) fill = await cancel(cycle.entry);
      cycle.entryFill = fill;
      if (new D(fill.executed).isZero()) {
        if (terminal(fill.status)) { cycle.settled = true; }
        continue;
      }
      if (!terminal(fill.status)) continue; // Cancellation is not assumed complete from an ACK.
      const available = new D(fill.executed).sub(c.input.marketType === 'SPOT' ? fill.baseFee : '0').div(c.stepSize).floor().mul(c.stepSize);
      if (available.lte(0)) throw new ApiError(409, 'Gerçekleşen miktar borsanın çıkış adımından küçük; manuel kontrol gerekli.', 'GRID_DUST_REMAINS');
      if (cycle.exit) cycle.exitFill = await snapshot(await stored(cycle.exit));
      if (cycle.stop) {
        cycle.stopFill = await snapshot(await stored(cycle.stop));
        if (new D(cycle.stopFill.executed).gt(0)) { r.closing = true; r.closeReason = 'Borsadaki koruyucu stop gerçekleşti.'; }
        else if (terminal(cycle.stopFill.status) && new D(cycle.exitFill?.executed ?? '0').lt(available)) { r.closing = true; r.closeReason = 'Koruyucu stop aktif değil; kalan miktar kapatılıyor.'; }
      }
      if (r.closing) {
        if (cycle.exit) cycle.exitFill = await cancel(cycle.exit);
        if (cycle.stop) cycle.stopFill = await cancel(cycle.stop);
        // A cancel ACK can race with a fill. Wait for authoritative terminal states before flattening.
        if ((cycle.exitFill && !terminal(cycle.exitFill.status)) || (cycle.stopFill && !terminal(cycle.stopFill.status))) continue;
        cycle.closes ??= [];
        for (const close of cycle.closes) {
          if (!close.fill || !terminal(close.fill.status)) close.fill = await snapshot(await stored(close.id));
          if (close.fill.status === 'REJECTED') throw new ApiError(409, 'Kapatma emri reddedildi; borsa pozisyonunun kontrolü gerekli.', 'GRID_CLOSE_REJECTED');
        }
        const exited = sumFills(cycle).executed;
        const remaining = available.sub(exited);
        if (remaining.lt(0)) throw new ApiError(409, 'Kapanan miktar grid miktarını aştı; borsa pozisyonunu kontrol edin.', 'GRID_POSITION_MISMATCH');
        if (remaining.gt(0)) {
          if (cycle.closes.some(close => !close.fill || !terminal(close.fill.status))) continue;
          const closeKey = `grid-close:${bot.id}:${i}:${cycle.cycle}:${cycle.closes.length}`;
          let close = await prisma.tradingOrder.findUnique({ where: { userId_idempotencyKey: { userId: bot.userId, idempotencyKey: closeKey } } });
          if (!close) close = await prisma.tradingOrder.create({ data: { userId: bot.userId, exchangeAccountId: bot.exchangeAccountId, idempotencyKey: closeKey, clientOrderId: `kg_${createHash('sha256').update(closeKey).digest('hex').slice(0,30)}`, symbol: bot.symbol, side: pair.direction === 'LONG' ? 'SELL' : 'BUY', positionSide: c.hedgeMode ? pair.direction : null, type: 'MARKET', quantity: remaining, leverage: c.input.leverage, marginMode: 'ISOLATED', reduceOnly: true, source: 'GRID_BOT', executionEngine: 'GO' } });
          cycle.closes.push({ id: close.id }); await save();
          if (!close.exchangeOrderId) { await executeTradingEngineOrder(account, close, close); close = await stored(close.id); }
          cycle.closes[cycle.closes.length - 1]!.fill = await snapshot(close);
        }
      } else {
        if (c.input.marketType === 'FUTURES' && !cycle.stop) { await submit(i, cycle, 'stop', available.toFixed()); await save(); }
        if (!cycle.exit) { await submit(i, cycle, 'exit', available.toFixed()); await save(); }
        if (cycle.exit) cycle.exitFill = await snapshot(await stored(cycle.exit));
        if (cycle.exitFill && terminal(cycle.exitFill.status) && new D(cycle.exitFill.executed).lt(available)) {
          r.closing = true; r.closeReason = 'Grid kapanış emri iptal edildi; kalan miktar kapatılıyor.';
        }
      }
      let exit = sumFills(cycle);
      if (exit.executed.gte(available)) {
        if (cycle.stop) cycle.stopFill = await cancel(cycle.stop);
        if (cycle.stopFill && !terminal(cycle.stopFill.status)) continue;
        exit = sumFills(cycle);
        if (exit.executed.gt(available)) throw new ApiError(409, 'Stop ve kapanış miktarları çakıştı; borsa mutabakatı gerekli.', 'GRID_POSITION_MISMATCH');
        if (fill.fillsComplete === false || !exit.fillsComplete) continue;
        await recordBotPnl(bot.userId, bot.exchangeAccountId, gridPnlEntries(bot.id, bot.symbol, pair.direction, fill, [cycle.exitFill, cycle.stopFill, ...(cycle.closes ?? []).map(close => close.fill)].filter((f): f is NonNullable<typeof f> => Boolean(f))));
        const entryValue = new D(fill.quote).mul(available).div(fill.executed);
        r.realized = new D(r.realized).add(pair.direction === 'LONG' ? exit.quote.sub(entryValue) : entryValue.sub(exit.quote)).toFixed();
        r.fees = new D(r.fees).add(fill.fee).add(exit.fee).toFixed();
        r.settledFeesComplete = (r.settledFeesComplete ?? true) && fill.feesComplete && exit.feesComplete;
        if (!r.closing) r.matched += 1;
        cycle.settled = true; await save();
      }
      } catch (error) { pairError ??= error; }
    }

    for (let i = 0; i < r.cycles.length; i++) {
      const cycle = r.cycles[i]!;
      if (!cycle.entryFill || cycle.settled) continue;
      await recordBotPnl(bot.userId, bot.exchangeAccountId, gridPnlEntries(bot.id, bot.symbol, c.plan.pairs[i]!.direction, cycle.entryFill, [cycle.exitFill, cycle.stopFill, ...(cycle.closes ?? []).map(close => close.fill)].filter((f): f is NonNullable<typeof f> => Boolean(f))));
    }
    // Refresh actual funding without presenting unknown funding as zero.
    if (!r.fundingUpdatedAt || Date.now() - r.fundingUpdatedAt > 60000) { r.funding = await reader.funding(bot.symbol, new Date(c.confirmedAt)); r.fundingUpdatedAt = Date.now(); }
    r.pendingFees = '0'; r.pendingRealized = '0'; r.feesComplete = r.settledFeesComplete ?? true;
    r.cycles.forEach((cycle, i) => {
      if (cycle.settled || !cycle.entryFill || new D(cycle.entryFill.executed).isZero()) return;
      const exits = sumFills(cycle);
      r.pendingFees = new D(r.pendingFees ?? '0').add(cycle.entryFill.fee).add(exits.fee).toFixed();
      const entryValue = new D(cycle.entryFill.quote).mul(exits.executed).div(cycle.entryFill.executed);
      r.pendingRealized = new D(r.pendingRealized ?? '0').add(c.plan.pairs[i]!.direction === 'LONG' ? exits.quote.sub(entryValue) : entryValue.sub(exits.quote)).toFixed();
      r.feesComplete = r.feesComplete && cycle.entryFill.feesComplete && exits.feesComplete;
    });
    if (c.input.marketType === 'SPOT') r.unrealized = r.cycles.reduce((sum, cycle) => {
      if (cycle.settled || !cycle.entryFill) return sum;
      const remaining = new D(cycle.entryFill.executed).sub(cycle.entryFill.baseFee).sub(sumFills(cycle).executed);
      const cost = new D(cycle.entryFill.executed).gt(0) ? new D(cycle.entryFill.quote).div(cycle.entryFill.executed) : new D(0);
      return sum.add(remaining.mul(new D(mark).sub(cost)));
    }, new D(0)).toFixed();
    if (mayOpen && !pairError && !r.closing && Date.now() >= r.nextEntryAt) {
      for (let offset = 0; offset < c.plan.pairs.length; offset++) {
        const i = (r.nextPair + offset) % c.plan.pairs.length;
        let cycle = r.cycles[i]!;
        if (cycle.entry && !cycle.settled) continue;
        if (cycle.settled) { cycle = { cycle: cycle.cycle + 1 }; r.cycles[i] = cycle; }
        await submit(i, cycle, 'entry', c.plan.pairs[i]!.quantity);
        r.nextPair = (i + 1) % c.plan.pairs.length;
        if (cycle.entry) break;
      }
    }
    await save();
    if (pairError) throw pairError;
    const finished = r.closing && r.cycles.every(cycle => !cycle.entry || cycle.settled);
    // Do not overwrite a PAUSE/CLOSE request that arrived while exchange reads were in flight.
    await prisma.tradingBot.updateMany({ where: { id: bot.id, schedulerOwner: owner, desiredState: bot.desiredState, stateReason: bot.stateReason }, data: { state: finished ? 'STOPPED' : r.closing ? 'RECONCILING' : bot.state === 'ERROR' ? 'ERROR' : blocked ? 'RISK_BLOCKED' : bot.desiredState === 'RUNNING' ? 'RUNNING' : 'PAUSED', ...(finished ? { stoppedAt: new Date(), desiredState: 'STOPPED' } : {}), stateReason: r.closing ? r.closeReason ?? null : !inRange ? 'Fiyat aralık dışında; girişler bekliyor, korumalar sürüyor.' : bot.desiredState === 'RUNNING' ? 'Grid limit emirleri takip ediliyor.' : 'Yeni girişler duraklatıldı; korumalar sürüyor.', lastErrorCode: bot.state === 'ERROR' ? bot.lastErrorCode : null, lastErrorMessage: bot.state === 'ERROR' ? bot.lastErrorMessage : null } });
  } catch (error) {
    logger.error({ botId: bot.id, error: error instanceof Error ? error.message : 'unknown' }, 'grid cycle requires attention');
    await prisma.tradingBot.updateMany({ where: { id: bot.id, schedulerOwner: owner }, data: { state: 'ERROR', desiredState: 'STOPPED', lastErrorCode: error instanceof ApiError ? error.code : 'GRID_EXECUTION_FAILED', lastErrorMessage: (error instanceof Error ? error.message : 'Grid yürütmesi doğrulanamadı.').slice(0, 500) } });
  } finally {
    await prisma.tradingBot.updateMany({ where: { id: bot.id, schedulerOwner: owner }, data: { schedulerOwner: null, leaseExpiresAt: null } });
  }
}

function sumFills(cycle: GridCycle) {
 const fills = [cycle.exitFill, cycle.stopFill, ...(cycle.closes ?? []).map(c => c.fill)].filter((f): f is NonNullable<typeof f> => Boolean(f));
 return { executed: fills.reduce((sum, f) => sum.add(f.executed), new D(0)), quote: fills.reduce((sum, f) => sum.add(f.quote), new D(0)), fee: fills.reduce((sum, f) => sum.add(f.fee), new D(0)), feesComplete: fills.every(f => f.feesComplete), fillsComplete: fills.every(f => f.fillsComplete !== false) };
}
