import { createHash } from 'node:crypto';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { adapterFor, exchangeCall } from '../trading/exchange-account.service.js';
import type { ExchangeOrder, ExchangePosition, ExchangeTrade } from '../trading/exchanges/exchange-adapter.js';
import { getTradingEngineSnapshot } from '../trading/trading-engine.client.js';
import { autonomousDTO } from './autonomous-admin.service.js';

const CACHE_MS = 15_000;
type Cached = { expiresAt: number; value: Awaited<ReturnType<typeof loadOperations>> };
const cache = new Map<string, Cached>();
const inFlight = new Map<string, Promise<Awaited<ReturnType<typeof loadOperations>>>>();

export async function listTestnetBotOperations(userId: string) {
  const value = await cachedOperations(userId);
  return autonomousDTO('TESTNET_BOT_OPERATIONS', value.map(({ fills: _fills, ...summary }) => summary));
}

export async function getTestnetBotOperation(userId: string, botId: string) {
  const value = await cachedOperations(userId);
  const operation = value.find((item) => item.botId === botId);
  if (!operation) throw new ApiError(404, 'TESTNET bot operasyon kaydı bulunamadı.', 'TESTNET_BOT_OPERATION_NOT_FOUND');
  return autonomousDTO('TESTNET_BOT_OPERATION', operation);
}

async function cachedOperations(userId: string) {
  const existing = cache.get(userId);
  if (existing && existing.expiresAt > Date.now()) return existing.value;
  const pending = inFlight.get(userId);
  if (pending) return pending;
  const refresh = loadOperations(userId)
    .then((value) => {
      cache.set(userId, { expiresAt: Date.now() + CACHE_MS, value });
      return value;
    })
    .finally(() => { inFlight.delete(userId); });
  inFlight.set(userId, refresh);
  return refresh;
}

async function loadOperations(userId: string) {
  const account = await prisma.exchangeAccount.findFirst({
    where: { userId, provider: 'BINANCE', environment: 'TESTNET', accountType: 'USDT_M', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!account) return [];
  const bots = await prisma.tradingBot.findMany({
    where: { userId, exchangeAccountId: account.id, type: 'AUTONOMOUS', mode: 'DEMO' },
    select: { id: true, name: true, symbol: true, state: true, desiredState: true, configuration: true, startingPaperBalance: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (bots.length === 0) return [];
  const prefixes = new Map(bots.map((bot) => [bot.id, botPrefix(bot.id)]));
  const localOrders = await prisma.tradingOrder.findMany({
    where: {
      userId, exchangeAccountId: account.id, source: 'SYSTEM',
      OR: [...prefixes.values()].map((prefix) => ({ clientOrderId: { startsWith: prefix } })),
    },
    select: { exchangeOrderId: true, clientOrderId: true, symbol: true, type: true, reduceOnly: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' }, take: 2_000,
  });
  const [snapshot, trades] = await Promise.all([
    loadTradingEngineSnapshot(account),
    loadActualTrades(account, [...new Set(localOrders.map((order) => order.symbol))]),
  ]);
  const localByExchangeOrder = new Map(localOrders.filter((order) => order.exchangeOrderId)
    .map((order) => [`${order.symbol}:${order.exchangeOrderId}`, order]));
  const actual = trades.flatMap((trade) => {
    const local = localByExchangeOrder.get(`${trade.symbol}:${trade.exchangeOrderId}`);
    if (!local) return [];
    const bot = bots.find((item) => local.clientOrderId.startsWith(prefixes.get(item.id)!));
    if (!bot) return [];
    return [{
      ...trade, botId: bot.id, orderType: local.type, reduceOnly: local.reduceOnly,
      netRealizedPnl: netPnl(trade),
    }];
  }).sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));

  return bots.map((bot) => {
    const prefix = prefixes.get(bot.id)!;
    const position = snapshot.positions.find((item) => item.symbol === bot.symbol) ?? null;
    const protection = snapshot.orders.filter((item) => item.symbol === bot.symbol && item.clientOrderId.startsWith(prefix));
    const fills = actual.filter((item) => item.botId === bot.id).slice(0, 200);
    const realizedPnl = fills.reduce((sum, item) => sum + Number(item.realizedPnl), 0);
    const commission = fills.filter((item) => item.commissionAsset === 'USDT').reduce((sum, item) => sum + Number(item.commission), 0);
    const closing = fills.filter((item) => item.reduceOnly && Number(item.realizedPnl) !== 0);
    return {
      botId: bot.id, name: bot.name, symbol: bot.symbol, state: bot.state, desiredState: bot.desiredState,
      allocationUsdt: numericConfig(bot.configuration, 'allocationUsdt') ?? Number(bot.startingPaperBalance),
      configuredLeverage: numericConfig(bot.configuration, 'leverage'),
      position: position ? positionView(position) : null,
      stopLoss: trigger(protection, 'STOP_MARKET'), takeProfit: trigger(protection, 'TAKE_PROFIT_MARKET'),
      realizedPnl: realizedPnl.toFixed(8), commission: commission.toFixed(8),
      netRealizedPnl: (realizedPnl - commission).toFixed(8), totalFills: fills.length,
      entryFills: fills.filter((item) => !item.reduceOnly).length,
      closedFills: closing.length, wins: closing.filter((item) => Number(item.realizedPnl) > 0).length,
      losses: closing.filter((item) => Number(item.realizedPnl) < 0).length, fills,
    };
  });
}

async function loadTradingEngineSnapshot(account: Parameters<typeof getTradingEngineSnapshot>[0]) {
  try {
    return await getTradingEngineSnapshot(account);
  } catch (firstError) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    try { return await getTradingEngineSnapshot(account); }
    catch { throw firstError; }
  }
}

async function loadActualTrades(account: Parameters<typeof adapterFor>[0], symbols: string[]) {
  const adapter = adapterFor(account);
  if (!adapter.getUserTrades) throw new ApiError(409, 'Bağlı borsa gerçek fill geçmişini desteklemiyor.', 'EXCHANGE_TRADE_HISTORY_UNAVAILABLE');
  const result: ExchangeTrade[] = [];
  for (let index = 0; index < symbols.length; index += 4) {
    const batch = symbols.slice(index, index + 4);
    const rows = await Promise.all(batch.map((symbol) => exchangeCall(() => adapter.getUserTrades!(symbol, 1000))));
    result.push(...rows.flat());
  }
  return result;
}

function botPrefix(botId: string) { return `ka${createHash('sha256').update(botId).digest('hex').slice(0, 8)}`; }
function numericConfig(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const number = Number((value as Record<string, unknown>)[key]);
  return Number.isFinite(number) ? number : null;
}
function trigger(orders: ExchangeOrder[], type: string) { return orders.find((item) => item.type === type)?.stopPrice ?? null; }
function netPnl(trade: ExchangeTrade) { return Number(trade.realizedPnl) - (trade.commissionAsset === 'USDT' ? Number(trade.commission) : 0); }
function positionView(position: ExchangePosition) {
  const notional = Math.abs(Number(position.quantity) * Number(position.markPrice));
  const margin = notional / Math.max(Number(position.leverage), 1);
  const pnl = Number(position.unrealizedPnl);
  return { ...position, notional: notional.toFixed(8), margin: margin.toFixed(8), roi: margin > 0 ? pnl / margin : 0 };
}
