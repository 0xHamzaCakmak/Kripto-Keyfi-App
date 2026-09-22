import { createHmac } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { decryptCredential } from '../../security/credential-vault.js';
import { ApiError } from '../../utils/api-error.js';
import { requestJson } from './exchanges/http.js';

type Account = { provider: string; accountType: string; apiKeyEncrypted: string; apiSecretEncrypted: string };
export type GridExecution = { id: string; time: number; quantity: string; quote: string; fee: string; feesComplete: boolean; realizedPnl?: string };
export type GridOrderSnapshot = { status: string; executed: string; quote: string; fee: string; baseFee: string; feesComplete: boolean; fillsComplete?: boolean; executions?: GridExecution[] };
type BinanceOrder = { status: string; executedQty: string; cumQuote?: string; cummulativeQuoteQty?: string };
type Trade = { id: number; time: number; qty: string; quoteQty: string; commission: string; commissionAsset: string; price: string; realizedPnl?: string };

/** Private read-only grid lookups. All exchange mutations go through Go. */
export class GridExchangeReader {
  constructor(private readonly account: Account) {}
  async request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const key = decryptCredential(this.account.apiKeyEncrypted), secret = decryptCredential(this.account.apiSecretEncrypted);
    const query = new URLSearchParams(params), timestamp = String(Date.now());
    if (this.account.provider === 'BINANCE') {
      query.set('timestamp', timestamp); query.set('recvWindow', '5000');
      query.set('signature', createHmac('sha256', secret).update(query.toString()).digest('hex'));
      return await requestJson(new URL(`${path}?${query}`, this.account.accountType === 'SPOT' ? 'https://demo-api.binance.com' : 'https://demo-fapi.binance.com'), { method: 'GET', headers: { 'X-MBX-APIKEY': key } }) as T;
    }
    const body = await requestJson(new URL(`${path}?${query}`, 'https://api-demo.bybit.com'), { method: 'GET', headers: { 'X-BAPI-API-KEY': key, 'X-BAPI-TIMESTAMP': timestamp, 'X-BAPI-RECV-WINDOW': '5000', 'X-BAPI-SIGN': createHmac('sha256', secret).update(`${timestamp}${key}5000${query}`).digest('hex') } }) as { retCode: number; result: T };
    if (body.retCode !== 0) throw new ApiError(422, 'Demo grid borsa verisi doğrulanamadı.', 'GRID_EXCHANGE_READ_FAILED');
    return body.result;
  }
  async order(symbol: string, exchangeOrderId: string, baseAsset: string, conditional = false, clientOrderId?: string): Promise<GridOrderSnapshot> {
    if (this.account.provider !== 'BINANCE') {
      type Row = { orderId: string; orderStatus: string; cumExecQty: string; cumExecValue: string; cumExecFee?: string; cumFeeDetail?: Record<string, string> };
      const result = await this.request<{ list: Row[] }>('/v5/order/history', { category: 'linear', symbol, orderId: exchangeOrderId });
      let row = result.list.find(o => o.orderId === exchangeOrderId);
      if (!row) row = (await this.request<{ list: Row[] }>('/v5/order/realtime', { category: 'linear', symbol, orderId: exchangeOrderId })).list.find(o => o.orderId === exchangeOrderId);
      if (!row) throw new ApiError(409, 'Emir durumu henüz doğrulanamadı; yeni emir üretilmiyor.', 'GRID_ORDER_UNCERTAIN');
      const fee = row.cumFeeDetail?.USDT ?? row.cumExecFee;
      const feesComplete = new Prisma.Decimal(row.cumExecQty).isZero() || (fee !== undefined && fee !== '' && Object.keys(row.cumFeeDetail ?? {}).every(asset => asset === 'USDT'));
      const executions: GridExecution[] = [];
      if (new Prisma.Decimal(row.cumExecQty).gt(0)) {
        let cursor = ''; const seen = new Set<string>();
        for (let page = 0; page < 100; page++) {
          const result = await this.request<{ list: Array<{ execId: string; execTime: string; execQty: string; execValue: string; execFee: string; feeCurrency?: string }>; nextPageCursor?: string }>('/v5/execution/list', { category: 'linear', symbol, orderId: exchangeOrderId, limit: '100', ...(cursor ? { cursor } : {}) });
          for (const e of result.list) if (!seen.has(e.execId)) { seen.add(e.execId); executions.push({ id: e.execId, time: Number(e.execTime), quantity: e.execQty, quote: e.execValue, fee: e.execFee, feesComplete: !e.feeCurrency || e.feeCurrency === 'USDT' }); }
          if (!result.nextPageCursor) break;
          if (result.nextPageCursor === cursor || page === 99) throw new ApiError(409, 'Gerçekleşme geçmişi eksik.', 'GRID_FILLS_INCOMPLETE');
          cursor = result.nextPageCursor;
        }
      }
      return { status: row.orderStatus.toUpperCase(), executed: row.cumExecQty, quote: row.cumExecValue, fee: fee || '0', baseFee: '0', feesComplete, executions, fillsComplete: executions.reduce((s, e) => s.add(e.quantity), new Prisma.Decimal(0)).eq(row.cumExecQty) };
    }
    const spot = this.account.accountType === 'SPOT';
    if (conditional && !spot) {
      const algo = await this.request<{ algoStatus: string; actualOrderId?: string }>('/fapi/v1/algoOrder', clientOrderId ? { clientAlgoId: clientOrderId } : { algoId: exchangeOrderId });
      if (!algo.actualOrderId || algo.actualOrderId === '0') return { status: algo.algoStatus, executed: '0', quote: '0', fee: '0', baseFee: '0', feesComplete: true };
      exchangeOrderId = algo.actualOrderId;
    }
    const order = await this.request<BinanceOrder>(spot ? '/api/v3/order' : '/fapi/v1/order', { symbol, orderId: exchangeOrderId });
    const value: GridOrderSnapshot = { status: order.status, executed: order.executedQty, quote: order.cumQuote ?? order.cummulativeQuoteQty ?? '0', fee: '0', baseFee: '0', feesComplete: true, executions: [] };
    if (new Prisma.Decimal(value.executed).isZero()) return value;
    let fromId: string | undefined;
    let filledQuantity = new Prisma.Decimal(0);
    const seen = new Set<number>();
    for (let page = 0; page < 20; page++) {
      const trades = await this.request<Trade[]>(spot ? '/api/v3/myTrades' : '/fapi/v1/userTrades', { symbol, orderId: exchangeOrderId, limit: '1000', ...(fromId ? { fromId } : {}) });
      for (const t of trades) {
        if (seen.has(t.id)) continue;
        seen.add(t.id); filledQuantity = filledQuantity.add(t.qty);
        value.executions!.push({ id: String(t.id), time: t.time, quantity: t.qty, quote: t.quoteQty, fee: t.commissionAsset === 'USDT' ? t.commission : t.commissionAsset === baseAsset ? new Prisma.Decimal(t.commission).mul(t.price).toFixed() : '0', feesComplete: t.commissionAsset === 'USDT' || t.commissionAsset === baseAsset || new Prisma.Decimal(t.commission).isZero(), ...(t.realizedPnl !== undefined ? { realizedPnl: t.realizedPnl } : {}) });
        if (t.commissionAsset === 'USDT') value.fee = new Prisma.Decimal(value.fee).add(t.commission).toFixed();
        else if (t.commissionAsset === baseAsset) { value.baseFee = new Prisma.Decimal(value.baseFee).add(t.commission).toFixed(); value.fee = new Prisma.Decimal(value.fee).add(new Prisma.Decimal(t.commission).mul(t.price)).toFixed(); }
        else value.feesComplete = false;
      }
      if (trades.length < 1000) {
        if (!filledQuantity.eq(value.executed)) {
          if (spot) throw new ApiError(409, 'Spot gerçekleşme/komisyon miktarı henüz doğrulanamadı.', 'GRID_FILLS_INCOMPLETE');
          value.feesComplete = false; value.fillsComplete = false;
        }
        return value;
      }
      fromId = String(trades[trades.length - 1]!.id + 1);
    }
    throw new ApiError(409, 'Emir gerçekleşmelerinin tamamı okunamadı.', 'GRID_FILLS_INCOMPLETE');
  }
  async funding(symbol: string, startedAt: Date): Promise<string | null> {
    if (this.account.accountType === 'SPOT') return '0';
    if (this.account.provider !== 'BINANCE') {
      let total = new Prisma.Decimal(0);
      const end = Date.now(), week = 7 * 86400000;
      for (let start = startedAt.getTime(); start <= end; start += week) {
        let cursor = '';
        for (let page = 0; page < 100; page++) {
          const result = await this.request<{ list: Array<{ id: string; symbol: string; currency: string; funding: string }>; nextPageCursor?: string }>('/v5/account/transaction-log', { accountType: 'UNIFIED', category: 'linear', currency: 'USDT', type: 'SETTLEMENT', startTime: String(start), endTime: String(Math.min(end, start + week - 1)), limit: '50', ...(cursor ? { cursor } : {}) });
          for (const row of result.list) if (row.symbol === symbol && row.currency === 'USDT') total = total.add(row.funding || '0');
          if (!result.nextPageCursor) break;
          if (result.nextPageCursor === cursor || page === 99) return null;
          cursor = result.nextPageCursor;
        }
      }
      return total.toFixed();
    }
    let total = new Prisma.Decimal(0);
    for (let page = 1; page <= 100; page++) {
      const rows = await this.request<Array<{ income: string; asset: string }>>('/fapi/v1/income', { symbol, incomeType: 'FUNDING_FEE', startTime: String(startedAt.getTime()), limit: '1000', page: String(page) });
      for (const row of rows) { if (row.asset !== 'USDT') return null; total = total.add(row.income); }
      if (rows.length < 1000) return total.toFixed();
    }
    return null;
  }
  async maintenanceRate(symbol: string, maximumNotional: string): Promise<string | undefined> {
    if (this.account.accountType === 'SPOT') return undefined;
    if (this.account.provider === 'BINANCE') {
      const rows = await this.request<Array<{ symbol: string; brackets: Array<{ maintMarginRatio: number; notionalFloor: number }> }>>('/fapi/v1/leverageBracket', { symbol });
      const brackets = rows.find(row => row.symbol === symbol)?.brackets;
      if (!brackets?.length) throw new ApiError(409, 'Bakım marjini tablosu okunamadı.', 'GRID_MARGIN_DATA_UNAVAILABLE');
      const applicable = brackets.filter(b => new Prisma.Decimal(b.notionalFloor).lte(maximumNotional));
      if (!applicable.length) throw new ApiError(409, 'Bakım marjini kademesi bulunamadı.', 'GRID_MARGIN_DATA_UNAVAILABLE');
      return Prisma.Decimal.max(...applicable.map(b => new Prisma.Decimal(b.maintMarginRatio))).toFixed();
    }
    const result = await this.request<{ list: Array<{ symbol: string; maintenanceMargin: string; riskLimitValue: string }> }>('/v5/market/risk-limit', { category: 'linear', symbol });
    const rows = result.list.filter(row => row.symbol === symbol).sort((a,b) => Number(a.riskLimitValue) - Number(b.riskLimitValue));
    const tier = rows.find(row => new Prisma.Decimal(row.riskLimitValue).gte(maximumNotional));
    if (!tier) throw new ApiError(409, 'Bakım marjini tablosu okunamadı.', 'GRID_MARGIN_DATA_UNAVAILABLE');
    return String(tier.maintenanceMargin);
  }
}
