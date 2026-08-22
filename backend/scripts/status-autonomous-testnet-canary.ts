import { prisma } from '../src/database/prisma.js';
import { getTradingEngineSnapshot } from '../src/modules/trading/trading-engine.client.js';

async function main() {
  const bot = await prisma.tradingBot.findFirstOrThrow({
    where: { type: 'AUTONOMOUS', mode: 'DEMO' },
    select: {
      id: true, name: true, mode: true, state: true, desiredState: true, symbol: true,
      lastDecisionAt: true, lastErrorCode: true, lastErrorMessage: true,
      exchangeAccount: { select: { id: true, userId: true, provider: true, environment: true, accountType: true, connectionStatus: true } },
    },
  });
  const [decisions, orders, snapshot] = await Promise.all([
    prisma.tradingBotDecision.findMany({ where: { tradingBotId: bot.id }, orderBy: { id: 'desc' }, take: 5, select: { id: true, kind: true, summary: true, occurredAt: true } }),
    prisma.tradingOrder.findMany({ where: { source: 'SYSTEM', exchangeAccountId: bot.exchangeAccount.id }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, clientOrderId: true, type: true, side: true, status: true, exchangeOrderId: true, quantity: true, stopPrice: true, reduceOnly: true, createdAt: true } }),
    getTradingEngineSnapshot(bot.exchangeAccount),
  ]);
  console.log(JSON.stringify({
    bot, decisions: decisions.map((item) => ({ ...item, id: item.id.toString() })), orders,
    exchange: {
      positions: snapshot.positions.filter((item) => item.symbol === bot.symbol),
      openOrders: snapshot.orders.filter((item) => item.symbol === bot.symbol),
    },
    productionLive: false,
  }, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }).finally(() => prisma.$disconnect());
