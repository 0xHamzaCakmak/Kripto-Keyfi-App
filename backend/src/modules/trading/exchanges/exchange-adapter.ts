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

export interface ExchangeAdapter {
  validateCredentials(): Promise<CredentialValidationResult>;
  getBalances(): Promise<ExchangeBalance[]>;
}

export class ExchangeAdapterError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ExchangeAdapterError';
  }
}
