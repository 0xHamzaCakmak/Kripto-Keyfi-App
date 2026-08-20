import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';

export type DateRange = { startAt: number; endAt: number };
export type Metric = { x: string; y: number };
export type UmamiStats = { pageviews: number; visitors: number; visits: number; bounces: number; totaltime: number };
export type UmamiSeries = { pageviews: Metric[]; sessions: Metric[] };

let cachedToken: { value: string; expiresAt: number } | null = null;
const responseCache = new Map<string, { value: unknown; expiresAt: number }>();

export const isUmamiConfigured = () => Boolean(env.UMAMI_API_URL && env.UMAMI_WEBSITE_ID && env.UMAMI_USERNAME && env.UMAMI_PASSWORD);

async function login() {
  if (!isUmamiConfigured()) throw new ApiError(503, 'Umami henüz yapılandırılmadı.', 'UMAMI_NOT_CONFIGURED');
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const response = await fetch(`${env.UMAMI_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: env.UMAMI_USERNAME, password: env.UMAMI_PASSWORD }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new ApiError(502, 'Umami kimlik doğrulaması başarısız.', 'UMAMI_AUTH_FAILED');
  const body = await response.json() as { token?: string };
  if (!body.token) throw new ApiError(502, 'Umami geçerli bir token döndürmedi.', 'UMAMI_INVALID_RESPONSE');
  cachedToken = { value: body.token, expiresAt: Date.now() + 10 * 60 * 1000 };
  return body.token;
}

async function request<T>(path: string, params: Record<string, string | number>, retry = true): Promise<T> {
  const token = await login();
  const url = new URL(`${env.UMAMI_API_URL}/websites/${env.UMAMI_WEBSITE_ID}/${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const cacheKey = url.toString();
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;
  let response: Response;
  try {
    response = await fetch(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  } catch {
    throw new ApiError(502, 'Umami servisine ulaşılamadı.', 'UMAMI_UNAVAILABLE');
  }
  if (response.status === 401 && retry) {
    cachedToken = null;
    return request<T>(path, params, false);
  }
  if (!response.ok) throw new ApiError(502, 'Umami raporu alınamadı.', 'UMAMI_REQUEST_FAILED');
  const value = await response.json() as T;
  responseCache.set(cacheKey, { value, expiresAt: Date.now() + 60_000 });
  if (responseCache.size > 100) {
    for (const [key, item] of responseCache) if (item.expiresAt <= Date.now()) responseCache.delete(key);
  }
  return value;
}

export const getStats = (range: DateRange) => request<UmamiStats>('stats', range);
export const getPageviews = (range: DateRange) => request<UmamiSeries>('pageviews', { ...range, unit: 'day', timezone: 'Europe/Istanbul' });
export const getMetrics = (type: 'path' | 'referrer' | 'device' | 'browser' | 'country', range: DateRange, limit = 20) =>
  request<Metric[]>('metrics', { ...range, type, limit });
