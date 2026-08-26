import { afterEach, describe, expect, it, vi } from 'vitest';
import { BinanceFuturesAdapter, getBinanceFuturesPublicSymbols } from '../src/modules/trading/exchanges/binance-futures.adapter.js';

describe('Binance manual trading adapter', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads PAPER symbol rules from the public production market without a private API request', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = input.toString();
      if (url === 'https://fapi.binance.com/fapi/v1/exchangeInfo') return Response.json({ symbols: [{
        symbol: 'SOLUSDT', status: 'TRADING', baseAsset: 'SOL', quoteAsset: 'USDT', contractType: 'PERPETUAL',
        filters: [
          { filterType: 'PRICE_FILTER', tickSize: '0.001' },
          { filterType: 'LOT_SIZE', stepSize: '0.1', minQty: '0.1', maxQty: '10000' },
          { filterType: 'MARKET_LOT_SIZE', maxQty: '1000' },
          { filterType: 'MIN_NOTIONAL', notional: '5' },
        ],
      }] });
      return Response.json({}, { status: 401 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getBinanceFuturesPublicSymbols()).resolves.toMatchObject([{ symbol: 'SOLUSDT', maxLeverage: 20 }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0].toString()).not.toContain('leverageBracket');
  });

  it('combines exchange filters and leverage brackets into symbol rules', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = input.toString();
      if (url.endsWith('/fapi/v1/exchangeInfo')) return Response.json({ symbols: [{
        symbol: 'BTCUSDT', status: 'TRADING', baseAsset: 'BTC', quoteAsset: 'USDT', contractType: 'PERPETUAL',
        filters: [
          { filterType: 'PRICE_FILTER', tickSize: '0.10' },
          { filterType: 'LOT_SIZE', stepSize: '0.001', minQty: '0.001', maxQty: '1000' },
          { filterType: 'MARKET_LOT_SIZE', maxQty: '100' },
          { filterType: 'MIN_NOTIONAL', notional: '5' },
        ],
      }, {
        symbol: 'BTCUSDC', status: 'TRADING', baseAsset: 'BTC', quoteAsset: 'USDC', contractType: 'PERPETUAL',
        filters: [
          { filterType: 'PRICE_FILTER', tickSize: '0.10' },
          { filterType: 'LOT_SIZE', stepSize: '0.001', minQty: '0.001', maxQty: '500' },
          { filterType: 'MARKET_LOT_SIZE', maxQty: '50' },
          { filterType: 'MIN_NOTIONAL', notional: '5' },
        ],
      }] });
      if (url.includes('/fapi/v1/leverageBracket?')) return Response.json([{ symbol: 'BTCUSDT', brackets: [{ initialLeverage: 125 }] }, { symbol: 'BTCUSDC', brackets: [{ initialLeverage: 75 }] }]);
      return Response.json({}, { status: 404 });
    }));
    const adapter = new BinanceFuturesAdapter({ apiKey: 'demo-key', apiSecret: 'demo-secret' });
    await expect(adapter.getSymbols()).resolves.toEqual([{
      symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING', tickSize: '0.10',
      stepSize: '0.001', minQuantity: '0.001', maxQuantity: '100', minNotional: '5', maxLeverage: 125,
    }, {
      symbol: 'BTCUSDC', baseAsset: 'BTC', quoteAsset: 'USDC', status: 'TRADING', tickSize: '0.10',
      stepSize: '0.001', minQuantity: '0.001', maxQuantity: '50', minNotional: '5', maxLeverage: 75,
    }]);
  });

  it('validates TRADE permission with a test order that never reaches the matching engine', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      if (url.includes('/fapi/v3/account?')) return Response.json({ canTrade: false, canWithdraw: false });
      if (url.endsWith('/fapi/v1/exchangeInfo')) return Response.json({ symbols: [{
        symbol: 'BTCUSDT', status: 'TRADING', quoteAsset: 'USDT', contractType: 'PERPETUAL',
        filters: [{ filterType: 'MARKET_LOT_SIZE', minQty: '0.001' }],
      }] });
      if (url.includes('/fapi/v1/order/test?') && init?.method === 'POST') return Response.json({});
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new BinanceFuturesAdapter({ apiKey: 'demo-key', apiSecret: 'demo-secret' });
    await expect(adapter.validateCredentials()).resolves.toEqual({ canTrade: true, withdrawalEnabled: false });
    expect(fetchMock.mock.calls.some(([url]) => url.toString().includes('/fapi/v1/order/test?'))).toBe(true);
  });

  it('sends a client id and maps placed, open, canceled orders and positions', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString(); const method = init?.method ?? 'GET';
      if (url.includes('/fapi/v1/marginType?')) return Response.json({ code: 200 });
      if (url.includes('/fapi/v1/leverage?')) return Response.json({ leverage: 3 });
      if (url.includes('/fapi/v1/order?') && method === 'POST') return Response.json({ orderId: 91, clientOrderId: 'kk_test', symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', status: 'NEW', origQty: '0.002', executedQty: '0', price: '60000', reduceOnly: false });
      if (url.includes('/fapi/v1/openOrders?')) return Response.json([{ orderId: 91, clientOrderId: 'kk_test', symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', status: 'NEW', origQty: '0.002', executedQty: '0', price: '60000', reduceOnly: false }]);
      if (url.includes('/fapi/v1/order?') && method === 'DELETE') return Response.json({ orderId: 91, clientOrderId: 'kk_test', symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', status: 'CANCELED', origQty: '0.002', executedQty: '0', price: '60000', reduceOnly: false });
      if (url.includes('/fapi/v2/positionRisk?')) return Response.json([{ symbol: 'BTCUSDT', positionAmt: '-0.003', entryPrice: '62000', markPrice: '61000', unRealizedProfit: '3', liquidationPrice: '80000', leverage: '3', marginType: 'isolated', positionSide: 'BOTH' }]);
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new BinanceFuturesAdapter({ apiKey: 'demo-key', apiSecret: 'demo-secret' });
    await adapter.configurePosition('BTCUSDT', 3, 'ISOLATED');
    const placed = await adapter.placeOrder({ symbol: 'BTCUSDT', side: 'BUY', type: 'LIMIT', quantity: '0.002', price: '60000', reduceOnly: false, clientOrderId: 'kk_test' });
    expect(placed).toMatchObject({ exchangeOrderId: '91', clientOrderId: 'kk_test', type: 'LIMIT', status: 'NEW' });
    expect((await adapter.getOpenOrders())[0]).toMatchObject({ exchangeOrderId: '91', quantity: '0.002' });
    expect(await adapter.cancelOrder('BTCUSDT', '91')).toMatchObject({ status: 'CANCELED' });
    expect((await adapter.getPositions())[0]).toMatchObject({ positionKey: 'BTCUSDT:BOTH', side: 'SHORT', quantity: '0.003', marginMode: 'ISOLATED' });
    expect(fetchMock.mock.calls.some(([url]) => url.toString().includes('newClientOrderId=kk_test'))).toBe(true);
  });

  it('maps the domain CROSS margin mode to Binance CROSSED', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => { void input; return Response.json({ code: 200 }); });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new BinanceFuturesAdapter({ apiKey: 'demo-key', apiSecret: 'demo-secret' });
    await adapter.configurePosition('BTCUSDT', 2, 'CROSS');
    expect(fetchMock.mock.calls[0]?.[0].toString()).toContain('marginType=CROSSED');
  });

  it('updates leverage when open protective orders block a no-op margin request', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = input.toString();
      if (url.includes('/fapi/v1/marginType?')) {
        return Response.json({ code: -4067, msg: 'Position side cannot be changed if there exists open orders.' }, { status: 400 });
      }
      if (url.includes('/fapi/v2/positionRisk?')) {
        return Response.json([{
          symbol: 'BTCUSDT', positionAmt: '0.01', entryPrice: '60000', markPrice: '60100',
          unRealizedProfit: '1', leverage: '1', marginType: 'isolated', positionSide: 'BOTH',
        }]);
      }
      if (url.includes('/fapi/v1/leverage?')) return Response.json({ leverage: 5 });
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new BinanceFuturesAdapter({ apiKey: 'demo-key', apiSecret: 'demo-secret' });

    await expect(adapter.configurePosition('BTCUSDT', 5, 'ISOLATED')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls.some(([url]) => url.toString().includes('/fapi/v1/leverage?'))).toBe(true);
  });

  it('loads actual Binance TESTNET Futures fills for bot history', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = input.toString();
      if (url.includes('/fapi/v1/userTrades?')) return Response.json([{
        id: 77, orderId: 91, symbol: 'BTCUSDT', side: 'SELL', price: '61000', qty: '0.002',
        quoteQty: '122', realizedPnl: '2', commission: '0.0488', commissionAsset: 'USDT', maker: false,
        time: 1700000000000,
      }]);
      return Response.json({}, { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const adapter = new BinanceFuturesAdapter({ apiKey: 'demo-key', apiSecret: 'demo-secret' });

    await expect(adapter.getUserTrades('BTCUSDT')).resolves.toEqual([{
      tradeId: '77', exchangeOrderId: '91', symbol: 'BTCUSDT', side: 'SELL', price: '61000', quantity: '0.002',
      quoteQuantity: '122', realizedPnl: '2', commission: '0.0488', commissionAsset: 'USDT', maker: false,
      occurredAt: '2023-11-14T22:13:20.000Z',
    }]);
    expect(fetchMock.mock.calls[0]?.[0].toString()).toContain('symbol=BTCUSDT');
  });
});
