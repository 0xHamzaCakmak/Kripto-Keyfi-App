import { api } from '../../../services/apiClient';
import type { OpenOrder } from '../../../services/tradingService';
export type ProExchangeOrder = Omit<OpenOrder, 'type'> & { type: string; canEdit: boolean; canCancel?: boolean; editReason?: string };
export async function getExchangeOrders(exchangeAccountId: string) {
  return (await api.get<{ data: { rows: ProExchangeOrder[]; accountType: string; fetchedAt: string } }>('/admin/trading/exchange-orders', { params: { exchangeAccountId } })).data.data;
}
export async function cancelExchangeOrder(exchangeAccountId: string, order: ProExchangeOrder) {
  return api.post(`/admin/trading/exchange-orders/${encodeURIComponent(order.exchangeOrderId)}/cancel`, { exchangeAccountId, symbol: order.symbol });
}
export async function editExchangeOrder(exchangeAccountId: string, order: ProExchangeOrder, value: string) {
  return api.post(`/admin/trading/exchange-orders/${encodeURIComponent(order.exchangeOrderId)}/edit`, { exchangeAccountId, symbol: order.symbol, value });
}
