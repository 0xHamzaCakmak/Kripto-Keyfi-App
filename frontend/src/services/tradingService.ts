import { api } from './apiClient';

export type TradingAccount = {
  id: string; name: string; provider: 'BINANCE' | 'BYBIT'; environment: 'TESTNET' | 'DEMO';
  isActive: boolean; canTrade: boolean; connectionStatus: 'CONNECTED' | 'ERROR' | 'DISABLED';
};
export type TradingSymbol = {
  symbol: string; baseAsset: string; quoteAsset: string; tickSize: string; stepSize: string;
  minQuantity: string; maxQuantity: string; minNotional: string; maxLeverage: number;
};
export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'STOP_LIMIT';
export type MarginMode = 'ISOLATED' | 'CROSS';
export type OrderPreview = {
  id: string; exchangeAccountId: string; accountName: string; provider: 'BINANCE' | 'BYBIT'; symbol: string;
  side: OrderSide; type: OrderType; quantity: string; price?: string; stopPrice?: string; leverage: number;
  marginMode: MarginMode; reduceOnly: boolean; markPrice: string; estimatedNotional: string;
  estimatedInitialMargin: string; expiresAt: string; warnings: string[];
};
export type OpenOrder = {
  exchangeOrderId: string; clientOrderId: string; symbol: string; side: OrderSide; type: OrderType; status: string;
  quantity: string; executedQuantity: string; price?: string; stopPrice?: string; reduceOnly: boolean; createdAt?: string;
};
export type OpenPosition = {
  positionKey: string; symbol: string; side: 'LONG' | 'SHORT'; quantity: string; entryPrice: string; markPrice: string;
  liquidationPrice?: string; unrealizedPnl: string; leverage: string; marginMode: MarginMode;
};

export async function getTradingAccounts() {
  return (await api.get<{ data: TradingAccount[] }>('/admin/trading/exchange-accounts')).data.data;
}
export async function getTradingSymbols(exchangeAccountId: string) {
  return (await api.get<{ data: TradingSymbol[] }>('/admin/trading/symbols', { params: { exchangeAccountId } })).data.data;
}
export async function previewOrder(input: {
  exchangeAccountId: string; symbol: string; side: OrderSide; type: OrderType; quantity: string; price?: string;
  stopPrice?: string; leverage: number; marginMode: MarginMode; reduceOnly: boolean;
}) {
  return (await api.post<{ data: OrderPreview }>('/admin/trading/orders/preview', input)).data.data;
}
export async function confirmOrder(previewId: string) {
  return (await api.post('/admin/trading/orders', { previewId, idempotencyKey: crypto.randomUUID() })).data.data;
}
export async function getOpenOrders(exchangeAccountId: string) {
  return (await api.get<{ data: OpenOrder[] }>('/admin/trading/orders', { params: { exchangeAccountId } })).data.data;
}
export async function cancelOrder(exchangeAccountId: string, order: OpenOrder) {
  return api.post(`/admin/trading/orders/${encodeURIComponent(order.exchangeOrderId)}/cancel`, { exchangeAccountId, symbol: order.symbol });
}
export async function getOpenPositions(exchangeAccountId: string) {
  return (await api.get<{ data: OpenPosition[] }>('/admin/trading/positions', { params: { exchangeAccountId } })).data.data;
}
export async function closeOpenPosition(exchangeAccountId: string, position: OpenPosition) {
  return api.post(`/admin/trading/positions/${encodeURIComponent(position.positionKey)}/close`, { exchangeAccountId, idempotencyKey: crypto.randomUUID() });
}
