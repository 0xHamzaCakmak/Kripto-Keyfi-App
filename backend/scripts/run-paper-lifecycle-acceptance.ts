import { randomUUID } from 'node:crypto';
import { prisma } from '../src/database/prisma.js';

const botName = 'BTC PAPER KABUL';
const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function botSnapshot() {
  return prisma.tradingBot.findFirstOrThrow({
    where: { name: botName },
    select: { id: true, userId: true, exchangeAccountId: true, state: true, desiredState: true, version: true, lastDecisionAt: true, _count: { select: { decisions: true } } },
  });
}

async function waitFor(check: (snapshot: Awaited<ReturnType<typeof botSnapshot>>) => boolean, label: string, timeoutMs = 35_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snapshot = await botSnapshot();
    if (check(snapshot)) return snapshot;
    await sleep(1000);
  }
  throw new Error(`${label} zaman aşımına uğradı.`);
}

async function transition(targetState: 'PAUSED' | 'STARTING', desiredState: 'PAUSED' | 'RUNNING', action: string) {
  const current = await botSnapshot();
  await prisma.$transaction(async (tx) => {
    const result = await tx.tradingBot.updateMany({ where: { id: current.id, version: current.version }, data: {
      state: targetState, desiredState, stateReason: `PAPER kabulü: ${action}`,
      schedulerOwner: null, leaseExpiresAt: null, version: { increment: 1 },
    } });
    if (result.count !== 1) throw new Error('Lifecycle kabul transition version conflict.');
    await tx.tradingAuditLog.create({ data: {
      userId: current.userId, exchangeAccountId: current.exchangeAccountId, action: `TRADING_BOT_ACCEPTANCE_${action}`,
      entityType: 'TRADING_BOT', entityId: current.id, metadata: { state: targetState, desiredState },
    } });
  });
}

async function accountKillSwitch(active: boolean) {
  const bot = await botSnapshot();
  await prisma.$transaction(async (tx) => {
    const profile = await tx.tradingRiskProfile.update({ where: { exchangeAccountId: bot.exchangeAccountId }, data: {
      accountKillSwitch: active, killSwitchReason: 'Kontrollü PAPER lifecycle kabulü',
    } });
    const account = await tx.exchangeAccount.findUniqueOrThrow({ where: { id: bot.exchangeAccountId }, select: { provider: true } });
    await tx.tradingAuditLog.create({ data: {
      userId: bot.userId, exchangeAccountId: bot.exchangeAccountId,
      action: active ? 'ACCOUNT_KILL_SWITCH_ACCEPTANCE_ACTIVATED' : 'ACCOUNT_KILL_SWITCH_ACCEPTANCE_RELEASED',
      entityType: 'TRADING_RISK_PROFILE', entityId: profile.id, metadata: { acceptance: true },
    } });
    await tx.tradingOutboxEvent.create({ data: {
      userId: bot.userId, exchangeAccountId: bot.exchangeAccountId, provider: account.provider, topic: 'trading.risk',
      eventType: active ? 'ACCOUNT_KILL_SWITCH_ACTIVATED' : 'ACCOUNT_KILL_SWITCH_RELEASED', aggregateType: 'ACCOUNT', aggregateId: bot.exchangeAccountId,
      deduplicationKey: `acceptance:risk:${bot.id}:${randomUUID()}`, payload: { active, acceptance: true }, occurredAt: new Date(),
    } });
  });
}

async function main() {
  await waitFor((bot) => bot.state === 'RUNNING', 'Başlangıç RUNNING');
  await transition('PAUSED', 'PAUSED', 'PAUSE');
  const paused = await waitFor((bot) => bot.state === 'PAUSED', 'PAUSED');
  const pausedDecisionCount = paused._count.decisions;
  await sleep(12_000);
  const stillPaused = await botSnapshot();
  if (stillPaused._count.decisions !== pausedDecisionCount) throw new Error('PAUSED bot karar üretmeye devam etti.');

  await transition('STARTING', 'RUNNING', 'RESUME');
  const resumed = await waitFor((bot) => bot.state === 'RUNNING' && bot._count.decisions > pausedDecisionCount, 'RESUME RUNNING');

  await accountKillSwitch(true);
  const blocked = await waitFor((bot) => bot.state === 'RISK_BLOCKED', 'RISK_BLOCKED');
  await accountKillSwitch(false);
  const recovered = await waitFor((bot) => bot.state === 'RUNNING' && bot._count.decisions > blocked._count.decisions, 'Risk recovery RUNNING');
  console.log(JSON.stringify({
    pause: { decisionsStableAt: pausedDecisionCount }, resume: { decisions: resumed._count.decisions },
    riskBlock: blocked.state, recovered: recovered.state, finalDecisions: recovered._count.decisions,
  }));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; })
  .finally(async () => {
    const bot = await prisma.tradingBot.findFirst({ where: { name: botName }, select: { exchangeAccountId: true } });
    if (bot) await prisma.tradingRiskProfile.update({ where: { exchangeAccountId: bot.exchangeAccountId }, data: { accountKillSwitch: false } }).catch(() => undefined);
    await prisma.$disconnect();
  });
