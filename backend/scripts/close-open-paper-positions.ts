import { prisma } from '../src/database/prisma.js';
import { requestPaperPositionClose } from '../src/modules/ai-trading/autonomous-admin.service.js';

const confirmation = process.argv.find((argument) => argument.startsWith('--confirm='))?.slice('--confirm='.length);
const stopBots = process.argv.includes('--stop-bots');

async function main() {
  const open = await prisma.paperTrade.findMany({
    where: {
      status: 'OPEN',
      tradingBot: { type: 'AUTONOMOUS', mode: 'PAPER', lifecycleStatus: { not: 'ARCHIVED' } },
    },
    select: { id: true, tradingBotId: true, symbol: true, tradingBot: { select: { userId: true, name: true } } },
    orderBy: [{ openedAt: 'asc' }, { id: 'asc' }],
  });
  console.log(JSON.stringify({ openPositions: open.length, stopBots, bots: open.map((item) => ({ id: item.tradingBotId, name: item.tradingBot.name, symbol: item.symbol })) }, null, 2));
  if (!open.length) return;
  if (confirmation !== 'CLOSE_ALL_OPEN_PAPER') {
    throw new Error('No changes applied. Re-run with --confirm=CLOSE_ALL_OPEN_PAPER and optionally --stop-bots.');
  }
  for (const trade of open) {
    await requestPaperPositionClose(trade.tradingBot.userId, trade.tradingBotId, {
      stopBot: stopBots,
      note: stopBots ? 'Admin bulk-closed local PAPER positions and stopped bots.' : 'Admin bulk-closed local PAPER positions.',
    });
  }
  console.log(JSON.stringify({ queued: open.length, stopBots }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
