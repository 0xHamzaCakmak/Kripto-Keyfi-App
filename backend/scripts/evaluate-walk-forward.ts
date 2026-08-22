import { Prisma } from '@prisma/client';
import { prisma } from '../src/database/prisma.js';

type Row = { userId: string; tradeId: string; variant: string; pnl: Prisma.Decimal; closedAt: Date };

async function main() {
  const rows = await prisma.$queryRaw<Row[]>(Prisma.sql`
    SELECT b.userId, t.id AS tradeId,
      COALESCE(JSON_UNQUOTE(JSON_EXTRACT(t.marketContext, '$.experimentVariant')), 'UNASSIGNED') AS variant,
      t.realizedPnl AS pnl, t.closedAt
    FROM paper_trades t JOIN trading_bots b ON b.id = t.tradingBotId
    WHERE b.type = 'AUTONOMOUS' AND b.mode = 'PAPER' AND t.status = 'CLOSED'
      AND JSON_UNQUOTE(JSON_EXTRACT(t.marketContext, '$.experimentId')) = 'ATR_STOP_WALK_FORWARD_V1'
    ORDER BY t.closedAt ASC, t.id ASC
  `);
  const groups = new Map<string, Row[]>();
  for (const row of rows) groups.set(row.variant, [...(groups.get(row.variant) ?? []), row]);
  const report = [...groups.entries()].map(([variant, trades]) => {
    const split = Math.max(1, Math.floor(trades.length * 0.70));
    const train = metrics(trades.slice(0, split));
    const test = metrics(trades.slice(split));
    return { variant, split: '70/30 chronological', train, test, minimumOutOfSampleTrades: 200,
      eligible: test.count >= 200 && test.expectancy > 0 && test.profitFactor > 1 && test.maxDrawdownPct <= 0.15 };
  });
  const userId = rows[0]?.userId ?? (await prisma.user.findFirst({ select: { id: true } }))?.id;
  if (userId) await prisma.tradingAuditLog.create({ data: {
    userId, action: 'AI_WALK_FORWARD_EVALUATED', entityType: 'EXPERIMENT', entityId: 'ATR_STOP_WALK_FORWARD_V1',
    metadata: { playbookVersion: 'TRADING_PLAYBOOK_V1', report, autoPromotion: false, productionLive: false },
  } });
  console.log(JSON.stringify({ experimentId: 'ATR_STOP_WALK_FORWARD_V1', report, autoPromotion: false, productionLive: false }, null, 2));
}

function metrics(rows: Row[]) {
  const values = rows.map((row) => row.pnl.toNumber());
  const grossProfit = values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  let equity = 100, peak = 100, maxDrawdownPct = 0;
  for (const value of values) {
    equity += value; peak = Math.max(peak, equity);
    maxDrawdownPct = Math.max(maxDrawdownPct, peak > 0 ? (peak - equity) / peak : 1);
  }
  return { count: values.length, expectancy: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0,
    winRate: values.length ? values.filter((value) => value > 0).length / values.length : 0, maxDrawdownPct };
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }).finally(() => prisma.$disconnect());
