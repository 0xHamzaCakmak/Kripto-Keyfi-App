export type ExchangeCredentials = { apiKey: string; apiSecret: string; passphrase?: string };

export type CredentialValidationResult = {
  canTrade: boolean;
  withdrawalEnabled: boolean;
};

export type ExchangeBalance = {
  walletType: 'SPOT' | 'USD_M_FUTURES' | 'UNIFIED';
  asset: string;
  walletBalance: string;
  availableBalance: string;
  lockedBalance?: string;
  unrealizedPnl: string;
  priceUsdt?: string;
  valueUsdt?: string;
};

export type ExchangeSymbol = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: 'TRADING';
  tickSize: string;
  stepSize: string;
  minQuantity: string;
  maxQuantity: string;
  minNotional: string;
  maxLeverage: number;
};

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET' | 'STOP_LIMIT';
export type MarginMode = 'ISOLATED' | 'CROSS';

export type PlaceOrderInput = {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: string;
  price?: string;
  stopPrice?: string;
  reduceOnly: boolean;
  clientOrderId: string;
  positionIndex?: number;
};

export type ExchangeOrder = {
  exchangeOrderId: string;
  clientOrderId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: string;
  quantity: string;
  executedQuantity: string;
  price?: string;
  stopPrice?: string;
  reduceOnly: boolean;
  createdAt?: string;
};

export type ExchangePosition = {
  positionKey: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: string;
  entryPrice: string;
  markPrice: string;
  liquidationPrice?: string;
  unrealizedPnl: string;
  leverage: string;
  marginMode: MarginMode;
  positionIndex?: number;
};

export type ExchangeTrade = {
  tradeId: string;
  exchangeOrderId: string;
  symbol: string;
  side: OrderSide;
  price: string;
  quantity: string;
  quoteQuantity: string;
  realizedPnl: string;
  commission: string;
  commissionAsset: string;
  maker: boolean;
  occurredAt: string;
};

export interface ExchangeAdapter {
  validateCredentials(): Promise<CredentialValidationResult>;
  getBalances(): Promise<ExchangeBalance[]>;
  getSymbols(): Promise<ExchangeSymbol[]>;
  getMarkPrice(symbol: string): Promise<string>;
  configurePosition(symbol: string, leverage: number, marginMode: MarginMode): Promise<void>;
  placeOrder(input: PlaceOrderInput): Promise<ExchangeOrder>;
  getOpenOrders(): Promise<ExchangeOrder[]>;
  cancelOrder(symbol: string, exchangeOrderId: string): Promise<ExchangeOrder>;
  getPositions(): Promise<ExchangePosition[]>;
  getUserTrades?(symbol: string, limit?: number): Promise<ExchangeTrade[]>;
}

export class ExchangeAdapterError extends Error {
  constructor(public readonly code: string, message: string, public readonly exchangeCode?: string | number) {
    super(message);
    this.name = 'ExchangeAdapterError';
  }
}
