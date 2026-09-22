import { api } from './apiClient';
export type PnlDay = { date: string; count: number; profit: string; loss: string; net: string | null };
export type PnlReport = { exchangeAccountId: string; start: string; end: string; accountingStartsAt: string; resetAt: string | null; totalNet: string | null; days: PnlDay[] };
export type PnlDetailRow = { sourceId: string; occurredAt: string; net: string; feesComplete: boolean; symbol: string | null; leverage: number | null; tradeNotional: string | null; source: string | null };
export type PnlDayDetails = { exchangeAccountId: string; date: string; profits: PnlDetailRow[]; losses: PnlDetailRow[]; summary: { totalTrades: number; totalNotional: string; totalProfit: string; totalLoss: string; totalNet: string } };
export async function getBotPnl(exchangeAccountId: string, start: string, end: string) { return (await api.get<{ data: PnlReport }>('/admin/trading/bot-pnl', { params: { exchangeAccountId, start, end } })).data.data; }
export async function getPnlDayDetails(exchangeAccountId: string, date: string) { return (await api.get<{ data: PnlDayDetails }>('/admin/trading/bot-pnl/details', { params: { exchangeAccountId, date } })).data.data; }
export async function resetBotPnl(exchangeAccountId: string) { return (await api.post('/admin/trading/bot-pnl/reset', { exchangeAccountId, confirmation: 'SIFIRLA' })).data.data; }
export const istanbulToday = () => new Date(Date.now() + 10800000).toISOString().slice(0, 10);
export function monthRange(month: string) { const [y, m] = month.split('-').map(Number); return { start: `${month}-01`, end: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }; }
export function calendarDates(month: string) {
  const { start, end } = monthRange(month), first = new Date(`${start}T00:00:00Z`), last = new Date(`${end}T00:00:00Z`);
  const from = first.getTime() - ((first.getUTCDay() + 6) % 7) * 86400000;
  const to = last.getTime() + (6 - (last.getUTCDay() + 6) % 7) * 86400000;
  return Array.from({ length: (to - from) / 86400000 + 1 }, (_, i) => new Date(from + i * 86400000).toISOString().slice(0, 10));
}
export function rangeMonths(start: string, end: string) { const months: string[] = []; for (let d = new Date(`${start.slice(0, 7)}-01T00:00:00Z`); d.toISOString().slice(0, 7) <= end.slice(0, 7); d.setUTCMonth(d.getUTCMonth() + 1)) months.push(d.toISOString().slice(0, 7)); return months; }
