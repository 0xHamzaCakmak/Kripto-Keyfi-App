import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { requestJson } from './http.js';
import { ExchangeAdapterError, type ExchangeAdapter, type ExchangeCredentials, type ExchangeOrder, type ExchangeSymbol } from './exchange-adapter.js';

const base = 'https://demo-api.binance.com';
type SpotAccount = { canTrade?: boolean; canWithdraw?: boolean; balances?: Array<{ asset: string; free: string; locked: string }> };
type SpotFilter = { filterType: string; tickSize?: string; stepSize?: string; minQty?: string; maxQty?: string; minNotional?: string };
type SpotSymbol = { symbol: string; status: string; baseAsset: string; quoteAsset: string; filters: SpotFilter[] };
type SpotOrder = { orderId: number; clientOrderId: string; symbol: string; side: 'BUY' | 'SELL'; type: ExchangeOrder['type'] | 'LIMIT_MAKER'; status: string; origQty: string; executedQty: string; price: string };
export class BinanceSpotAdapter implements ExchangeAdapter {
  constructor(private readonly credentials: ExchangeCredentials) {}
  async read<T>(path: string, params: Record<string, string> = {}, signed = true): Promise<T> {
    const query = new URLSearchParams(params);
    if (signed) { query.set('timestamp', String(Date.now())); query.set('recvWindow', '5000'); query.set('signature', createHmac('sha256', this.credentials.apiSecret).update(query.toString()).digest('hex')); }
    return await requestJson(new URL(`${path}?${query}`, base), { method: 'GET', headers: signed ? { 'X-MBX-APIKEY': this.credentials.apiKey } : {} }) as T;
  }
  async validateCredentials() {
    const account = await this.read<SpotAccount>('/api/v3/account');
    if (typeof account.canTrade !== 'boolean') throw new ExchangeAdapterError('INVALID_EXCHANGE_RESPONSE', 'Spot hesap yetkisi okunamadı.');
    return { canTrade: account.canTrade, withdrawalEnabled: account.canWithdraw === true };
  }
  async getBalances() {
    const account = await this.read<SpotAccount>('/api/v3/account');
    if (!Array.isArray(account.balances)) throw new ExchangeAdapterError('INVALID_EXCHANGE_RESPONSE', 'Spot bakiye cevabı geçersiz.');
    return account.balances.map((b: { asset: string; free: string; locked: string }) => ({ walletType: 'SPOT' as const, asset: b.asset, availableBalance: b.free, lockedBalance: b.locked, walletBalance: new Prisma.Decimal(b.free).add(b.locked).toFixed(), unrealizedPnl: '0' }));
  }
  async getSymbols(): Promise<ExchangeSymbol[]> {
    const body = await this.read<{ symbols?: SpotSymbol[] }>('/api/v3/exchangeInfo', {}, false);
    return (body.symbols ?? []).filter(s => s.status === 'TRADING' && s.quoteAsset === 'USDT').flatMap(s => {
      const f = Object.fromEntries(s.filters.map(r => [r.filterType, r])) as Record<string, SpotFilter | undefined>;
      const lot = f.LOT_SIZE, price = f.PRICE_FILTER, minNotional = f.NOTIONAL?.minNotional ?? f.MIN_NOTIONAL?.minNotional;
      if (!lot?.stepSize || !lot.minQty || !lot.maxQty || !price?.tickSize || !minNotional) return [];
      return [{ symbol: s.symbol, baseAsset: s.baseAsset, quoteAsset: s.quoteAsset, status: 'TRADING' as const, tickSize: price.tickSize, stepSize: lot.stepSize, minQuantity: lot.minQty, maxQuantity: lot.maxQty, minNotional, maxLeverage: 1 }];
    });
  }
  async getMarkPrice(symbol: string) { const data = await this.read<{ price?: string }>('/api/v3/ticker/price', { symbol }, false); if (!data.price) throw new ExchangeAdapterError('INVALID_EXCHANGE_RESPONSE', 'Spot fiyatı alınamadı.'); return data.price; }
  async getOpenOrders(): Promise<ExchangeOrder[]> { return (await this.read<SpotOrder[]>('/api/v3/openOrders')).map(mapSpotOrder); }
  async getPositions() { return []; }
  async configurePosition() { throw new ExchangeAdapterError('CENTRAL_RISK_ENGINE_REQUIRED', 'Emirler Go Risk Engine tarafından yürütülür.'); }
  async placeOrder(): Promise<ExchangeOrder> { throw new ExchangeAdapterError('CENTRAL_RISK_ENGINE_REQUIRED', 'Emirler Go Risk Engine tarafından yürütülür.'); }
  async cancelOrder(): Promise<ExchangeOrder> { throw new ExchangeAdapterError('CENTRAL_RISK_ENGINE_REQUIRED', 'İptaller Go executor tarafından yürütülür.'); }
}
export function mapSpotOrder(o: SpotOrder): ExchangeOrder {
  if (!o.orderId || !o.symbol || !o.clientOrderId) throw new ExchangeAdapterError('INVALID_EXCHANGE_RESPONSE', 'Spot emir cevabı geçersiz.');
  return { exchangeOrderId: String(o.orderId), clientOrderId: o.clientOrderId, symbol: o.symbol, side: o.side, type: o.type === 'LIMIT_MAKER' ? 'LIMIT' : o.type, status: o.status, quantity: o.origQty, executedQuantity: o.executedQty, price: o.price, reduceOnly: false };
}
