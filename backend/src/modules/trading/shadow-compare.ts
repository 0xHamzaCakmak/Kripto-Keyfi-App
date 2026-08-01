import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

type Resource = 'balances' | 'symbols' | 'orders' | 'positions';
type Snapshot = Record<Resource, unknown[]>;

const cache = new Map<string, { expiresAt: number; request: Promise<Snapshot> }>();
const CACHE_MS = 2_000;

export function scheduleShadowComparison(userId: string, accountId: string, resource: Resource, expected: unknown[]): void {
  if (!env.TRADING_ENGINE_SHADOW_COMPARE_ENABLED) return;
  void compareShadow(userId, accountId, resource, expected).catch((error: unknown) => {
    logger.warn({
      event: 'trading_shadow_unavailable', accountId, resource,
      error: error instanceof Error ? { name: error.name, message: error.message } : { name: 'UnknownError' },
    }, 'trading shadow comparison could not be completed');
  });
}

export async function compareShadow(userId: string, accountId: string, resource: Resource, expected: unknown[]) {
  const snapshot = await getSnapshot(userId, accountId);
  const expectedRows = canonicalRows(resource, expected);
  const actualRows = canonicalRows(resource, snapshot[resource]);
  const expectedMap = new Map(expectedRows.map((row) => [row.key, row.value]));
  const actualMap = new Map(actualRows.map((row) => [row.key, row.value]));
  const keys = [...new Set([...expectedMap.keys(), ...actualMap.keys()])].sort();
  const mismatchKeys = keys.filter((key) => expectedMap.get(key) !== actualMap.get(key));
  logger.info({
    event: mismatchKeys.length === 0 ? 'trading_shadow_match' : 'trading_shadow_mismatch',
    accountId, resource, expectedCount: expectedRows.length, actualCount: actualRows.length,
    mismatchCount: mismatchKeys.length, mismatchKeys: mismatchKeys.slice(0, 20),
  }, 'trading shadow comparison completed');
  return { match: mismatchKeys.length === 0, mismatchKeys };
}

async function getSnapshot(userId: string, accountId: string): Promise<Snapshot> {
  const key = `${userId}:${accountId}`;
  const existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.request;
  const request = fetchSnapshot(userId, accountId);
  cache.set(key, { expiresAt: Date.now() + CACHE_MS, request });
  try {
    return await request;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}

async function fetchSnapshot(userId: string, accountId: string): Promise<Snapshot> {
  const url = new URL(`/internal/v1/shadow/accounts/${encodeURIComponent(accountId)}/snapshot`, env.TRADING_ENGINE_URL);
  url.searchParams.set('userId', userId);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${env.TRADING_ENGINE_TOKEN}`, 'X-Request-ID': randomUUID() },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Trading Engine shadow snapshot failed with HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object') throw new Error('Trading Engine returned an invalid shadow snapshot');
  const candidate = body as Partial<Snapshot>;
  for (const resource of ['balances', 'symbols', 'orders', 'positions'] as const) {
    if (!Array.isArray(candidate[resource])) throw new Error(`Trading Engine shadow snapshot is missing ${resource}`);
  }
  return candidate as Snapshot;
}

function canonicalRows(resource: Resource, values: unknown[]) {
  return values.flatMap((value) => {
    if (!value || typeof value !== 'object') return [];
    const row = value as Record<string, unknown>;
    const key = keyFor(resource, row);
    if (!key) return [];
    const normalized = Object.fromEntries(fieldsFor(resource).map((field) => [field, normalizeValue(field, row[field])]));
    return [{ key, value: JSON.stringify(normalized) }];
  }).sort((left, right) => left.key.localeCompare(right.key));
}

function keyFor(resource: Resource, row: Record<string, unknown>): string {
  if (resource === 'balances') return `${String(row.walletType ?? '')}:${String(row.asset ?? '')}`;
  if (resource === 'symbols') return String(row.symbol ?? '');
  if (resource === 'orders') return String(row.exchangeOrderId ?? '');
  return String(row.positionKey ?? '');
}

function fieldsFor(resource: Resource): string[] {
  switch (resource) {
    case 'balances': return ['walletType', 'asset', 'walletBalance', 'availableBalance', 'lockedBalance', 'unrealizedPnl'];
    case 'symbols': return ['symbol', 'tickSize', 'stepSize', 'minQuantity', 'maxQuantity', 'minNotional', 'maxLeverage'];
    case 'orders': return ['exchangeOrderId', 'clientOrderId', 'symbol', 'side', 'type', 'status', 'quantity', 'executedQuantity', 'price', 'stopPrice', 'reduceOnly'];
    case 'positions': return ['positionKey', 'symbol', 'side', 'quantity', 'entryPrice', 'markPrice', 'liquidationPrice', 'unrealizedPnl', 'leverage', 'marginMode', 'positionIndex'];
  }
}

function normalizeValue(field: string, value: unknown): unknown {
  if (field === 'status' && typeof value === 'string') {
    if (['NEW', 'New', 'Untriggered', 'Triggered', 'Active'].includes(value)) return 'OPEN';
    if (value === 'PartiallyFilled') return 'PARTIALLY_FILLED';
    if (value === 'Cancelled') return 'CANCELED';
  }
  return value ?? '';
}
