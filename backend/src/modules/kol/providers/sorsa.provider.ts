import { env } from '../../../config/env.js';

async function sorsaRequest<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!env.SORSA_API_KEY) throw new Error('SORSA_API_KEY is not configured');
  const url = new URL(`${env.SORSA_API_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    headers: { ApiKey: env.SORSA_API_KEY, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Sorsa request failed with status ${response.status}`);
  return response.json() as Promise<T>;
}

export function getSorsaProfile(username: string) {
  return sorsaRequest<unknown>('/info', { username: username.replace(/^@/, '') });
}

export function searchSorsaTweets(query: string, cursor?: string) {
  return sorsaRequest<unknown>('/search-tweets', { query, ...(cursor ? { cursor } : {}) });
}
