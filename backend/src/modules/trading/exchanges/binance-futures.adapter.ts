import { createHmac } from 'node:crypto';
import type {
  CredentialValidationResult, ExchangeAdapter, ExchangeBalance, ExchangeCredentials, ExchangeOrder,
  ExchangePosition, ExchangeSymbol, MarginMode, PlaceOrderInput,
  ExchangeTrade,
} from './exchange-adapter.js';
import { ExchangeAdapterError } from './exchange-adapter.js';
import { getJson, requestJson } from './http.js';

const FUTURES_BASE_URL = 'https://demo-fapi.binance.com';
const FUTURES_PUBLIC_MARKET_BASE_URL = 'https://fapi.binance.com';
const SPOT_BASE_URL = 'https://demo-api.binance.com';

type BinanceFuturesAccount = { canTrade?: boolean; canWithdraw?: boolean; assets?: Array<{ asset?: string; walletBalance?: string; availableBalance?: string; unrealizedProfit?: string; marginAvailable?: boolean }> };
type BinanceSpotAccount = { balances?: Array<{ asset?: string; free?: string; locked?: string }> };
type BinanceTickerPrice = { symbol?: string; price?: string };
type BinanceExchangeInfo = { symbols?: BinanceExchangeSymbol[] };
type BinanceExchangeSymbol = {
  symbol?: string; status?: string; baseAsset?: string; quoteAsset?: string; contractType?: string;
  filters?: Array<{ filterType?: string; tickSize?: string; stepSize?: string; minQty?: string; maxQty?: string; notional?: string }>;
};
type BinanceLeverageBracket = { symbol?: string; brackets?: Array<{ initialLeverage?: number }> };
type BinanceOrder = {
  orderId?: number; clientOrderId?: string; symbol?: string; side?: string; type?: string; status?: string;
  origQty?: string; executedQty?: string; price?: string; stopPrice?: string; reduceOnly?: boolean; positionSide?: string; time?: number; updateTime?: number;
};
type BinancePosition = {
  symbol?: string; positionAmt?: string; entryPrice?: string; markPrice?: string; unRealizedProfit?: string;
  liquidationPrice?: string; leverage?: string; marginType?: string; positionSide?: string;
};
type BinanceUserTrade = {
  id?: number; orderId?: number; symbol?: string; side?: string; price?: string; qty?: string; quoteQty?: string;
  realizedPnl?: string; commission?: string; commissionAsset?: string; maker?: boolean; time?: number; positionSide?: string;
};

/**
 * Public production-market contract metadata for PAPER/TRAINING. This path
 * deliberately has no API-key dependency; private Demo/Testnet connectivity
 * must never stop the simulated fleet from rotating through valid markets.
 */
export async function getBinanceFuturesPublicSymbols(): Promise<ExchangeSymbol[]> {
  const info = await getJson(new URL('/fapi/v1/exchangeInfo', FUTURES_PUBLIC_MARKET_BASE_URL), {}) as BinanceExchangeInfo;
  return mapFuturesSymbols(info, new Map(), 20);
}

export class BinanceFuturesAdapter implements ExchangeAdapter {
  constructor(private readonly credentials: ExchangeCredentials) {}

  async validateCredentials(): Promise<CredentialValidationResult> {
    const account = await this.futuresAccount();
    let canTrade = false;
    try {
      const probe = await this.tradePermissionProbe();
      await this.signedRequest('/fapi/v1/order/test', 'POST', {
        symbol: probe.symbol, side: 'BUY', type: 'MARKET', quantity: probe.quantity,
      }, [-4164, -2019]);
      canTrade = true;
    } catch (error) {
      if (!(error instanceof ExchangeAdapterError) || error.code !== 'EXCHANGE_PERMISSION_DENIED') throw error;
    }
    return { canTrade, withdrawalEnabled: account.canWithdraw === true };
  }

  async getBalances(): Promise<ExchangeBalance[]> {
    const [spotAccount, futuresAccount, spotPrices] = await Promise.all([this.spotAccount(), this.futuresAccount(), this.spotPrices()]);
    const spotBalances = (spotAccount.balances ?? [])
      .filter((asset) => isNonZero(asset.free) || isNonZero(asset.locked))
      .map((asset) => {
        const assetName = asset.asset ?? 'UNKNOWN';
        const walletBalance = addUnsignedDecimals(asset.free ?? '0', asset.locked ?? '0');
        const priceUsdt = findUsdtPrice(assetName, spotPrices);
        return {
          walletType: 'SPOT' as const, asset: assetName, walletBalance, availableBalance: asset.free ?? '0',
          lockedBalance: asset.locked ?? '0', unrealizedPnl: '0',
          ...(priceUsdt ? { priceUsdt, valueUsdt: multiplyUnsignedDecimals(walletBalance, priceUsdt) } : {}),
        };
      })
      .sort((left, right) => left.asset.localeCompare(right.asset));
    const futuresBalances = (futuresAccount.assets ?? [])
      .filter((asset) => isNonZero(asset.walletBalance) || isNonZero(asset.unrealizedProfit))
      .map((asset) => ({
        walletType: 'USD_M_FUTURES' as const, asset: asset.asset ?? 'UNKNOWN', walletBalance: asset.walletBalance ?? '0',
        availableBalance: asset.availableBalance ?? '0', unrealizedPnl: asset.unrealizedProfit ?? '0', marginAvailable: asset.marginAvailable ?? false,
      }));
    return [...spotBalances, ...futuresBalances];
  }

  async getSymbols(): Promise<ExchangeSymbol[]> {
    const [infoBody, bracketsBody] = await Promise.all([
      getJson(new URL('/fapi/v1/exchangeInfo', FUTURES_BASE_URL), {}),
      this.signedRequest('/fapi/v1/leverageBracket', 'GET'),
    ]);
    const info = infoBody as BinanceExchangeInfo;
    const brackets = Array.isArray(bracketsBody) ? bracketsBody as BinanceLeverageBracket[] : [];
    const leverageBySymbol = new Map(brackets.flatMap((item) => item.symbol && item.brackets?.[0]?.initialLeverage
      ? [[item.symbol, item.brackets[0].initialLeverage] as const] : []));
    return mapFuturesSymbols(info, leverageBySymbol);
  }

  async getMarkPrice(symbol: string): Promise<string> {
    const body = await getJson(new URL(`/fapi/v1/premiumIndex?symbol=${encodeURIComponent(symbol)}`, FUTURES_BASE_URL), {}) as { markPrice?: string };
    if (!body.markPrice) throw new ExchangeAdapterError('INVALID_EXCHANGE_RESPONSE', 'Binance mark fiyatı alınamadı.');
    return body.markPrice;
  }

  async configurePosition(symbol: string, leverage: number, marginMode: MarginMode): Promise<void> {
    const marginResult = await this.signedRequest(
      '/fapi/v1/marginType', 'POST',
      { symbol, marginType: marginMode === 'CROSS' ? 'CROSSED' : 'ISOLATED' },
      [-4046, -4047, -4048, -4067],
    ) as { code?: number };
    if (marginResult.code !== undefined && [-4047, -4048, -4067].includes(marginResult.code)) {
      const openPosition = (await this.getPositions()).find((position) => position.symbol === symbol);
      if (!openPosition || openPosition.marginMode !== marginMode) {
        throw new ExchangeAdapterError(
          'MARGIN_MODE_CHANGE_BLOCKED',
          'Açık pozisyon varken margin modu değiştirilemez. Mevcut pozisyonu kapatın veya mevcut margin modunu seçin.',
          marginResult.code,
        );
      }
    }
    await this.signedRequest('/fapi/v1/leverage', 'POST', { symbol, leverage: leverage.toString() });
  }

  async placeOrder(input: PlaceOrderInput): Promise<ExchangeOrder> {
    const params: Record<string, string> = {
      symbol: input.symbol, side: input.side, type: binanceOrderType(input.type), quantity: input.quantity,
      newClientOrderId: input.clientOrderId, newOrderRespType: 'RESULT',
    };
    if (input.positionSide) params.positionSide = input.positionSide;
    else params.reduceOnly = input.reduceOnly.toString();
    if (input.type === 'LIMIT' || input.type === 'STOP_LIMIT') params.timeInForce = 'GTC';
    if (input.price) params.price = input.price;
    if (input.stopPrice) params.stopPrice = input.stopPrice;
    return mapOrder(await this.signedRequest('/fapi/v1/order', 'POST', params) as BinanceOrder);
  }

  async getOpenOrders(): Promise<ExchangeOrder[]> {
    const body = await this.signedRequest('/fapi/v1/openOrders', 'GET');
    return Array.isArray(body) ? (body as BinanceOrder[]).map(mapOrder) : [];
  }

  async cancelOrder(symbol: string, exchangeOrderId: string): Promise<ExchangeOrder> {
    return mapOrder(await this.signedRequest('/fapi/v1/order', 'DELETE', { symbol, orderId: exchangeOrderId }) as BinanceOrder);
  }

  async getPositions(): Promise<ExchangePosition[]> {
    const body = await this.signedRequest('/fapi/v2/positionRisk', 'GET');
    return (Array.isArray(body) ? body as BinancePosition[] : []).flatMap((position) => {
      const amount = position.positionAmt ?? '0';
      if (!isNonZero(amount) || !position.symbol) return [];
      if (!position.leverage || (position.marginType !== 'isolated' && position.marginType !== 'cross')) {
        throw new ExchangeAdapterError('INVALID_EXCHANGE_RESPONSE', 'Binance pozisyon kaldıraç veya margin modu cevabı eksik.');
      }
      const negative = amount.startsWith('-');
      const side = position.positionSide === 'LONG' ? 'LONG' : position.positionSide === 'SHORT' ? 'SHORT' : negative ? 'SHORT' : 'LONG';
      return [{
        positionKey: `${position.symbol}:${position.positionSide ?? 'BOTH'}`, symbol: position.symbol, side,
        quantity: amount.replace(/^-/, ''), entryPrice: position.entryPrice ?? '0', markPrice: position.markPrice ?? '0',
        ...(isNonZero(position.liquidationPrice) ? { liquidationPrice: position.liquidationPrice } : {}),
        unrealizedPnl: position.unRealizedProfit ?? '0', leverage: position.leverage,
        marginMode: position.marginType === 'isolated' ? 'ISOLATED' as const : 'CROSS' as const,
      }];
    });
  }

  async getHedgeMode(): Promise<boolean> {
    const result = await this.signedRequest('/fapi/v1/positionSide/dual', 'GET') as { dualSidePosition?: boolean };
    if (typeof result.dualSidePosition !== 'boolean') throw new ExchangeAdapterError('INVALID_EXCHANGE_RESPONSE', 'Binance pozisyon modu okunamadı.');
    return result.dualSidePosition;
  }

  async setHedgeMode(enabled: boolean): Promise<void> {
    await this.signedRequest('/fapi/v1/positionSide/dual', 'POST', { dualSidePosition: enabled.toString() });
  }

  async getUserTrades(symbol: string, limit = 1000): Promise<ExchangeTrade[]> {
    const body = await this.signedRequest('/fapi/v1/userTrades', 'GET', {
      symbol, limit: Math.max(1, Math.min(1000, Math.trunc(limit))).toString(),
    });
    return (Array.isArray(body) ? body as BinanceUserTrade[] : []).flatMap((trade) => {
      if (trade.id === undefined || trade.orderId === undefined || !trade.symbol || trade.time === undefined) return [];
      return [{
        tradeId: trade.id.toString(), exchangeOrderId: trade.orderId.toString(), symbol: trade.symbol,
        side: trade.side === 'SELL' ? 'SELL' as const : 'BUY' as const,
        ...(['LONG', 'SHORT', 'BOTH'].includes(trade.positionSide ?? '') ? { positionSide: trade.positionSide as 'LONG' | 'SHORT' | 'BOTH' } : {}),
        price: trade.price ?? '0', quantity: trade.qty ?? '0', quoteQuantity: trade.quoteQty ?? '0',
        realizedPnl: trade.realizedPnl ?? '0', commission: trade.commission ?? '0',
        commissionAsset: trade.commissionAsset ?? 'UNKNOWN', maker: trade.maker === true,
        occurredAt: new Date(trade.time).toISOString(),
      }];
    });
  }

  private async futuresAccount(): Promise<BinanceFuturesAccount> {
    try { return await this.signedRequest('/fapi/v3/account', 'GET') as BinanceFuturesAccount; }
    catch (error) {
      if (error instanceof ExchangeAdapterError && ['EXCHANGE_REJECTED', 'EXCHANGE_PERMISSION_DENIED'].includes(error.code)) {
        throw new ExchangeAdapterError('EXCHANGE_ENVIRONMENT_MISMATCH', 'Binance Demo Futures anahtarı doğrulanamadı. Demo hesabı anahtarını ve Futures erişimini kontrol edin.');
      }
      throw error;
    }
  }

  private async spotAccount(): Promise<BinanceSpotAccount> {
    try { return await this.signedAccount<BinanceSpotAccount>(SPOT_BASE_URL, '/api/v3/account'); }
    catch (error) {
      if (error instanceof ExchangeAdapterError && ['EXCHANGE_REJECTED', 'EXCHANGE_PERMISSION_DENIED'].includes(error.code)) {
        throw new ExchangeAdapterError('SPOT_ACCOUNT_UNAVAILABLE', 'Binance Demo Spot/Main bakiyesi okunamadı. API anahtarının okuma yetkisini kontrol edin.');
      }
      throw error;
    }
  }

  private async spotPrices(): Promise<Map<string, string>> {
    try {
      const body = await getJson(new URL('/api/v3/ticker/price', SPOT_BASE_URL), {});
      if (!Array.isArray(body)) return new Map();
      return new Map((body as BinanceTickerPrice[])
        .filter((ticker): ticker is Required<BinanceTickerPrice> => typeof ticker.symbol === 'string' && typeof ticker.price === 'string')
        .map((ticker) => [ticker.symbol, ticker.price]));
    } catch { return new Map(); }
  }

  private async tradePermissionProbe(): Promise<{ symbol: string; quantity: string }> {
    const body = await getJson(new URL('/fapi/v1/exchangeInfo', FUTURES_BASE_URL), {}) as BinanceExchangeInfo;
    const symbol = (body.symbols ?? []).find((item) => item.status === 'TRADING' && item.quoteAsset === 'USDT' && item.contractType === 'PERPETUAL');
    const lot = symbol ? filter(symbol, 'MARKET_LOT_SIZE') ?? filter(symbol, 'LOT_SIZE') : undefined;
    if (!symbol?.symbol || !lot?.minQty) throw new ExchangeAdapterError('INVALID_EXCHANGE_RESPONSE', 'Binance işlem yetkisi için uygun test paritesi bulunamadı.');
    return { symbol: symbol.symbol, quantity: lot.minQty };
  }

  private async signedAccount<T extends object>(baseUrl: string, path: string): Promise<T> {
    const query = signedQuery({}, this.credentials.apiSecret);
    const body = await getJson(new URL(`${path}?${query}`, baseUrl), { 'X-MBX-APIKEY': this.credentials.apiKey });
    if (!body || typeof body !== 'object') throw new ExchangeAdapterError('INVALID_EXCHANGE_RESPONSE', 'Binance hesap cevabı doğrulanamadı.');
    return body as T;
  }

  private async signedRequest(path: string, method: 'GET' | 'POST' | 'DELETE', params: Record<string, string> = {}, acceptedErrorCodes?: Array<string | number>) {
    const query = signedQuery(params, this.credentials.apiSecret);
    return requestJson(new URL(`${path}?${query}`, FUTURES_BASE_URL), {
      method, headers: { 'X-MBX-APIKEY': this.credentials.apiKey }, ...(acceptedErrorCodes ? { acceptedErrorCodes } : {}),
    });
  }
}

function signedQuery(params: Record<string, string>, secret: string): string {
  const query = new URLSearchParams({ ...params, recvWindow: '5000', timestamp: Date.now().toString() });
  query.set('signature', createHmac('sha256', secret).update(query.toString()).digest('hex'));
  return query.toString();
}

function filter(symbol: BinanceExchangeSymbol, filterType: string) { return symbol.filters?.find((item) => item.filterType === filterType); }
function mapFuturesSymbols(info: BinanceExchangeInfo, leverageBySymbol: Map<string, number>, fallbackMaxLeverage?: number): ExchangeSymbol[] {
  return (info.symbols ?? []).flatMap((symbol) => {
    if (symbol.status !== 'TRADING' || !['USDT', 'USDC'].includes(symbol.quoteAsset ?? '') || symbol.contractType !== 'PERPETUAL' || !symbol.symbol) return [];
    const price = filter(symbol, 'PRICE_FILTER');
    const lot = filter(symbol, 'LOT_SIZE');
    const marketLot = filter(symbol, 'MARKET_LOT_SIZE');
    const notional = filter(symbol, 'MIN_NOTIONAL');
    const maxLeverage = leverageBySymbol.get(symbol.symbol) ?? fallbackMaxLeverage;
    if (!price?.tickSize || !lot?.stepSize || !lot.minQty || !lot.maxQty || !notional?.notional || maxLeverage === undefined) return [];
    return [{
      symbol: symbol.symbol, baseAsset: symbol.baseAsset ?? symbol.symbol.replace(/(?:USDT|USDC)$/, ''), quoteAsset: symbol.quoteAsset!, status: 'TRADING' as const,
      tickSize: price.tickSize, stepSize: lot.stepSize, minQuantity: lot.minQty,
      maxQuantity: marketLot?.maxQty ?? lot.maxQty, minNotional: notional.notional, maxLeverage,
    }];
  });
}
function binanceOrderType(type: PlaceOrderInput['type']) { return type === 'STOP_LIMIT' ? 'STOP' : type; }
function fromBinanceOrderType(type?: string): ExchangeOrder['type'] { return type === 'STOP' ? 'STOP_LIMIT' : type === 'LIMIT' || type === 'STOP_MARKET' ? type : 'MARKET'; }
function mapOrder(order: BinanceOrder): ExchangeOrder {
  if (order.orderId === undefined || !order.symbol) throw new ExchangeAdapterError('INVALID_EXCHANGE_RESPONSE', 'Binance emir cevabı doğrulanamadı.');
  return {
    exchangeOrderId: order.orderId.toString(), clientOrderId: order.clientOrderId ?? '', symbol: order.symbol,
    side: order.side === 'SELL' ? 'SELL' : 'BUY',
    ...(['LONG', 'SHORT', 'BOTH'].includes(order.positionSide ?? '') ? { positionSide: order.positionSide as 'LONG' | 'SHORT' | 'BOTH' } : {}),
    type: fromBinanceOrderType(order.type), status: order.status ?? 'UNKNOWN',
    quantity: order.origQty ?? '0', executedQuantity: order.executedQty ?? '0',
    ...(isNonZero(order.price) ? { price: order.price } : {}), ...(isNonZero(order.stopPrice) ? { stopPrice: order.stopPrice } : {}),
    reduceOnly: order.reduceOnly === true,
    ...((order.time ?? order.updateTime) ? { createdAt: new Date(order.time ?? order.updateTime ?? 0).toISOString() } : {}),
  };
}

function isNonZero(value?: string): boolean { return value !== undefined && !/^[-+]?0*(?:\.0*)?$/.test(value); }
function addUnsignedDecimals(left: string, right: string): string {
  const [leftWhole = '0', leftFraction = ''] = left.split('.'); const [rightWhole = '0', rightFraction = ''] = right.split('.');
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const sum = (BigInt(`${leftWhole}${leftFraction.padEnd(scale, '0')}`) + BigInt(`${rightWhole}${rightFraction.padEnd(scale, '0')}`)).toString().padStart(scale + 1, '0');
  return scale === 0 ? sum : `${sum.slice(0, -scale)}.${sum.slice(-scale)}`.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}
function findUsdtPrice(asset: string, prices: Map<string, string>): string | undefined {
  if (asset === 'USDT') return '1'; const directPrice = prices.get(`${asset}USDT`); if (directPrice) return directPrice;
  if (asset === 'USDC') return prices.get('USDCUSDT') ?? '1'; const usdcPrice = prices.get(`${asset}USDC`);
  return usdcPrice ? multiplyUnsignedDecimals(usdcPrice, prices.get('USDCUSDT') ?? '1') : undefined;
}
function multiplyUnsignedDecimals(left: string, right: string, maximumScale = 8): string {
  const [leftWhole = '0', leftFraction = ''] = left.split('.'); const [rightWhole = '0', rightFraction = ''] = right.split('.');
  let product = BigInt(`${leftWhole}${leftFraction}`) * BigInt(`${rightWhole}${rightFraction}`); let scale = leftFraction.length + rightFraction.length;
  if (scale > maximumScale) { const divisor = 10n ** BigInt(scale - maximumScale); product = (product + divisor / 2n) / divisor; scale = maximumScale; }
  const digits = product.toString().padStart(scale + 1, '0');
  return scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}
