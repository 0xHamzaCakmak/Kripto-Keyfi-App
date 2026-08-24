import { prisma } from '../src/database/prisma.js';
import { ensureCoreTradingUniverse, getEnabledTradingSymbols, updateTradingUniverseAsset } from '../src/modules/ai-trading/trading-universe.service.js';
import { getCoinPerformance } from '../src/modules/ai-trading/coin-performance.service.js';

const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
if (!user) throw new Error('Core Trading Universe acceptance requires one local user.');

await ensureCoreTradingUniverse(user.id);
const before = await getEnabledTradingSymbols(user.id);
const originallyEnabled = before.includes('XLMUSDT');
try {
  await updateTradingUniverseAsset(user.id, 'XLMUSDT', false);
  const disabled = await getEnabledTradingSymbols(user.id);
  if (disabled.includes('XLMUSDT') || disabled.length !== before.length - Number(originallyEnabled)) throw new Error('Disabled Universe asset remained executable.');
  await updateTradingUniverseAsset(user.id, 'XLMUSDT', true);
  const restored = await getEnabledTradingSymbols(user.id);
  if (!restored.includes('XLMUSDT') || restored.length !== disabled.length + 1) throw new Error('Universe selection did not persist/restore.');
  const scoreBuckets = await getCoinPerformance(user.id, { limit: 500 });
  const sameCoinOpenTrades = await prisma.$queryRaw<Array<{ symbol: string; trades: bigint; bots: bigint }>>`
    SELECT t.symbol, COUNT(*) AS trades, COUNT(DISTINCT t.tradingBotId) AS bots
    FROM paper_trades t JOIN trading_bots b ON b.id = t.tradingBotId
    WHERE b.userId = ${user.id} AND t.status = 'OPEN' GROUP BY t.symbol HAVING COUNT(*) > 1
  `;
  console.log(JSON.stringify({ initialAssets: before.length, disabledAssets: disabled.length, restoredAssets: restored.length, persisted: true,
    coinStrategyRegimeScoreBuckets: scoreBuckets.length, independentSameCoinOpenGroups: sameCoinOpenTrades.filter((row) => row.trades === row.bots).length }));
} finally {
  if (!originallyEnabled) await updateTradingUniverseAsset(user.id, 'XLMUSDT', false);
  await prisma.$disconnect();
}
