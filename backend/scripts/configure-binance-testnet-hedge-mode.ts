import 'dotenv/config';
import { prisma } from '../src/database/prisma.js';
import { adapterFor } from '../src/modules/trading/exchange-account.service.js';

const CONFIRMATION = 'ENABLE_BINANCE_TESTNET_HEDGE_MODE';
const confirmed = process.argv.includes(`--confirm=${CONFIRMATION}`);

async function main() {
  const accounts = await prisma.exchangeAccount.findMany({
    where: { provider: 'BINANCE', environment: 'TESTNET', accountType: 'USDT_M', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (accounts.length !== 1) throw new Error(`Tam bir aktif Binance TESTNET USD-M hesabi bekleniyordu; ${accounts.length} bulundu.`);
  const account = accounts[0]!;
  const adapter = adapterFor(account);
  if (!adapter.getHedgeMode || !adapter.setHedgeMode) throw new Error('Borsa adapteri Hedge Mode yonetimini desteklemiyor.');
  const [hedgeMode, positions, orders, inFlightOrders] = await Promise.all([
    adapter.getHedgeMode(), adapter.getPositions(), adapter.getOpenOrders(),
    prisma.tradingOrder.count({ where: { exchangeAccountId: account.id, status: { in: ['PENDING', 'SUBMITTING', 'OPEN', 'PARTIALLY_FILLED', 'CANCELING', 'CLOSING', 'RECONCILIATION_REQUIRED'] } } }),
  ]);
  const nonFlat = positions.filter((position) => Number(position.quantity) !== 0);
  console.log(JSON.stringify({
    status: hedgeMode ? 'HEDGE_MODE_ALREADY_ENABLED' : confirmed ? 'HEDGE_MODE_CHANGE_CONFIRMED' : 'DRY_RUN',
    account: { id: account.id, name: account.name }, hedgeMode, openPositions: nonFlat.length,
    exchangeOpenOrders: orders.length, databaseInFlightOrders: inFlightOrders,
    confirmationRequired: hedgeMode || confirmed ? null : CONFIRMATION,
  }, null, 2));
  if (hedgeMode || !confirmed) return;
  if (nonFlat.length || orders.length || inFlightOrders) {
    throw new Error('GUVENLIK: Hedge Mode yalnizca borsa pozisyonlari, borsa emirleri ve DB bekleyen emirleri sifirken etkinlestirilebilir.');
  }
  await adapter.setHedgeMode(true);
  if (!await adapter.getHedgeMode()) throw new Error('Binance Hedge Mode degisikligi dogrulanamadi.');
  await prisma.tradingAuditLog.create({ data: {
    userId: account.userId, exchangeAccountId: account.id, action: 'BINANCE_TESTNET_HEDGE_MODE_ENABLED',
    entityType: 'EXCHANGE_ACCOUNT', entityId: account.id,
    metadata: { dualSidePosition: true, verified: true, openPositions: 0, openOrders: 0, productionLive: false },
  } });
  console.log(JSON.stringify({ status: 'HEDGE_MODE_ENABLED_AND_VERIFIED', nextEnvironmentSetting: 'AI_TRADING_HEDGE_MODE_ENABLED=true' }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
