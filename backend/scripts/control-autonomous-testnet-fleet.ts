import { prisma } from '../src/database/prisma.js';
import { pauseAutonomousBot, resumeAutonomousBot } from '../src/modules/ai-trading/autonomous-admin.service.js';
import { readFile, writeFile } from 'node:fs/promises';

const action = process.argv.find((value) => value.startsWith('--action='))?.slice('--action='.length);
const confirmation = process.argv.find((value) => value.startsWith('--confirm='))?.slice('--confirm='.length);
const recentMinutes = Number(process.argv.find((value) => value.startsWith('--recent-minutes='))?.slice('--recent-minutes='.length) ?? '0');
const stateFile = process.argv.find((value) => value.startsWith('--state-file='))?.slice('--state-file='.length);

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
  const changedBotIds: string[] = [];
  const skipped: Array<{ name: string; state: string }> = [];
  let maintenanceBotIds: Set<string> | null = null;
  if (action === 'pause' && stateFile) await writeFile(stateFile, '[]\n', { encoding: 'utf8', mode: 0o600 });
  if (action === 'resume' && stateFile) {
    const parsed: unknown = JSON.parse(await readFile(stateFile, 'utf8'));
    if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== 'string')) throw new Error('Maintenance state file is invalid.');
    maintenanceBotIds = new Set(parsed);
  }
  const selectedBots = maintenanceBotIds ? bots.filter((bot) => maintenanceBotIds.has(bot.id)) : bots;
  for (const bot of selectedBots) {
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
    changedBotIds.push(bot.id);
    if (action === 'pause' && stateFile) {
      // Persist after every bot so an interrupted deploy knows exactly which
      // previously-running bots belong to this maintenance window.
      await writeFile(stateFile, `${JSON.stringify(changedBotIds, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    }
  }
  console.log(JSON.stringify({ action, changed, changedBotIds, skipped, productionLive: false }, null, 2));
}

async function owner(id: string) {
  return (await prisma.tradingBot.findUniqueOrThrow({ where: { id }, select: { userId: true } })).userId;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
