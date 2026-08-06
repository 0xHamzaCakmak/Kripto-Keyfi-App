import type { NewsSource } from '@prisma/client';
import { ApiError } from '../../../utils/api-error.js';
import type { NewsProvider, NormalizedNewsItem } from './news-provider.js';

type ApiConfig = { endpoint?: string; headers?: Record<string, string> };
export class ApiNewsProvider implements NewsProvider {
  async fetch(source: NewsSource): Promise<NormalizedNewsItem[]> {
    const config = (source.apiConfig ?? {}) as ApiConfig;
    if (!config.endpoint || !config.endpoint.startsWith('https://')) throw new ApiError(400, 'API source requires an HTTPS endpoint in its admin configuration', 'NEWS_SOURCE_INVALID');
    const response = await fetch(config.endpoint, { headers: { accept: 'application/json', ...(config.headers ?? {}) }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new ApiError(502, `Source returned HTTP ${response.status}`, 'NEWS_SOURCE_FETCH_FAILED');
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new ApiError(502, 'API source must return a normalized news array', 'NEWS_SOURCE_INVALID_RESPONSE');
    return payload.filter((item): item is NormalizedNewsItem => Boolean(item && typeof item === 'object' && typeof (item as NormalizedNewsItem).title === 'string' && typeof (item as NormalizedNewsItem).originalUrl === 'string' && (item as NormalizedNewsItem).publishedAt));
  }
}
