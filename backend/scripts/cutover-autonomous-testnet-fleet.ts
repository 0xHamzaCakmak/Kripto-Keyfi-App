import 'dotenv/config';
import { prisma } from '../src/database/prisma.js';
import { env } from '../src/config/env.js';
import { activateAutonomousTestnetFleet } from '../src/modules/ai-trading/autonomous-admin.service.js';
import { updateExecutionEngine } from '../src/modules/trading/exchange-account.service.js';
import { updateKillSwitch, updateRiskProfile } from '../src/modules/trading/risk.service.js';
import { getTradingEngineSnapshot } from '../src/modules/trading/trading-engine.client.js';

const CONFIRMATION = 'CUTOVER_20_BOTS_TO_BINANCE_TESTNET';
const confirmed = process.argv.includes(`--confirm=${CONFIRMATION}`);

async function main() {
  if (!env.AUTONOMOUS_TESTNET_EXECUTION_ENABLED || !env.TRADING_ENGINE_EXECUTION_ENABLED) {
    throw new Error('TESTNET ve Go execution feature flagleri etkin olmalidir.');
  }
  const accounts = await prisma.exchangeAccount.findMany({
    where: { provider: 'BINANCE', environment: 'TESTNET', accountType: 'USDT_M', isActive: true },
    include: { riskProfile: true },
    orderBy: { createdAt: 'asc' },
  });
  if (accounts.length !== 1) throw new Error(`Tam bir aktif Binance TESTNET USD-M hesabi bekleniyordu; ${accounts.length} bulundu.`);
  const account = accounts[0]!;
  if (account.connectionStatus !== 'CONNECTED') throw new Error('Binance TESTNET hesabi CONNECTED degil.');
  if (!account.riskProfile) throw new Error('Binance TESTNET risk profili bulunamadi.');
  if (!account.riskProfile.stopLossRequired || account.riskProfile.marginModePolicy !== 'ISOLATED_ONLY') {
    throw new Error('TESTNET icin stop-loss zorunlu ve margin policy ISOLATED_ONLY olmalidir.');
  }

  const [bots, global, inFlightOrders, snapshot] = await Promise.all([
    prisma.tradingBot.findMany({
      where: { userId: account.userId, type: 'AUTONOMOUS', lifecycleStatus: { not: 'ARCHIVED' } },
      select: { id: true, name: true, mode: true, paperPosition: { select: { netQuantity: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    prisma.tradingRiskControl.findUnique({ where: { id: 'global' }, select: { globalKillSwitch: true, reason: true } }),
    prisma.tradingOrder.count({
      where: { exchangeAccountId: account.id, status: { in: ['PENDING', 'SUBMITTING', 'OPEN', 'PARTIALLY_FILLED', 'CANCELING', 'CLOSING', 'RECONCILIATION_REQUIRED'] } },
    }),
    getTradingEngineSnapshot(account),
  ]);
  if (bots.length !== env.AI_TRADING_FIXED_FLEET_SIZE || bots.some((bot) => bot.mode !== 'PAPER')) {
    throw new Error(`Tam ${env.AI_TRADING_FIXED_FLEET_SIZE} aktif PAPER botu bekleniyordu; toplam=${bots.length}, PAPER=${bots.filter((bot) => bot.mode === 'PAPER').length}.`);
  }
  const nonFlatPaper = bots.filter((bot) => bot.paperPosition && !bot.paperPosition.netQuantity.isZero());
  const exchangePositions = snapshot.positions.filter((position) => Number(position.quantity) !== 0);
  if (nonFlatPaper.length || exchangePositions.length || snapshot.orders.length || inFlightOrders) {
    throw new Error(`GUVENLIK: Gecis icin hesap tamamen bos olmalidir; PAPER acik=${nonFlatPaper.length}, Binance pozisyon=${exchangePositions.length}, Binance emir=${snapshot.orders.length}, DB bekleyen emir=${inFlightOrders}.`);
  }
  if (!global) throw new Error('Global risk kontrol kaydi bulunamadi.');

  console.log(JSON.stringify({
    status: confirmed ? 'CUTOVER_CONFIRMED' : 'DRY_RUN',
    account: { id: account.id, name: account.name, executionEngine: account.executionEngine, connectionStatus: account.connectionStatus },
    bots: bots.length,
    globalKillSwitch: global.globalKillSwitch,
    riskProfileEnabled: account.riskProfile.enabled,
    accountKillSwitch: account.riskProfile.accountKillSwitch,
    exchangePositions: exchangePositions.length,
    exchangeOrders: snapshot.orders.length,
    productionLive: false,
    confirmationRequired: confirmed ? null : CONFIRMATION,
  }, null, 2));
  if (!confirmed) return;

  const releasedGlobalKill = global.globalKillSwitch;
  const enabledRiskProfile = !account.riskProfile.enabled;
  const releasedAccountKill = account.riskProfile.accountKillSwitch;
  const changedExecutor = account.executionEngine !== 'GO';
  try {
    if (enabledRiskProfile) await updateRiskProfile(account.userId, account.id, { enabled: true });
    if (releasedAccountKill) {
      await updateKillSwitch(account.userId, { scope: 'ACCOUNT', exchangeAccountId: account.id, active: false, reason: 'Explicit 20-bot Binance TESTNET cutover.' });
    }
    if (releasedGlobalKill) {
      await updateKillSwitch(account.userId, { scope: 'GLOBAL', active: false, reason: 'Explicit 20-bot Binance TESTNET cutover.' });
    }
    if (changedExecutor) await updateExecutionEngine(account.userId, account.id, { executionEngine: 'GO' });
    const result = await activateAutonomousTestnetFleet(account.userId, {
      confirmation: 'ENABLE 20 BINANCE TESTNET BOTS',
      note: 'Explicit CLI cutover of retained 20-bot fleet to Binance TESTNET.',
    });
    console.log(JSON.stringify({ status: 'TESTNET_CUTOVER_COMPLETED', result, productionLive: false }, null, 2));
  } catch (error) {
    if (changedExecutor) {
      await updateExecutionEngine(account.userId, account.id, { executionEngine: 'TYPESCRIPT' }).catch(() => undefined);
    }
    if (releasedGlobalKill) {
      await updateKillSwitch(account.userId, { scope: 'GLOBAL', active: true, reason: 'TESTNET cutover failed; automatic safety rollback.' }).catch(() => undefined);
    }
    if (releasedAccountKill) {
      await updateKillSwitch(account.userId, { scope: 'ACCOUNT', exchangeAccountId: account.id, active: true, reason: 'TESTNET cutover failed; automatic safety rollback.' }).catch(() => undefined);
    }
    if (enabledRiskProfile) await updateRiskProfile(account.userId, account.id, { enabled: false }).catch(() => undefined);
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
