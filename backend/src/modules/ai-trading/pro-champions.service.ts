import { prisma } from '../../database/prisma.js';
import { ownedAccount } from '../trading/exchange-account.service.js';

export async function getProChampions(userId: string, exchangeAccountId: string) {
  await ownedAccount(userId, exchangeAccountId);
  const bots = await prisma.tradingBot.findMany({
    where: { userId, exchangeAccountId, type: 'AUTONOMOUS', mode: 'DEMO', lifecycleStatus: { not: 'ARCHIVED' } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, symbol: true, state: true, lifecycleStatus: true,
      generation: { select: { number: true } }, strategyVersion: { select: { strategy: { select: { name: true } } } },
      metrics: { orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }], take: 1 },
    },
  });
  const rows = bots.map(bot => {
    const metric = bot.metrics[0];
    const hasEvidence = Boolean(metric && metric.totalTrades > 0);
    const payload = metric?.metrics && typeof metric.metrics === 'object' && !Array.isArray(metric.metrics) ? metric.metrics : {};
    const value = (key: string) => hasEvidence && typeof payload[key] === 'number' && Number.isFinite(payload[key]) ? payload[key] as number : null;
    return { id: bot.id, name: bot.name, symbol: bot.symbol, state: bot.state, lifecycle: bot.lifecycleStatus,
      strategy: bot.strategyVersion?.strategy.name ?? null, generation: bot.generation?.number ?? null,
      score: hasEvidence ? metric?.score?.toNumber() ?? null : null,
      netPnl: hasEvidence ? metric!.netPnl.toNumber() : null,
      roi: hasEvidence && metric!.startingBalance.gt(0) ? metric!.netPnl.div(metric!.startingBalance).mul(100).toNumber() : null,
      winRate: hasEvidence ? metric!.wins / metric!.totalTrades * 100 : null,
      profitFactor: value('profitFactor'), sharpe: value('sharpe'),
      maxDrawdown: hasEvidence ? metric!.maxDrawdown.toNumber() * 100 : null,
      totalTrades: metric?.totalTrades ?? 0, snapshotAt: metric?.snapshotAt.toISOString() ?? null,
    };
  }).sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity) || (b.snapshotAt ?? '').localeCompare(a.snapshotAt ?? '') || a.id.localeCompare(b.id));
  let rank = 0;
  let previous: number | null = null;
  return { fetchedAt: new Date().toISOString(), rows: rows.map((row, index) => {
    if (row.score !== null && row.score !== previous) rank = index + 1;
    previous = row.score;
    return { ...row, rank: row.score === null ? null : rank };
  }) };
}
