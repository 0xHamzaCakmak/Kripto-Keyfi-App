import { ExchangeAdapterError } from './exchange-adapter.js';

export async function getJson(url: URL, headers: Record<string, string>): Promise<unknown> {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(8_000) });
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) throw new ExchangeAdapterError('EXCHANGE_REJECTED', safeExchangeMessage(response.status));
    return body;
  } catch (error) {
    if (error instanceof ExchangeAdapterError) throw error;
    throw new ExchangeAdapterError('EXCHANGE_UNAVAILABLE', 'Borsa servisine güvenli bağlantı kurulamadı.');
  }
}

function safeExchangeMessage(status: number) {
  if (status === 401 || status === 403) return 'API anahtarı, secret veya hesap yetkileri doğrulanamadı.';
  if (status === 429) return 'Borsa istek limiti aşıldı. Lütfen daha sonra tekrar deneyin.';
  return 'Borsa bağlantı isteğini reddetti.';
}
