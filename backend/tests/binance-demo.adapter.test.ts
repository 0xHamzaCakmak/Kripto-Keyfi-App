import { afterEach, describe, expect, it, vi } from 'vitest';
import { BinanceFuturesAdapter } from '../src/modules/trading/exchanges/binance-futures.adapter.js';

describe('Binance demo adapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('Spot/Main ve USD-M Futures bakiyelerini ayrı cüzdan türleriyle döndürür', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = input.toString();
      if (url.startsWith('https://demo-api.binance.com/api/v3/account?')) {
        return Response.json({
          balances: [
            { asset: 'USDT', free: '120.25', locked: '4.75' },
            { asset: 'XRP', free: '10.00000000', locked: '2.00000000' },
            { asset: 'BTC', free: '0.00000000', locked: '0.00000000' },
          ],
        });
      }
      if (url === 'https://demo-api.binance.com/api/v3/ticker/price') {
        return Response.json([
          { symbol: 'XRPUSDT', price: '0.50000000' },
          { symbol: 'USDCUSDT', price: '0.99980000' },
        ]);
      }
      if (url.startsWith('https://demo-fapi.binance.com/fapi/v3/account?')) {
        return Response.json({
          assets: [
            { asset: 'USDT', walletBalance: '5000.00000000', availableBalance: '4900.00000000', unrealizedProfit: '12.50000000' },
            { asset: 'BNB', walletBalance: '0.00000000', availableBalance: '0.00000000', unrealizedProfit: '0.00000000' },
          ],
        });
      }
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const adapter = new BinanceFuturesAdapter({ apiKey: 'demo-key', apiSecret: 'demo-secret' });

    await expect(adapter.getBalances()).resolves.toEqual([
      {
        walletType: 'SPOT',
        asset: 'USDT',
        walletBalance: '125',
        availableBalance: '120.25',
        lockedBalance: '4.75',
        unrealizedPnl: '0',
        priceUsdt: '1',
        valueUsdt: '125',
      },
      {
        walletType: 'SPOT',
        asset: 'XRP',
        walletBalance: '12',
        availableBalance: '10.00000000',
        lockedBalance: '2.00000000',
        unrealizedPnl: '0',
        priceUsdt: '0.50000000',
        valueUsdt: '6',
      },
      {
        walletType: 'USD_M_FUTURES',
        asset: 'USDT',
        walletBalance: '5000.00000000',
        availableBalance: '4900.00000000',
        unrealizedPnl: '12.50000000',
        marginAvailable: false,
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
