import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
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
const accountSummaryCache = new Map<string, { expiresAt: number; value: Awaited<ReturnType<typeof loadAccountSummary>> }>();

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

export async function getTestnetAccountSummary(userId: string) {
  const existing = accountSummaryCache.get(userId);
  if (existing && existing.expiresAt > Date.now()) return autonomousDTO('TESTNET_ACCOUNT_SUMMARY', existing.value);
  // Account equity and open positions must remain observable even when the
  // exchange's historical-trades endpoint is temporarily unavailable.
  const operations = await cachedOperations(userId).catch(() => []);
  const value = await loadAccountSummary(userId, operations);
  accountSummaryCache.set(userId, { expiresAt: Date.now() + CACHE_MS, value });
  return autonomousDTO('TESTNET_ACCOUNT_SUMMARY', value);
}

export async function resetTestnetAccountingCheckpoint(userId: string, note: string, ipAddress?: string) {
  const account = await activeTestnetAccount(userId);
  if (!account) throw new ApiError(409, 'Aktif Binance TESTNET hesabı bulunamadı.', 'TESTNET_ACCOUNT_NOT_FOUND');
  const snapshot = await loadTradingEngineSnapshot(account);
  const financials = accountFinancials(snapshot);
  const current = await prisma.testnetAccountingCheckpoint.findUnique({ where: { exchangeAccountId: account.id } });
  const checkpoint = await prisma.testnetAccountingCheckpoint.upsert({
    where: { exchangeAccountId: account.id },
    create: {
      exchangeAccountId: account.id, userId, number: 1,
      baselineWalletBalance: new Prisma.Decimal(financials.totalBalance),
      baselineUnrealizedPnl: new Prisma.Decimal(financials.unrealizedPnl), note, startedAt: new Date(),
    },
    update: {
      number: (current?.number ?? 0) + 1,
      baselineWalletBalance: new Prisma.Decimal(financials.totalBalance),
      baselineUnrealizedPnl: new Prisma.Decimal(financials.unrealizedPnl), note, startedAt: new Date(),
    },
  });
  await prisma.tradingAuditLog.create({ data: {
    userId, exchangeAccountId: account.id, action: 'AI_TESTNET_ACCOUNTING_CHECKPOINT_RESET',
    entityType: 'TESTNET_ACCOUNTING_CHECKPOINT', entityId: account.id,
    metadata: { checkpointNumber: checkpoint.number, positionsPreserved: true, ordersCanceled: false, productionLive: false },
    ...(ipAddress ? { ipAddress } : {}),
  } });
  accountSummaryCache.delete(userId);
  return autonomousDTO('TESTNET_ACCOUNTING_CHECKPOINT', checkpointView(checkpoint, financials));
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
    select: { id: true, name: true, symbol: true, state: true, desiredState: true, configuration: true, startingPaperBalance: true, strategyVersionId: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (bots.length === 0) return [];
  const recentDecisions = await prisma.tradingBotDecision.findMany({
    where: { userId, tradingBotId: { in: bots.map((bot) => bot.id) }, occurredAt: { gte: new Date(Date.now() - 60 * 60_000) } },
    select: { tradingBotId: true, kind: true, summary: true, occurredAt: true },
    orderBy: { occurredAt: 'desc' }, take: 10_000,
  });
  const prefixes = new Map(bots.map((bot) => [bot.id, botPrefix(bot.id)]));
  const localOrders = await prisma.tradingOrder.findMany({
    where: {
      userId, exchangeAccountId: account.id, source: 'SYSTEM',
      OR: [...prefixes.values()].map((prefix) => ({ clientOrderId: { startsWith: prefix } })),
    },
    select: { exchangeOrderId: true, clientOrderId: true, symbol: true, type: true, reduceOnly: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' }, take: 2_000,
  });
  const snapshot = await loadTradingEngineSnapshot(account);
  let historyFresh = true;
  let trades: ExchangeTrade[] = [];
  try { trades = await loadActualTrades(account, [...new Set(localOrders.map((order) => order.symbol))]); }
  catch { historyFresh = false; }
  const localByExchangeOrder = new Map(localOrders.filter((order) => order.exchangeOrderId)
    .map((order) => [`${order.symbol}:${order.exchangeOrderId}`, order]));
  const actual = trades.flatMap((trade) => {
    const local = localByExchangeOrder.get(`${trade.symbol}:${trade.exchangeOrderId}`);
    if (!local) return [];
    const bot = bots.find((item) => local.clientOrderId.startsWith(prefixes.get(item.id)!));
    if (!bot) return [];
    return [{
      ...trade, botId: bot.id, orderType: local.type, reduceOnly: local.reduceOnly,
      clientOrderId: local.clientOrderId, strategyVersionId: bot.strategyVersionId,
      netRealizedPnl: netPnl(trade),
    }];
  }).sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt));
  await persistActualTestnetFills(userId, account.id, actual);

  // The persisted fill ledger is the durable source for bot PnL. A temporary
  // Binance history failure must not erase previously observed fills from UI.
  const persisted = await prisma.testnetExecutionFill.findMany({
    where: { userId, exchangeAccountId: account.id, tradingBotId: { in: bots.map((bot) => bot.id) } },
    orderBy: { occurredAt: 'desc' }, take: 10_000,
  });

  return bots.map((bot) => {
    const prefix = prefixes.get(bot.id)!;
    const position = snapshot.positions.find((item) => item.symbol === bot.symbol) ?? null;
    const protection = snapshot.orders.filter((item) => item.symbol === bot.symbol && item.clientOrderId.startsWith(prefix));
    const fills = persisted.filter((item) => item.tradingBotId === bot.id).slice(0, 200).map(persistedFillView);
    const realizedPnl = fills.reduce((sum, item) => sum + Number(item.realizedPnl), 0);
    const commission = fills.filter((item) => item.commissionAsset === 'USDT').reduce((sum, item) => sum + Number(item.commission), 0);
    const closing = fills.filter((item) => item.reduceOnly && Number(item.realizedPnl) !== 0);
    const botDecisions = recentDecisions.filter((decision) => decision.tradingBotId === bot.id);
    const latestDecision = botDecisions[0] ?? null;
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
      losses: closing.filter((item) => Number(item.realizedPnl) < 0).length, fillHistoryFresh: historyFresh,
      latestDecisionKind: latestDecision?.kind ?? null, latestDecisionSummary: latestDecision?.summary ?? null,
      decisionsLastHour: {
        buy: botDecisions.filter((item) => item.kind === 'BUY').length,
        sell: botDecisions.filter((item) => item.kind === 'SELL').length,
        hold: botDecisions.filter((item) => item.kind === 'HOLD').length,
      }, fills,
    };
  });
}

async function loadAccountSummary(userId: string, operations: Awaited<ReturnType<typeof loadOperations>>) {
  const account = await activeTestnetAccount(userId);
  if (!account) return { connected: false as const, accountId: null, totalBalance: '0', availableBalance: '0', unrealizedPnl: '0', equity: '0', activeMargin: '0', activeNotional: '0', activeBots: 0, openPositions: 0, activeEntryOrders: 0 };
  const snapshot = await loadTradingEngineSnapshot(account);
  const { stableBalances, collateral, totalBalance, availableBalance, unrealizedPnl } = accountFinancials(snapshot);
  // Binance one-way mode aggregates an account position by symbol. Summing the
  // per-bot operation views would count the same exchange position repeatedly
  // when several bots trade the same symbol, so account capital comes straight
  // from the unique engine snapshot positions.
  const positions = snapshot.positions.filter((position) => Math.abs(Number(position.quantity)) > 0);
  const activeMargin = positions.reduce((sum, position) => {
    const notional = Math.abs(Number(position.quantity) * Number(position.markPrice));
    return sum + notional / Math.max(Number(position.leverage), 1);
  }, 0);
  const activeNotional = positions.reduce((sum, position) => sum + Math.abs(Number(position.quantity) * Number(position.markPrice)), 0);
  const activeEntryOrders = operations.reduce((sum, operation) => sum + activeEntryOrderCount(operation), 0);
  const activeBots = operations.filter((operation) => activeEntryOrderCount(operation) > 0).length;
  const checkpoint = await ensureAccountingCheckpoint(userId, account.id, totalBalance, unrealizedPnl);
  const walletPnl = totalBalance - Number(checkpoint.baselineWalletBalance);
  const openPnlChange = unrealizedPnl - Number(checkpoint.baselineUnrealizedPnl);
  const netPnl = walletPnl + openPnlChange;
  return {
    connected: true as const, accountId: account.id,
    totalBalance: decimalText(totalBalance), availableBalance: decimalText(availableBalance), unrealizedPnl: decimalText(unrealizedPnl),
    equity: decimalText(totalBalance + unrealizedPnl), activeMargin: decimalText(activeMargin), activeNotional: decimalText(activeNotional),
    activeBots, openPositions: positions.length, activeEntryOrders,
    walletPnl: decimalText(walletPnl), openPnlChange: decimalText(openPnlChange), netPnl: decimalText(netPnl),
    pnlPercent: Number(checkpoint.baselineWalletBalance) > 0 ? netPnl / Number(checkpoint.baselineWalletBalance) : 0,
    accounting: { number: checkpoint.number, startedAt: checkpoint.startedAt, baselineWalletBalance: checkpoint.baselineWalletBalance.toString(), baselineUnrealizedPnl: checkpoint.baselineUnrealizedPnl.toString(), note: checkpoint.note },
    collateralAssets: stableBalances.map((balance) => ({ asset: balance.asset, walletBalance: balance.walletBalance, availableBalance: balance.availableBalance, marginAvailable: balance.asset === 'USDT' || balance.marginAvailable === true })),
  };
}

async function activeTestnetAccount(userId: string) {
  return prisma.exchangeAccount.findFirst({
    where: { userId, provider: 'BINANCE', environment: 'TESTNET', accountType: 'USDT_M', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
}

function accountFinancials(snapshot: Awaited<ReturnType<typeof loadTradingEngineSnapshot>>) {
  const stableBalances = snapshot.balances.filter((balance) => balance.walletType === 'USD_M_FUTURES' && ['USDT', 'USDC'].includes(balance.asset));
  const collateral = stableBalances.filter((balance) => balance.asset === 'USDT' || balance.marginAvailable === true);
  const value = (balance: typeof stableBalances[number], field: 'walletBalance' | 'availableBalance' | 'unrealizedPnl') =>
    Number(balance[field] ?? 0) * Number(balance.priceUsdt || 1);
  return {
    stableBalances, collateral,
    totalBalance: stableBalances.reduce((sum, balance) => sum + value(balance, 'walletBalance'), 0),
    availableBalance: collateral.reduce((sum, balance) => sum + value(balance, 'availableBalance'), 0),
    unrealizedPnl: collateral.reduce((sum, balance) => sum + value(balance, 'unrealizedPnl'), 0),
  };
}

async function ensureAccountingCheckpoint(userId: string, exchangeAccountId: string, walletBalance: number, unrealizedPnl: number) {
  const existing = await prisma.testnetAccountingCheckpoint.findUnique({ where: { exchangeAccountId } });
  if (existing) return existing;
  return prisma.testnetAccountingCheckpoint.create({ data: {
    exchangeAccountId, userId, number: 1,
    baselineWalletBalance: new Prisma.Decimal(walletBalance),
    baselineUnrealizedPnl: new Prisma.Decimal(unrealizedPnl),
    note: 'Otomatik TESTNET başlangıç noktası',
  } });
}

function checkpointView(checkpoint: { number: number; startedAt: Date; baselineWalletBalance: Prisma.Decimal; baselineUnrealizedPnl: Prisma.Decimal; note: string | null }, financials: { totalBalance: number; unrealizedPnl: number }) {
  return {
    number: checkpoint.number, startedAt: checkpoint.startedAt, note: checkpoint.note,
    baselineWalletBalance: checkpoint.baselineWalletBalance.toString(), baselineUnrealizedPnl: checkpoint.baselineUnrealizedPnl.toString(),
    walletPnl: decimalText(financials.totalBalance - Number(checkpoint.baselineWalletBalance)),
    openPnlChange: decimalText(financials.unrealizedPnl - Number(checkpoint.baselineUnrealizedPnl)), netPnl: '0.00000000',
  };
}

function activeEntryOrderCount(operation: Awaited<ReturnType<typeof loadOperations>>[number]) {
  if (!operation.position) return 0;
  const latestClose = operation.fills.find((fill) => fill.reduceOnly)?.occurredAt;
  return new Set(operation.fills
    .filter((fill) => !fill.reduceOnly && (!latestClose || Date.parse(fill.occurredAt) > Date.parse(latestClose)))
    .map((fill) => fill.exchangeOrderId)).size;
}

function decimalText(value: number) { return Number.isFinite(value) ? value.toFixed(8) : '0'; }

type AttributedTestnetFill = ExchangeTrade & {
  botId: string;
  strategyVersionId: string | null;
  clientOrderId: string;
  orderType: ExchangeOrder['type'];
  reduceOnly: boolean;
  netRealizedPnl: number;
};

async function persistActualTestnetFills(userId: string, exchangeAccountId: string, fills: AttributedTestnetFill[]) {
  if (fills.length === 0) return;
  await prisma.$transaction(fills.map((fill) => prisma.testnetExecutionFill.upsert({
    where: { exchangeAccountId_symbol_tradeId: { exchangeAccountId, symbol: fill.symbol, tradeId: fill.tradeId } },
    create: {
      userId, exchangeAccountId, tradingBotId: fill.botId, strategyVersionId: fill.strategyVersionId,
      tradeId: fill.tradeId, exchangeOrderId: fill.exchangeOrderId, clientOrderId: fill.clientOrderId,
      symbol: fill.symbol, side: fill.side, orderType: fill.orderType, reduceOnly: fill.reduceOnly,
      price: new Prisma.Decimal(fill.price), quantity: new Prisma.Decimal(fill.quantity), quoteQuantity: new Prisma.Decimal(fill.quoteQuantity),
      realizedPnl: new Prisma.Decimal(fill.realizedPnl), commission: new Prisma.Decimal(fill.commission), commissionAsset: fill.commissionAsset,
      netRealizedPnl: new Prisma.Decimal(fill.netRealizedPnl), maker: fill.maker, occurredAt: new Date(fill.occurredAt),
    },
    update: {
      tradingBotId: fill.botId, strategyVersionId: fill.strategyVersionId, exchangeOrderId: fill.exchangeOrderId, clientOrderId: fill.clientOrderId,
      orderType: fill.orderType, reduceOnly: fill.reduceOnly, price: new Prisma.Decimal(fill.price), quantity: new Prisma.Decimal(fill.quantity),
      quoteQuantity: new Prisma.Decimal(fill.quoteQuantity), realizedPnl: new Prisma.Decimal(fill.realizedPnl), commission: new Prisma.Decimal(fill.commission),
      commissionAsset: fill.commissionAsset, netRealizedPnl: new Prisma.Decimal(fill.netRealizedPnl), maker: fill.maker, occurredAt: new Date(fill.occurredAt),
    },
  })));
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

function persistedFillView(fill: Awaited<ReturnType<typeof prisma.testnetExecutionFill.findMany>>[number]) {
  return {
    tradeId: fill.tradeId, exchangeOrderId: fill.exchangeOrderId, botId: fill.tradingBotId, symbol: fill.symbol,
    side: fill.side, price: fill.price.toString(), quantity: fill.quantity.toString(), quoteQuantity: fill.quoteQuantity.toString(),
    realizedPnl: fill.realizedPnl.toString(), commission: fill.commission.toString(), commissionAsset: fill.commissionAsset,
    netRealizedPnl: Number(fill.netRealizedPnl), maker: fill.maker, occurredAt: fill.occurredAt.toISOString(),
    orderType: fill.orderType, reduceOnly: fill.reduceOnly, clientOrderId: fill.clientOrderId, strategyVersionId: fill.strategyVersionId,
  };
}
