import { randomUUID } from 'node:crypto';
import { prisma } from '../src/database/prisma.js';

const acceptanceName = 'BTC PAPER KABUL';

async function main() {
  const existing = await prisma.tradingBot.findFirst({ where: { name: acceptanceName }, select: { id: true, state: true, desiredState: true } });
  if (existing) {
    console.log(JSON.stringify({ created: false, bot: existing }));
    return;
  }

  const account = await prisma.exchangeAccount.findFirst({
    where: { isActive: true, connectionStatus: 'CONNECTED', environment: { in: ['TESTNET', 'DEMO'] }, user: { role: 'ADMIN' } },
    select: { id: true, userId: true, provider: true },
  });
  if (!account) throw new Error('PAPER kabulü için bağlı admin testnet/demo hesabı bulunamadı.');

  const bot = await prisma.$transaction(async (tx) => {
    const created = await tx.tradingBot.create({
      data: {
        userId: account.userId, exchangeAccountId: account.id, name: acceptanceName,
        type: 'SCALPING', mode: 'PAPER', state: 'STARTING', desiredState: 'RUNNING', symbol: 'BTCUSDT', intervalSeconds: 10,
        stateReason: 'Kontrollü PAPER kabulü için scheduler bekleniyor.',
        configuration: {
          side: 'BOTH', quantity: '0.0001', leverage: 1, marginMode: 'ISOLATED',
          signalThresholdBps: 1, paperFeeBps: 4, paperSlippageBps: 2, acceptanceProfile: true,
        },
      },
    });
    await tx.tradingAuditLog.create({ data: {
      userId: account.userId, exchangeAccountId: account.id, action: 'TRADING_BOT_PAPER_ACCEPTANCE_STARTED',
      entityType: 'TRADING_BOT', entityId: created.id,
      metadata: { mode: 'PAPER', symbol: 'BTCUSDT', thresholdBps: 1, submittedToExchange: false },
    } });
    await tx.tradingOutboxEvent.create({ data: {
      userId: account.userId, exchangeAccountId: account.id, provider: account.provider, topic: 'trading.bot',
      eventType: 'BOT_START', aggregateType: 'TRADING_BOT', aggregateId: created.id,
      deduplicationKey: `acceptance:paper:${created.id}:${randomUUID()}`,
      payload: { botId: created.id, state: created.state, desiredState: created.desiredState, acceptance: true }, occurredAt: new Date(),
    } });
    return created;
  });
  console.log(JSON.stringify({ created: true, bot: { id: bot.id, name: bot.name, state: bot.state, desiredState: bot.desiredState } }));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }).finally(() => prisma.$disconnect());
