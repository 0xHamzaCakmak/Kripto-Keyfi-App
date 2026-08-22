import { prisma } from '../src/database/prisma.js';
import { pauseAutonomousBot, resumeAutonomousBot } from '../src/modules/ai-trading/autonomous-admin.service.js';

const action = process.argv.find((value) => value.startsWith('--action='))?.slice('--action='.length);
const confirmation = process.argv.find((value) => value.startsWith('--confirm='))?.slice('--confirm='.length);
const recentMinutes = Number(process.argv.find((value) => value.startsWith('--recent-minutes='))?.slice('--recent-minutes='.length) ?? '0');

async function main() {
  if (action !== 'pause' && action !== 'resume') throw new Error('Use --action=pause or --action=resume.');
  const expected = action === 'pause' ? 'PAUSE_BINANCE_TESTNET_FLEET' : 'RESUME_BINANCE_TESTNET_FLEET';
  if (confirmation !== expected) throw new Error(`Exact --confirm=${expected} is required.`);
  const bots = await prisma.tradingBot.findMany({
    where: { type: 'AUTONOMOUS', mode: 'DEMO' },
    select: { id: true, name: true, state: true },
    orderBy: { createdAt: 'asc' },
  });
  let changed = 0;
  const skipped: Array<{ name: string; state: string }> = [];
  for (const bot of bots) {
    if (action === 'pause') {
      if (!['STARTING', 'RUNNING', 'RECONCILING', 'RISK_BLOCKED'].includes(bot.state)) {
        skipped.push({ name: bot.name, state: bot.state });
        continue;
      }
      await pauseAutonomousBot((await owner(bot.id)), bot.id);
    } else {
      if (bot.state !== 'PAUSED') {
        skipped.push({ name: bot.name, state: bot.state });
        continue;
      }
      if (recentMinutes > 0) {
        const latestPause = await prisma.tradingAuditLog.findFirst({
          where: { entityType: 'TRADING_BOT', entityId: bot.id, action: 'AI_AUTONOMOUS_BOT_PAUSED' },
          orderBy: { createdAt: 'desc' }, select: { createdAt: true },
        });
        if (!latestPause || latestPause.createdAt < new Date(Date.now() - recentMinutes * 60_000)) {
          skipped.push({ name: bot.name, state: 'PAUSED_BEFORE_MAINTENANCE' });
          continue;
        }
      }
      await resumeAutonomousBot((await owner(bot.id)), bot.id);
    }
    changed += 1;
  }
  console.log(JSON.stringify({ action, changed, skipped, productionLive: false }, null, 2));
}

async function owner(id: string) {
  return (await prisma.tradingBot.findUniqueOrThrow({ where: { id }, select: { userId: true } })).userId;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
