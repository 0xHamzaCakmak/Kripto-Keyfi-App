import { createHmac } from 'node:crypto';
import { env } from '../../../config/env.js';

export interface OKXTopKOLQuery {
  chainIndex: '1' | '56' | '501';
  tokenAddress: string;
  sortBy?: '1' | '2' | '3';
  timeFrame?: '1' | '2' | '3' | '4';
  limit?: number;
}

export function createOKXSignature(timestamp: string, method: string, requestPath: string, secret: string) {
  return createHmac('sha256', secret).update(`${timestamp}${method.toUpperCase()}${requestPath}`).digest('base64');
}

export async function getOKXTopKOLs(query: OKXTopKOLQuery): Promise<unknown> {
  if (!env.OKX_ONCHAIN_API_KEY || !env.OKX_ONCHAIN_SECRET_KEY || !env.OKX_ONCHAIN_PASSPHRASE) {
    throw new Error('OKX OnchainOS credentials are not configured');
  }
  const params = new URLSearchParams({
    chainIndex: query.chainIndex,
    tokenAddress: query.tokenAddress,
    sortBy: query.sortBy ?? '1',
    timeFrame: query.timeFrame ?? '3',
    limit: String(Math.min(50, Math.max(1, query.limit ?? 20))),
  });
  const requestPath = `/api/v6/dex/market/social/vibe/top-kols?${params.toString()}`;
  const timestamp = new Date().toISOString();
  const response = await fetch(`${env.OKX_ONCHAIN_API_BASE_URL}${requestPath}`, {
    headers: {
      Accept: 'application/json',
      'OK-ACCESS-KEY': env.OKX_ONCHAIN_API_KEY,
      'OK-ACCESS-SIGN': createOKXSignature(timestamp, 'GET', requestPath, env.OKX_ONCHAIN_SECRET_KEY),
      'OK-ACCESS-PASSPHRASE': env.OKX_ONCHAIN_PASSPHRASE,
      'OK-ACCESS-TIMESTAMP': timestamp,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`OKX OnchainOS request failed with status ${response.status}`);
  return response.json() as Promise<unknown>;
}
