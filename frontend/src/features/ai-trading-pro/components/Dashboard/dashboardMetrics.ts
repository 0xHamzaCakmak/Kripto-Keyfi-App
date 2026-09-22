import { type TradeProOperation } from '../../services/backendDashboard';

export type PerformancePeriod = '24 Saat' | '7 Gün' | '30 Gün';

export function performanceMetrics(operations: TradeProOperation[], period: PerformancePeriod = '24 Saat') {
  const duration = period === '24 Saat' ? 86_400_000 : period === '7 Gün' ? 7 * 86_400_000 : 30 * 86_400_000;
  const since = Date.now() - duration;
  const unique = new Map<string, NonNullable<TradeProOperation['fills']>[number]>();
  for (const operation of operations) for (const fill of operation.fills ?? []) {
    if (fill.reduceOnly && Date.parse(fill.occurredAt) >= since) unique.set(`${fill.tradeId}:${fill.symbol}`, fill);
  }
  const results = [...unique.values()].map((fill) => Number.isFinite(Number(fill.netRealizedPnl))
    ? Number(fill.netRealizedPnl)
    : Number(fill.realizedPnl) - (['USDT', 'USDC'].includes(fill.commissionAsset) ? Number(fill.commission) : 0));
  const wins = results.filter((value) => value > 0);
  const losses = results.filter((value) => value < 0);
  const totalWon = wins.reduce((sum, value) => sum + value, 0);
  const totalLost = losses.reduce((sum, value) => sum + value, 0);
  return {
    totalTrades: results.length,
    wins: wins.length,
    losses: losses.length,
    totalWon,
    totalLost,
    totalPnl: totalWon + totalLost,
    winRate: results.length ? wins.length / results.length * 100 : 0,
    averageWin: wins.length ? totalWon / wins.length : 0,
    averageLoss: losses.length ? totalLost / losses.length : 0,
    profitFactor: totalLost < 0 ? totalWon / Math.abs(totalLost) : totalWon > 0 ? null : 0,
  };
}
