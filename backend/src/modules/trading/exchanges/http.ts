import { ExchangeAdapterError } from './exchange-adapter.js';

export async function getJson(url: URL, headers: Record<string, string>): Promise<unknown> {
  return requestJson(url, { method: 'GET', headers });
}

export async function requestJson(
  url: URL,
  options: { method: 'GET' | 'POST' | 'DELETE'; headers: Record<string, string>; body?: string; acceptedErrorCodes?: Array<string | number> },
): Promise<unknown> {
  try {
    const response = await fetch(url, {
      method: options.method,
      headers: options.headers,
      ...(options.body === undefined ? {} : { body: options.body }),
      signal: AbortSignal.timeout(8_000),
    });
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const exchangeCode = responseCode(body);
      if (exchangeCode !== undefined && options.acceptedErrorCodes?.includes(exchangeCode)) return body;
      throw safeExchangeError(response.status, exchangeCode);
    }
    return body;
  } catch (error) {
    if (error instanceof ExchangeAdapterError) throw error;
    throw new ExchangeAdapterError('EXCHANGE_UNAVAILABLE', 'Borsa servisine güvenli bağlantı kurulamadı.');
  }
}

function responseCode(body: unknown): string | number | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const candidate = body as { code?: unknown; retCode?: unknown };
  if (typeof candidate.code === 'number' || typeof candidate.code === 'string') return candidate.code;
  if (typeof candidate.retCode === 'number' || typeof candidate.retCode === 'string') return candidate.retCode;
  return undefined;
}

function safeExchangeError(status: number, code: string | number | undefined) {
  if (code === -2019 || code === 110007) return new ExchangeAdapterError('INSUFFICIENT_BALANCE', 'Emir oluşturulamadı. Kullanılabilir teminat yetersiz.', code);
  if (code === -2021) return new ExchangeAdapterError('ORDER_REJECTED', 'Tetikleme fiyatı mevcut piyasa koşullarına uygun değil.', code);
  if (code === -2022) return new ExchangeAdapterError('REDUCE_ONLY_REJECTED', 'Reduce-only emir mevcut pozisyonu güvenli biçimde azaltamadığı için borsa tarafından reddedildi.', code);
  if (code === -1111 || code === 110003) return new ExchangeAdapterError('INVALID_PRECISION', 'Fiyat veya miktar paritenin adım kurallarına uygun değil.', code);
  if (code === -2015 || code === 10003 || status === 401 || status === 403) return new ExchangeAdapterError('EXCHANGE_PERMISSION_DENIED', 'API anahtarı, secret veya işlem yetkileri doğrulanamadı.', code);
  if (code === 10006 || status === 429) return new ExchangeAdapterError('EXCHANGE_RATE_LIMITED', 'Borsa istek limiti aşıldı. Lütfen daha sonra tekrar deneyin.', code);
  if (code === 10001) return new ExchangeAdapterError('EXCHANGE_VALIDATION_ERROR', 'Borsa emir parametrelerini geçersiz buldu.', code);
  return new ExchangeAdapterError('EXCHANGE_REJECTED', safeExchangeMessage(status), code);
}

function safeExchangeMessage(status: number) {
  if (status === 401 || status === 403) return 'API anahtarı, secret veya hesap yetkileri doğrulanamadı.';
  if (status === 429) return 'Borsa istek limiti aşıldı. Lütfen daha sonra tekrar deneyin.';
  return 'Borsa bağlantı isteğini reddetti.';
}
