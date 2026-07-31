import { createHmac } from 'node:crypto';
import type { CredentialValidationResult, ExchangeAdapter, ExchangeBalance, ExchangeCredentials } from './exchange-adapter.js';
import { ExchangeAdapterError } from './exchange-adapter.js';
import { getJson } from './http.js';

const BASE_URL = 'https://api-demo.bybit.com';
const RECV_WINDOW = '5000';

type BybitWallet = {
  retCode?: number;
  result?: { list?: Array<{ totalWalletBalance?: string; totalAvailableBalance?: string; totalPerpUPL?: string; coin?: Array<{ coin?: string; walletBalance?: string; equity?: string; unrealisedPnl?: string }> }> };
};

type BybitApiKeyInfo = {
  retCode?: number;
  result?: {
    readOnly?: number;
    permissions?: { ContractTrade?: string[]; Derivatives?: string[]; Wallet?: string[] };
  };
};

export class BybitV5Adapter implements ExchangeAdapter {
  constructor(private readonly credentials: ExchangeCredentials) {}

  async validateCredentials(): Promise<CredentialValidationResult> {
    const keyInfo = await this.signedGet<BybitApiKeyInfo>('/v5/user/query-api', '');
    const permissions = keyInfo.result?.permissions;
    const canTrade = keyInfo.result?.readOnly === 0 && (
      permissions?.ContractTrade?.includes('Order') === true || permissions?.Derivatives?.includes('DerivativesTrade') === true
    );
    return { canTrade, withdrawalEnabled: permissions?.Wallet?.includes('Withdraw') === true };
  }

  async getBalances(): Promise<ExchangeBalance[]> {
    const wallet = await this.wallet();
    const account = wallet.result?.list?.[0];
    return (account?.coin ?? [])
      .filter((coin) => Number(coin.walletBalance ?? 0) !== 0 || Number(coin.unrealisedPnl ?? 0) !== 0)
      .map((coin) => ({
        walletType: 'UNIFIED' as const,
        asset: coin.coin ?? 'UNKNOWN',
        walletBalance: coin.walletBalance ?? '0',
        availableBalance: coin.equity ?? '0',
        unrealizedPnl: coin.unrealisedPnl ?? '0',
      }));
  }

  private async wallet(): Promise<BybitWallet> {
    const query = 'accountType=UNIFIED';
    return this.signedGet<BybitWallet>('/v5/account/wallet-balance', query);
  }

  private async signedGet<T extends { retCode?: number }>(path: string, query: string): Promise<T> {
    const timestamp = Date.now().toString();
    const signature = createHmac('sha256', this.credentials.apiSecret)
      .update(`${timestamp}${this.credentials.apiKey}${RECV_WINDOW}${query}`)
      .digest('hex');
    const body = await getJson(new URL(`${path}${query ? `?${query}` : ''}`, BASE_URL), {
      'X-BAPI-API-KEY': this.credentials.apiKey,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': RECV_WINDOW,
      'X-BAPI-SIGN': signature,
    });
    if (!body || typeof body !== 'object') throw new ExchangeAdapterError('INVALID_EXCHANGE_RESPONSE', 'Bybit hesap cevabı doğrulanamadı.');
    const response = body as T;
    if (response.retCode !== 0) throw new ExchangeAdapterError('EXCHANGE_REJECTED', 'Bybit API anahtarı veya hesap yetkileri doğrulanamadı.');
    return response;
  }
}
