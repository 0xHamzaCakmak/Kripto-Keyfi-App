import { createHmac } from 'node:crypto';
import { compareDecimals } from '../decimal.js';
import type {
  CredentialValidationResult, ExchangeAdapter, ExchangeBalance, ExchangeCredentials, ExchangeOrder,
  ExchangePosition, ExchangeSymbol, MarginMode, PlaceOrderInput,
} from './exchange-adapter.js';
import { ExchangeAdapterError } from './exchange-adapter.js';
import { getJson, requestJson } from './http.js';

const BASE_URL = 'https://api-demo.bybit.com';
const RECV_WINDOW = '5000';

type BybitResponse<T> = { retCode?: number; retMsg?: string; result?: T };
type BybitWallet = BybitResponse<{ list?: Array<{ coin?: Array<{ coin?: string; walletBalance?: string; equity?: string; unrealisedPnl?: string }> }> }>;
type BybitApiKeyInfo = BybitResponse<{ readOnly?: number; permissions?: { ContractTrade?: string[]; Derivatives?: string[]; Wallet?: string[] } }>;
type BybitInstrument = {
  symbol?: string; status?: string; baseCoin?: string; quoteCoin?: string;
  leverageFilter?: { maxLeverage?: string };
  priceFilter?: { tickSize?: string };
  lotSizeFilter?: { minOrderQty?: string; maxOrderQty?: string; maxMktOrderQty?: string; qtyStep?: string; minNotionalValue?: string };
};
type BybitOrder = {
  orderId?: string; orderLinkId?: string; symbol?: string; side?: string; orderType?: string; orderStatus?: string;
  qty?: string; cumExecQty?: string; price?: string; triggerPrice?: string; reduceOnly?: boolean; createdTime?: string;
};
type BybitPosition = {
  symbol?: string; side?: string; size?: string; avgPrice?: string; markPrice?: string; liqPrice?: string;
  unrealisedPnl?: string; leverage?: string; tradeMode?: number; positionIdx?: number;
};

export class BybitV5Adapter implements ExchangeAdapter {
  constructor(private readonly credentials: ExchangeCredentials) {}

  async validateCredentials(): Promise<CredentialValidationResult> {
    const keyInfo = await this.signedGet<BybitApiKeyInfo>('/v5/user/query-api', '');
    const permissions = keyInfo.result?.permissions;
    const canTrade = keyInfo.result?.readOnly === 0 && (permissions?.ContractTrade?.includes('Order') === true || permissions?.Derivatives?.includes('DerivativesTrade') === true);
    return { canTrade, withdrawalEnabled: permissions?.Wallet?.includes('Withdraw') === true };
  }

  async getBalances(): Promise<ExchangeBalance[]> {
    const wallet = await this.signedGet<BybitWallet>('/v5/account/wallet-balance', 'accountType=UNIFIED');
    return (wallet.result?.list?.[0]?.coin ?? [])
      .filter((coin) => isNonZero(coin.walletBalance) || isNonZero(coin.unrealisedPnl))
      .map((coin) => ({
        walletType: 'UNIFIED' as const, asset: coin.coin ?? 'UNKNOWN', walletBalance: coin.walletBalance ?? '0',
        availableBalance: coin.equity ?? '0', unrealizedPnl: coin.unrealisedPnl ?? '0',
      }));
  }

  async getSymbols(): Promise<ExchangeSymbol[]> {
    const instruments: BybitInstrument[] = [];
    let cursor = '';
    do {
      const query = new URLSearchParams({ category: 'linear', limit: '1000', ...(cursor ? { cursor } : {}) });
      const body = await getJson(new URL(`/v5/market/instruments-info?${query}`, BASE_URL), {}) as BybitResponse<{ list?: BybitInstrument[]; nextPageCursor?: string }>;
      if (body.retCode !== 0) throw new ExchangeAdapterError('EXCHANGE_REJECTED', 'Bybit sembol bilgileri alınamadı.');
      instruments.push(...(body.result?.list ?? []));
      cursor = body.result?.nextPageCursor ?? '';
    } while (cursor);
    return instruments.flatMap((item) => {
      const lot = item.lotSizeFilter; const price = item.priceFilter; const leverage = Number(item.leverageFilter?.maxLeverage);
      if (item.status !== 'Trading' || item.quoteCoin !== 'USDT' || !item.symbol || !lot?.qtyStep || !lot.minOrderQty || !lot.minNotionalValue || !price?.tickSize || !Number.isInteger(leverage)) return [];
      return [{
        symbol: item.symbol, baseAsset: item.baseCoin ?? item.symbol.replace(/USDT$/, ''), quoteAsset: 'USDT', status: 'TRADING' as const,
        tickSize: price.tickSize, stepSize: lot.qtyStep, minQuantity: lot.minOrderQty,
        maxQuantity: lot.maxMktOrderQty ?? lot.maxOrderQty ?? '0', minNotional: lot.minNotionalValue, maxLeverage: leverage,
      }];
    });
  }

  async getMarkPrice(symbol: string): Promise<string> {
    const body = await getJson(new URL(`/v5/market/tickers?category=linear&symbol=${encodeURIComponent(symbol)}`, BASE_URL), {}) as BybitResponse<{ list?: Array<{ markPrice?: string }> }>;
    const markPrice = body.result?.list?.[0]?.markPrice;
    if (body.retCode !== 0 || !markPrice) throw new ExchangeAdapterError('INVALID_EXCHANGE_RESPONSE', 'Bybit mark fiyatı alınamadı.');
    return markPrice;
  }

  async configurePosition(symbol: string, leverage: number, marginMode: MarginMode): Promise<void> {
    await this.signedPost('/v5/account/set-margin-mode', { setMarginMode: marginMode === 'ISOLATED' ? 'ISOLATED_MARGIN' : 'REGULAR_MARGIN' }, [110026]);
    await this.signedPost('/v5/position/set-leverage', { category: 'linear', symbol, buyLeverage: leverage.toString(), sellLeverage: leverage.toString() }, [110043]);
  }

  async placeOrder(input: PlaceOrderInput): Promise<ExchangeOrder> {
    const conditional = input.type === 'STOP_MARKET' || input.type === 'STOP_LIMIT';
    const payload: Record<string, string | boolean | number> = {
      category: 'linear', symbol: input.symbol, side: input.side === 'BUY' ? 'Buy' : 'Sell',
      orderType: input.type === 'LIMIT' || input.type === 'STOP_LIMIT' ? 'Limit' : 'Market', qty: input.quantity,
      reduceOnly: input.reduceOnly, orderLinkId: input.clientOrderId,
    };
    if (input.price) payload.price = input.price;
    if (input.positionIndex !== undefined) payload.positionIdx = input.positionIndex;
    if (conditional && input.stopPrice) {
      const markPrice = await this.getMarkPrice(input.symbol);
      payload.triggerPrice = input.stopPrice;
      payload.triggerDirection = compareDecimals(input.stopPrice, markPrice) > 0 ? 1 : 2;
      payload.triggerBy = 'MarkPrice';
    }
    const body = await this.signedPost('/v5/order/create', payload);
    const result = (body as BybitResponse<{ orderId?: string; orderLinkId?: string }>).result;
    if (!result?.orderId) throw new ExchangeAdapterError('INVALID_EXCHANGE_RESPONSE', 'Bybit emir cevabı doğrulanamadı.');
    return {
      exchangeOrderId: result.orderId, clientOrderId: result.orderLinkId ?? input.clientOrderId, symbol: input.symbol,
      side: input.side, type: input.type, status: 'NEW', quantity: input.quantity, executedQuantity: '0',
      ...(input.price ? { price: input.price } : {}), ...(input.stopPrice ? { stopPrice: input.stopPrice } : {}), reduceOnly: input.reduceOnly,
    };
  }

  async getOpenOrders(): Promise<ExchangeOrder[]> {
    const body = await this.signedGet<BybitResponse<{ list?: BybitOrder[] }>>('/v5/order/realtime', 'category=linear&settleCoin=USDT&openOnly=0&limit=50');
    return (body.result?.list ?? []).map(mapOrder);
  }

  async cancelOrder(symbol: string, exchangeOrderId: string): Promise<ExchangeOrder> {
    const body = await this.signedPost('/v5/order/cancel', { category: 'linear', symbol, orderId: exchangeOrderId });
    const result = (body as BybitResponse<{ orderId?: string; orderLinkId?: string }>).result;
    if (!result?.orderId) throw new ExchangeAdapterError('INVALID_EXCHANGE_RESPONSE', 'Bybit emir iptal cevabı doğrulanamadı.');
    return { exchangeOrderId: result.orderId, clientOrderId: result.orderLinkId ?? '', symbol, side: 'BUY', type: 'MARKET', status: 'CANCELED', quantity: '0', executedQuantity: '0', reduceOnly: false };
  }

  async getPositions(): Promise<ExchangePosition[]> {
    const body = await this.signedGet<BybitResponse<{ list?: BybitPosition[] }>>('/v5/position/list', 'category=linear&settleCoin=USDT&limit=200');
    return (body.result?.list ?? []).flatMap((position) => {
      if (!position.symbol || !isNonZero(position.size)) return [];
      const positionIndex = position.positionIdx ?? 0;
      return [{
        positionKey: `${position.symbol}:${positionIndex}`, symbol: position.symbol, side: position.side === 'Sell' ? 'SHORT' as const : 'LONG' as const,
        quantity: position.size ?? '0', entryPrice: position.avgPrice ?? '0', markPrice: position.markPrice ?? '0',
        ...(isNonZero(position.liqPrice) ? { liquidationPrice: position.liqPrice } : {}), unrealizedPnl: position.unrealisedPnl ?? '0',
        leverage: position.leverage ?? '1', marginMode: position.tradeMode === 1 ? 'ISOLATED' as const : 'CROSS' as const, positionIndex,
      }];
    });
  }

  private async signedGet<T extends { retCode?: number }>(path: string, query: string): Promise<T> {
    const timestamp = Date.now().toString();
    const signature = createHmac('sha256', this.credentials.apiSecret).update(`${timestamp}${this.credentials.apiKey}${RECV_WINDOW}${query}`).digest('hex');
    const body = await requestJson(new URL(`${path}${query ? `?${query}` : ''}`, BASE_URL), { method: 'GET', headers: this.headers(timestamp, signature) });
    return this.assertResponse<T>(body);
  }

  private async signedPost(path: string, payload: Record<string, string | boolean | number>, acceptedCodes: number[] = []): Promise<unknown> {
    const bodyText = JSON.stringify(payload); const timestamp = Date.now().toString();
    const signature = createHmac('sha256', this.credentials.apiSecret).update(`${timestamp}${this.credentials.apiKey}${RECV_WINDOW}${bodyText}`).digest('hex');
    const body = await requestJson(new URL(path, BASE_URL), { method: 'POST', headers: { ...this.headers(timestamp, signature), 'Content-Type': 'application/json' }, body: bodyText });
    const response = body as BybitResponse<unknown>;
    if (response.retCode !== 0 && !acceptedCodes.includes(response.retCode ?? -1)) throw bybitError(response.retCode);
    return body;
  }

  private headers(timestamp: string, signature: string) {
    return { 'X-BAPI-API-KEY': this.credentials.apiKey, 'X-BAPI-TIMESTAMP': timestamp, 'X-BAPI-RECV-WINDOW': RECV_WINDOW, 'X-BAPI-SIGN': signature };
  }

  private assertResponse<T extends { retCode?: number }>(body: unknown): T {
    if (!body || typeof body !== 'object') throw new ExchangeAdapterError('INVALID_EXCHANGE_RESPONSE', 'Bybit cevabı doğrulanamadı.');
    const response = body as T;
    if (response.retCode !== 0) throw bybitError(response.retCode);
    return response;
  }
}

function bybitError(code?: number) {
  if (code === 110007) return new ExchangeAdapterError('INSUFFICIENT_BALANCE', 'Emir oluşturulamadı. Kullanılabilir teminat yetersiz.');
  if (code === 10003) return new ExchangeAdapterError('EXCHANGE_PERMISSION_DENIED', 'Bybit API anahtarı veya işlem yetkileri doğrulanamadı.');
  if (code === 10006) return new ExchangeAdapterError('EXCHANGE_RATE_LIMITED', 'Bybit istek limiti aşıldı. Lütfen daha sonra tekrar deneyin.');
  return new ExchangeAdapterError('EXCHANGE_REJECTED', 'Bybit işlem isteğini reddetti.');
}
function mapOrder(order: BybitOrder): ExchangeOrder {
  if (!order.orderId || !order.symbol) throw new ExchangeAdapterError('INVALID_EXCHANGE_RESPONSE', 'Bybit açık emir cevabı doğrulanamadı.');
  const conditional = isNonZero(order.triggerPrice); const limit = order.orderType === 'Limit';
  return {
    exchangeOrderId: order.orderId, clientOrderId: order.orderLinkId ?? '', symbol: order.symbol,
    side: order.side === 'Sell' ? 'SELL' : 'BUY', type: conditional ? (limit ? 'STOP_LIMIT' : 'STOP_MARKET') : (limit ? 'LIMIT' : 'MARKET'),
    status: order.orderStatus ?? 'UNKNOWN', quantity: order.qty ?? '0', executedQuantity: order.cumExecQty ?? '0',
    ...(isNonZero(order.price) ? { price: order.price } : {}), ...(conditional ? { stopPrice: order.triggerPrice } : {}),
    reduceOnly: order.reduceOnly === true, ...(order.createdTime ? { createdAt: new Date(Number(order.createdTime)).toISOString() } : {}),
  };
}
function isNonZero(value?: string): boolean { return value !== undefined && value !== '' && !/^[-+]?0*(?:\.0*)?$/.test(value); }
