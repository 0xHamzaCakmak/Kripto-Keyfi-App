import { prisma } from '../src/database/prisma.js';

async function main() {
  const [manualClose, bots] = await Promise.all([
    prisma.paperTrade.aggregate({
      where: { status: 'CLOSED', closeReason: 'ADMIN_MANUAL_CLOSE' },
      _count: { _all: true }, _sum: { realizedPnl: true, fees: true },
    }),
    prisma.tradingBot.findMany({
      where: { type: 'AUTONOMOUS', mode: 'PAPER', lifecycleStatus: { not: 'ARCHIVED' } },
      select: {
        name: true, state: true,
        paperPosition: { select: { realizedPnl: true, unrealizedPnl: true, totalFees: true } },
        _count: { select: { paperTrades: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);
  console.log(JSON.stringify({
    manualClose: {
      trades: manualClose._count._all,
      realizedPnl: manualClose._sum.realizedPnl?.toString() ?? '0',
      fees: manualClose._sum.fees?.toString() ?? '0',
    },
    activeBots: bots.map((bot) => ({
      name: bot.name, state: bot.state, trades: bot._count.paperTrades,
      netPnl: bot.paperPosition
        ? bot.paperPosition.realizedPnl.sub(bot.paperPosition.totalFees).add(bot.paperPosition.unrealizedPnl).toString()
        : '0',
    })),
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
