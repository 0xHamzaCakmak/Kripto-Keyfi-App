import { prisma } from '../src/database/prisma.js';
import { env } from '../src/config/env.js';

async function main() {
  if (!process.argv.includes('--confirm=ENABLE_BINANCE_TESTNET')) throw new Error('Exact --confirm=ENABLE_BINANCE_TESTNET is required.');
  if (!env.AUTONOMOUS_TESTNET_EXECUTION_ENABLED || !env.TRADING_ENGINE_EXECUTION_ENABLED) throw new Error('TESTNET execution flags are disabled.');
  const existing = await prisma.tradingBot.findFirst({ where: { type: 'AUTONOMOUS', mode: 'DEMO' }, select: { id: true, userId: true, exchangeAccountId: true, name: true, desiredState: true, version: true, exchangeAccount: { select: { provider: true, environment: true, executionEngine: true, connectionStatus: true, isActive: true } } } });
  if (existing?.desiredState === 'RUNNING') { console.log(JSON.stringify({ status: 'ALREADY_ACTIVE', bot: existing })); return; }
  if (existing) {
    const [profile, control] = await Promise.all([
      prisma.tradingRiskProfile.findUnique({ where: { exchangeAccountId: existing.exchangeAccountId }, select: { enabled: true, accountKillSwitch: true, stopLossRequired: true, marginModePolicy: true } }),
      prisma.tradingRiskControl.findUnique({ where: { id: 'global' }, select: { globalKillSwitch: true } }),
    ]);
    const account = existing.exchangeAccount;
    if (!account.isActive || account.provider !== 'BINANCE' || account.environment !== 'TESTNET' || account.executionEngine !== 'GO' || account.connectionStatus !== 'CONNECTED') throw new Error('TESTNET account is not write-ready.');
    if (!profile?.enabled || profile.accountKillSwitch || !profile.stopLossRequired || profile.marginModePolicy !== 'ISOLATED_ONLY' || (control?.globalKillSwitch ?? true)) throw new Error('Risk gate is closed.');
    await prisma.$transaction(async (tx) => {
      const changed = await tx.tradingBot.updateMany({ where: { id: existing.id, version: existing.version, mode: 'DEMO', desiredState: 'PAUSED' }, data: { state: 'STARTING', desiredState: 'RUNNING', schedulerOwner: null, leaseExpiresAt: null, stateReason: 'Explicit Binance TESTNET canary reactivation.', version: { increment: 1 } } });
      if (changed.count !== 1) throw new Error('Bot changed concurrently.');
      await tx.tradingAuditLog.create({ data: { userId: existing.userId, exchangeAccountId: existing.exchangeAccountId, action: 'AI_TESTNET_CANARY_REACTIVATED', entityType: 'TRADING_BOT', entityId: existing.id, metadata: { confirmation: 'ENABLE BINANCE TESTNET', environment: 'TESTNET', productionLive: false, maxActiveCanaries: 1, source: 'CLI' } } });
    });
    console.log(JSON.stringify({ status: 'REACTIVATED', bot: { id: existing.id, name: existing.name }, environment: 'TESTNET', productionLive: false }));
    return;
  }
  const candidates = await prisma.tradingBot.findMany({
    where: { type: 'AUTONOMOUS', mode: 'PAPER', lifecycleStatus: 'PAPER', state: 'RUNNING', exchangeAccount: { provider: 'BINANCE', environment: 'TESTNET', executionEngine: 'GO', connectionStatus: 'CONNECTED', isActive: true } },
    select: { id: true, userId: true, exchangeAccountId: true, name: true, version: true, configuration: true, paperPosition: { select: { netQuantity: true } }, metrics: { orderBy: [{ score: 'desc' }, { snapshotAt: 'desc' }], take: 1, select: { score: true } } },
  });
  const eligible = candidates.filter((bot) => !bot.paperPosition || bot.paperPosition.netQuantity.isZero()).filter((bot) => {
    const config = bot.configuration && typeof bot.configuration === 'object' && !Array.isArray(bot.configuration) ? bot.configuration as Record<string, unknown> : {};
    const leverage = Number(config.leverage); return leverage >= 5 && leverage <= 20 && config.marginMode === 'ISOLATED' && Number(config.stopLossBps) > 0 && Number(config.takeProfitBps) > 0;
  }).sort((a, b) => Number(b.metrics[0]?.score ?? -Infinity) - Number(a.metrics[0]?.score ?? -Infinity));
  const bot = eligible[0]; if (!bot) throw new Error('No flat, <=2x isolated PAPER bot is eligible for TESTNET canary.');
  await prisma.$transaction(async (tx) => {
    const [profile, control] = await Promise.all([
      tx.tradingRiskProfile.findUnique({ where: { exchangeAccountId: bot.exchangeAccountId }, select: { enabled: true, accountKillSwitch: true, stopLossRequired: true, marginModePolicy: true } }),
      tx.tradingRiskControl.findUnique({ where: { id: 'global' }, select: { globalKillSwitch: true } }),
    ]);
    if (!profile?.enabled || profile.accountKillSwitch || !profile.stopLossRequired || profile.marginModePolicy !== 'ISOLATED_ONLY' || (control?.globalKillSwitch ?? true)) throw new Error('Risk gate is closed.');
    const changed = await tx.tradingBot.updateMany({ where: { id: bot.id, version: bot.version, mode: 'PAPER', lifecycleStatus: 'PAPER' }, data: { mode: 'DEMO', state: 'STARTING', desiredState: 'RUNNING', schedulerOwner: null, leaseExpiresAt: null, stateReason: 'Explicit Binance TESTNET canary activation.', version: { increment: 1 } } });
    if (changed.count !== 1) throw new Error('Bot changed concurrently.');
    await tx.tradingAuditLog.create({ data: { userId: bot.userId, exchangeAccountId: bot.exchangeAccountId, action: 'AI_TESTNET_CANARY_ACTIVATED', entityType: 'TRADING_BOT', entityId: bot.id, metadata: { confirmation: 'ENABLE BINANCE TESTNET', environment: 'TESTNET', productionLive: false, maxActiveCanaries: 1, source: 'CLI' } } });
  });
  console.log(JSON.stringify({ status: 'ACTIVATED', bot: { id: bot.id, name: bot.name }, environment: 'TESTNET', productionLive: false }));
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }).finally(() => prisma.$disconnect());
