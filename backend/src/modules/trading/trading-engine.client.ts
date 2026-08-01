import { randomUUID } from 'node:crypto';
import type { ExchangeAccount, ManualOrderPreview, TradingOrder } from '@prisma/client';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import type { ExchangeBalance, ExchangeOrder, ExchangePosition, ExchangeSymbol } from './exchanges/exchange-adapter.js';
import type { PreviewOrderInput } from './manual-trading.schema.js';

type Account = Pick<ExchangeAccount, 'id' | 'userId' | 'provider' | 'environment' | 'accountType'>;
type Snapshot = { balances: ExchangeBalance[]; symbols: ExchangeSymbol[]; orders: ExchangeOrder[]; positions: ExchangePosition[] };

export async function getTradingEngineSnapshot(account: Account): Promise<Snapshot> {
  return engineRequest(`/internal/v1/shadow/accounts/${encodeURIComponent(account.id)}/snapshot?userId=${encodeURIComponent(account.userId)}`, { method: 'GET' });
}

export async function previewTradingEngineOrder(account: Account, input: PreviewOrderInput) {
  return engineRequest<{
    request: PreviewOrderInput; rule: ExchangeSymbol; markPrice: string; estimatedNotional: string;
  }>('/internal/v1/execution/orders/preview', {
    method: 'POST', body: JSON.stringify({ account: accountRef(account), ...input, exchangeAccountId: undefined }),
  });
}

export async function executeTradingEngineOrder(account: Account, preview: ManualOrderPreview, order: TradingOrder) {
  return engineRequest<{ order: ExchangeOrder; idempotentReplay: boolean }>('/internal/v1/execution/orders', {
    method: 'POST', body: JSON.stringify({
      meta: commandMeta(account.userId, order.idempotencyKey, order.clientOrderId), tradingOrderId: order.id,
      account: accountRef(account), symbol: preview.symbol, side: preview.side, type: preview.type,
      quantity: preview.quantity.toString(), price: preview.price?.toString(), stopPrice: preview.stopPrice?.toString(),
      leverage: preview.leverage, marginMode: preview.marginMode, reduceOnly: preview.reduceOnly,
    }),
  });
}

export async function cancelTradingEngineOrder(account: Account, exchangeOrderId: string, symbol: string, idempotencyKey: string) {
  const clientOrderId = `kkc_${randomUUID().replaceAll('-', '').slice(0, 30)}`;
  return engineRequest<{ order: ExchangeOrder; idempotentReplay: boolean }>('/internal/v1/execution/orders/cancel', {
    method: 'POST', body: JSON.stringify({
      meta: commandMeta(account.userId, idempotencyKey, clientOrderId), account: accountRef(account),
      exchangeOrderId, symbol,
    }),
  });
}

function accountRef(account: Account) {
  return { id: account.id, userId: account.userId, provider: account.provider, environment: account.environment, accountType: account.accountType };
}

function commandMeta(actorUserId: string, idempotencyKey: string, clientOrderId: string) {
  return { requestId: randomUUID(), actorUserId, idempotencyKey, clientOrderId, requestedAt: new Date().toISOString() };
}

async function engineRequest<T>(path: string, init: { method: 'GET' | 'POST'; body?: string }): Promise<T> {
  if (!env.TRADING_ENGINE_EXECUTION_ENABLED && init.method === 'POST') {
    throw new ApiError(409, 'Go executor backend yapılandırmasında kapalı.', 'GO_EXECUTOR_DISABLED');
  }
  try {
    const response = await fetch(new URL(path, env.TRADING_ENGINE_URL), {
      method: init.method, headers: {
        Authorization: `Bearer ${env.TRADING_ENGINE_TOKEN}`, 'X-Request-ID': randomUUID(),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      }, ...(init.body ? { body: init.body } : {}), signal: AbortSignal.timeout(15_000),
    });
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const normalized = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
      if (normalized && typeof normalized === 'object') {
        const error = normalized as { code?: string; message?: string; reconciliationRequired?: boolean };
        throw new ApiError(response.status, error.message ?? 'Go Trading Engine isteği reddetti.', error.code ?? 'GO_EXECUTION_REJECTED', { reconciliationRequired: error.reconciliationRequired === true });
      }
      throw new ApiError(response.status, 'Go Trading Engine isteği tamamlanamadı.', 'GO_EXECUTION_FAILED');
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, 'Go Trading Engine ile güvenli bağlantı kurulamadı.', 'GO_EXECUTOR_UNAVAILABLE');
  }
}
