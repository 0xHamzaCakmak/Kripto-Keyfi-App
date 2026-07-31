import { createHmac } from 'node:crypto';
import type { CredentialValidationResult, ExchangeAdapter, ExchangeBalance, ExchangeCredentials } from './exchange-adapter.js';
import { ExchangeAdapterError } from './exchange-adapter.js';
import { getJson } from './http.js';

const FUTURES_BASE_URL = 'https://demo-fapi.binance.com';
const SPOT_BASE_URL = 'https://demo-api.binance.com';

type BinanceFuturesAccount = {
  canTrade?: boolean;
  canWithdraw?: boolean;
  assets?: Array<{ asset?: string; walletBalance?: string; availableBalance?: string; unrealizedProfit?: string }>;
};

type BinanceSpotAccount = {
  balances?: Array<{ asset?: string; free?: string; locked?: string }>;
};

type BinanceTickerPrice = { symbol?: string; price?: string };

export class BinanceFuturesAdapter implements ExchangeAdapter {
  constructor(private readonly credentials: ExchangeCredentials) {}

  async validateCredentials(): Promise<CredentialValidationResult> {
    const account = await this.futuresAccount();
    return { canTrade: account.canTrade === true, withdrawalEnabled: account.canWithdraw === true };
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
          walletType: 'SPOT' as const,
          asset: assetName,
          walletBalance,
          availableBalance: asset.free ?? '0',
          lockedBalance: asset.locked ?? '0',
          unrealizedPnl: '0',
          ...(priceUsdt ? { priceUsdt, valueUsdt: multiplyUnsignedDecimals(walletBalance, priceUsdt) } : {}),
        };
      })
      .sort((left, right) => left.asset.localeCompare(right.asset));
    const futuresBalances = (futuresAccount.assets ?? [])
      .filter((asset) => isNonZero(asset.walletBalance) || isNonZero(asset.unrealizedProfit))
      .map((asset) => ({
        walletType: 'USD_M_FUTURES' as const,
        asset: asset.asset ?? 'UNKNOWN',
        walletBalance: asset.walletBalance ?? '0',
        availableBalance: asset.availableBalance ?? '0',
        unrealizedPnl: asset.unrealizedProfit ?? '0',
      }));
    return [...spotBalances, ...futuresBalances];
  }

  private async futuresAccount(): Promise<BinanceFuturesAccount> {
    try {
      return await this.signedAccount<BinanceFuturesAccount>(FUTURES_BASE_URL, '/fapi/v3/account');
    } catch (error) {
      if (error instanceof ExchangeAdapterError && error.code === 'EXCHANGE_REJECTED') {
        throw new ExchangeAdapterError(
          'EXCHANGE_ENVIRONMENT_MISMATCH',
          'Binance Demo Futures anahtarı doğrulanamadı. Demo hesabına ait API anahtarını ve Futures erişimini kontrol edin.',
        );
      }
      throw error;
    }
  }

  private async spotAccount(): Promise<BinanceSpotAccount> {
    try {
      return await this.signedAccount<BinanceSpotAccount>(SPOT_BASE_URL, '/api/v3/account');
    } catch (error) {
      if (error instanceof ExchangeAdapterError && error.code === 'EXCHANGE_REJECTED') {
        throw new ExchangeAdapterError(
          'SPOT_ACCOUNT_UNAVAILABLE',
          'Binance Demo Spot/Main bakiyesi okunamadı. API anahtarının okuma yetkisini kontrol edin.',
        );
      }
      throw error;
    }
  }

  private async spotPrices(): Promise<Map<string, string>> {
    try {
      const body = await getJson(new URL('/api/v3/ticker/price', SPOT_BASE_URL), {});
      if (!Array.isArray(body)) return new Map();
      return new Map(
        (body as BinanceTickerPrice[])
          .filter((ticker): ticker is Required<BinanceTickerPrice> => typeof ticker.symbol === 'string' && typeof ticker.price === 'string')
          .map((ticker) => [ticker.symbol, ticker.price]),
      );
    } catch {
      return new Map();
    }
  }

  private async signedAccount<T extends object>(baseUrl: string, path: string): Promise<T> {
    const query = new URLSearchParams({ recvWindow: '5000', timestamp: Date.now().toString() });
    query.set('signature', createHmac('sha256', this.credentials.apiSecret).update(query.toString()).digest('hex'));
    const body = await getJson(new URL(`${path}?${query.toString()}`, baseUrl), { 'X-MBX-APIKEY': this.credentials.apiKey });
    if (!body || typeof body !== 'object') throw new ExchangeAdapterError('INVALID_EXCHANGE_RESPONSE', 'Binance hesap cevabı doğrulanamadı.');
    return body as T;
  }
}

function isNonZero(value?: string): boolean {
  return value !== undefined && !/^[-+]?0*(?:\.0*)?$/.test(value);
}

function addUnsignedDecimals(left: string, right: string): string {
  const [leftWhole = '0', leftFraction = ''] = left.split('.');
  const [rightWhole = '0', rightFraction = ''] = right.split('.');
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const leftInteger = BigInt(`${leftWhole}${leftFraction.padEnd(scale, '0')}`);
  const rightInteger = BigInt(`${rightWhole}${rightFraction.padEnd(scale, '0')}`);
  const sum = (leftInteger + rightInteger).toString().padStart(scale + 1, '0');
  if (scale === 0) return sum;
  return `${sum.slice(0, -scale)}.${sum.slice(-scale)}`.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function findUsdtPrice(asset: string, prices: Map<string, string>): string | undefined {
  if (asset === 'USDT') return '1';
  const directPrice = prices.get(`${asset}USDT`);
  if (directPrice) return directPrice;
  if (asset === 'USDC') return prices.get('USDCUSDT') ?? '1';
  const usdcPrice = prices.get(`${asset}USDC`);
  if (!usdcPrice) return undefined;
  return multiplyUnsignedDecimals(usdcPrice, prices.get('USDCUSDT') ?? '1');
}

function multiplyUnsignedDecimals(left: string, right: string, maximumScale = 8): string {
  const [leftWhole = '0', leftFraction = ''] = left.split('.');
  const [rightWhole = '0', rightFraction = ''] = right.split('.');
  let product = BigInt(`${leftWhole}${leftFraction}`) * BigInt(`${rightWhole}${rightFraction}`);
  let scale = leftFraction.length + rightFraction.length;
  if (scale > maximumScale) {
    const divisor = 10n ** BigInt(scale - maximumScale);
    product = (product + divisor / 2n) / divisor;
    scale = maximumScale;
  }
  const digits = product.toString().padStart(scale + 1, '0');
  if (scale === 0) return digits;
  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}
