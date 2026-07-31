import type { ExchangeProvider } from '@prisma/client';
import { BinanceFuturesAdapter } from './binance-futures.adapter.js';
import { BybitV5Adapter } from './bybit-v5.adapter.js';
import type { ExchangeAdapter, ExchangeCredentials } from './exchange-adapter.js';

export function createExchangeAdapter(provider: ExchangeProvider, credentials: ExchangeCredentials): ExchangeAdapter {
  return provider === 'BINANCE' ? new BinanceFuturesAdapter(credentials) : new BybitV5Adapter(credentials);
}
