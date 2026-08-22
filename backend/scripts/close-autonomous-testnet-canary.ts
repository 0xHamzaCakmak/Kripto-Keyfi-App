import { randomUUID } from 'node:crypto';
import { prisma } from '../src/database/prisma.js';
import { env } from '../src/config/env.js';
import { cancelTradingEngineOrder, getTradingEngineSnapshot } from '../src/modules/trading/trading-engine.client.js';

async function main() {
  if (!process.argv.includes('--confirm=CLOSE_BINANCE_TESTNET')) throw new Error('Exact --confirm=CLOSE_BINANCE_TESTNET is required.');
  const bot = await prisma.tradingBot.findFirstOrThrow({ where: { type: 'AUTONOMOUS', mode: 'DEMO' }, select: { id: true, userId: true, exchangeAccountId: true, symbol: true, exchangeAccount: { select: { id: true, userId: true, provider: true, environment: true, accountType: true } } } });
  await prisma.tradingBot.update({
    where: { id: bot.id },
    data: {
      state: 'PAUSED', desiredState: 'PAUSED', schedulerOwner: null, leaseExpiresAt: null,
      stateReason: 'TESTNET canary close/pause requested.', version: { increment: 1 },
    },
  });
  const snapshot = await getTradingEngineSnapshot(bot.exchangeAccount);
  const protectiveOrders = snapshot.orders.filter((item) => item.symbol === bot.symbol && item.reduceOnly && (item.type === 'STOP_MARKET' || item.type === 'STOP_LIMIT'));
  for (const order of protectiveOrders) {
    try {
      await cancelTradingEngineOrder(bot.exchangeAccount, order.exchangeOrderId, bot.symbol, `autonomous_stop_cancel_${randomUUID().replaceAll('-', '')}`);
    } catch (error) {
      const refreshed = await getTradingEngineSnapshot(bot.exchangeAccount);
      const stillOpen = refreshed.orders.some((item) => item.exchangeOrderId === order.exchangeOrderId);
      const stillPositioned = refreshed.positions.some((item) => item.symbol === bot.symbol && Number(item.quantity) !== 0);
      if (!stillOpen && !stillPositioned) { console.log(JSON.stringify({ status: 'STOP_TRIGGERED_AND_FLAT', symbol: bot.symbol })); return; }
      throw error;
    }
  }
  const position = snapshot.positions.find((item) => item.symbol === bot.symbol && Number(item.quantity) !== 0);
  if (!position) { console.log(JSON.stringify({ status: 'ALREADY_FLAT', symbol: bot.symbol })); return; }
  const token = randomUUID().replaceAll('-', ''); const orderId = `auto_recovery_${token}`; const clientOrderId = `kax${token.slice(0, 30)}`; const idempotencyKey = `autonomous_recovery_${token}`;
  const side = position.side === 'LONG' ? 'SELL' : 'BUY'; const now = new Date();
  await prisma.tradingOrder.create({ data: { id: orderId, userId: bot.userId, exchangeAccountId: bot.exchangeAccountId, previewId: null, idempotencyKey, clientOrderId, symbol: bot.symbol, side, type: 'MARKET', quantity: position.quantity, leverage: 1, marginMode: 'ISOLATED', reduceOnly: true, source: 'SYSTEM', executionEngine: 'GO', status: 'SUBMITTING', createdAt: now, updatedAt: now } });
  const response = await fetch(new URL('/internal/v1/execution/orders', env.TRADING_ENGINE_URL), { method: 'POST', headers: { Authorization: `Bearer ${env.TRADING_ENGINE_TOKEN}`, 'Content-Type': 'application/json', 'X-Request-ID': randomUUID() }, body: JSON.stringify({ meta: { requestId: randomUUID(), actorUserId: bot.userId, idempotencyKey, clientOrderId, requestedAt: now.toISOString() }, tradingOrderId: orderId, account: bot.exchangeAccount, symbol: bot.symbol, side, type: 'MARKET', quantity: position.quantity, leverage: 1, marginMode: 'ISOLATED', reduceOnly: true }), signal: AbortSignal.timeout(15_000) });
  const body: unknown = await response.json(); if (!response.ok) throw new Error(`Emergency close failed: ${JSON.stringify(body)}`);
  await prisma.tradingAuditLog.create({ data: { userId: bot.userId, exchangeAccountId: bot.exchangeAccountId, action: 'AI_TESTNET_CANARY_EMERGENCY_CLOSED', entityType: 'TRADING_BOT', entityId: bot.id, metadata: { symbol: bot.symbol, side, quantity: position.quantity, environment: 'TESTNET', productionLive: false, orderId } } });
  const verified = await getTradingEngineSnapshot(bot.exchangeAccount); const remaining = verified.positions.find((item) => item.symbol === bot.symbol && Number(item.quantity) !== 0);
  if (remaining) throw new Error(`Emergency close could not verify flat position: ${remaining.quantity}`);
  console.log(JSON.stringify({ status: 'CLOSED_AND_FLAT', symbol: bot.symbol, side, quantity: position.quantity, orderId }));
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }).finally(() => prisma.$disconnect());
