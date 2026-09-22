import { api } from '../../../services/apiClient';
export type ChampionRow = {
  id: string; name: string; symbol: string; state: string; lifecycle: string; strategy: string | null;
  generation: number | null; rank: number | null; score: number | null; netPnl: number | null;
  roi: number | null; winRate: number | null; profitFactor: number | null; sharpe: number | null;
  maxDrawdown: number | null; totalTrades: number; snapshotAt: string | null;
};
export async function getProChampions(exchangeAccountId: string, signal?: AbortSignal) {
  return (await api.get<{ data: { rows: ChampionRow[]; fetchedAt: string } }>('/admin/trading/pro-champions', { params: { exchangeAccountId }, signal })).data.data;
}
