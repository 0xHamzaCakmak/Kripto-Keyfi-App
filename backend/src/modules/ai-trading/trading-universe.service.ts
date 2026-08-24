import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';

export const CORE_TRADING_UNIVERSE = [
  ['bitcoin', 'Bitcoin', 'BTC'], ['ethereum', 'Ethereum', 'ETH'], ['binancecoin', 'BNB', 'BNB'],
  ['solana', 'Solana', 'SOL'], ['ripple', 'XRP', 'XRP'], ['tron', 'TRON', 'TRX'],
  ['dogecoin', 'Dogecoin', 'DOGE'], ['cardano', 'Cardano', 'ADA'], ['bitcoin-cash', 'Bitcoin Cash', 'BCH'],
  ['chainlink', 'Chainlink', 'LINK'], ['avalanche-2', 'Avalanche', 'AVAX'], ['litecoin', 'Litecoin', 'LTC'],
  ['polkadot', 'Polkadot', 'DOT'], ['the-open-network', 'Toncoin', 'TON'], ['sui', 'Sui', 'SUI'],
  ['uniswap', 'Uniswap', 'UNI'], ['aave', 'Aave', 'AAVE'], ['near', 'NEAR', 'NEAR'],
  ['ethereum-classic', 'Ethereum Classic', 'ETC'], ['stellar', 'Stellar', 'XLM'],
] as const;

type ExternalQuote = { marketCap?: number | undefined; volume24h?: number | undefined; rank?: number | undefined; volumeChange24h?: number | undefined; sources: string[] };
let intelligenceCache: { expiresAt: number; quotes: Map<string, ExternalQuote>; globalContext: Record<string, unknown> } | null = null;

export async function ensureCoreTradingUniverse(userId: string) {
  await prisma.$transaction(CORE_TRADING_UNIVERSE.map(([, displayName, baseAsset], sortOrder) =>
    prisma.tradingUniverseAsset.upsert({
      where: { userId_symbol: { userId, symbol: `${baseAsset}USDT` } },
      create: { userId, symbol: `${baseAsset}USDT`, baseAsset, displayName, sortOrder, enabled: true },
      update: { baseAsset, displayName, sortOrder },
    })));
}

export async function getEnabledTradingSymbols(userId: string) {
  await ensureCoreTradingUniverse(userId);
  // Refresh is best-effort and provider failures are isolated internally;
  // execution never depends on CoinGecko/CMC availability.
  await refreshExternalIntelligence(userId);
  const assets = await prisma.tradingUniverseAsset.findMany({ where: { userId, enabled: true }, orderBy: { sortOrder: 'asc' }, select: { symbol: true } });
  return assets.map((asset) => asset.symbol);
}

export async function getTradingUniverse(userId: string) {
  await ensureCoreTradingUniverse(userId);
  const intelligence = await refreshExternalIntelligence(userId);
  const assets = await prisma.tradingUniverseAsset.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } });
  return { assets: assets.map((asset) => ({ ...asset, marketCap: asset.marketCap?.toString() ?? null, volume24h: asset.volume24h?.toString() ?? null, volumeChange24h: asset.volumeChange24h?.toString() ?? null })), intelligence };
}

export async function updateTradingUniverseAsset(userId: string, symbol: string, enabled: boolean, ipAddress?: string) {
  await ensureCoreTradingUniverse(userId);
  const existing = await prisma.tradingUniverseAsset.findUnique({ where: { userId_symbol: { userId, symbol } } });
  if (!existing) throw new ApiError(404, 'Core Trading Universe asset not found.', 'TRADING_UNIVERSE_ASSET_NOT_FOUND');
  const asset = await prisma.$transaction(async (tx) => {
    const updated = await tx.tradingUniverseAsset.update({ where: { id: existing.id }, data: { enabled } });
    await tx.tradingAuditLog.create({ data: {
      userId, action: enabled ? 'AI_TRADING_UNIVERSE_ASSET_ENABLED' : 'AI_TRADING_UNIVERSE_ASSET_DISABLED',
      entityType: 'TRADING_UNIVERSE_ASSET', entityId: existing.id,
      metadata: { symbol, enabled, existingOpenPositionsRemainManaged: true, newEntriesAllowed: enabled, productionLive: false },
      ...(ipAddress ? { ipAddress } : {}),
    } });
    return updated;
  });
  return { ...asset, marketCap: asset.marketCap?.toString() ?? null, volume24h: asset.volume24h?.toString() ?? null, volumeChange24h: asset.volumeChange24h?.toString() ?? null };
}

async function refreshExternalIntelligence(userId: string) {
  const now = Date.now();
  if (!intelligenceCache || intelligenceCache.expiresAt <= now) intelligenceCache = await readExternalIntelligence(now);
  const updates = CORE_TRADING_UNIVERSE.flatMap(([, , baseAsset]) => {
    const quote = intelligenceCache?.quotes.get(baseAsset);
    if (!quote) return [];
    return [prisma.tradingUniverseAsset.updateMany({ where: { userId, symbol: `${baseAsset}USDT` }, data: {
      ...(finiteNumber(quote.marketCap) ? { marketCap: new Prisma.Decimal(quote.marketCap) } : {}),
      ...(finiteNumber(quote.volume24h) ? { volume24h: new Prisma.Decimal(quote.volume24h) } : {}),
      ...(finiteNumber(quote.rank) && Number.isInteger(quote.rank) && quote.rank > 0 ? { marketRank: quote.rank } : {}),
      ...(finiteNumber(quote.volumeChange24h) ? { volumeChange24h: new Prisma.Decimal(quote.volumeChange24h) } : {}),
      intelligenceSource: quote.sources.join('+'), intelligenceUpdatedAt: new Date(now),
    } })];
  });
  if (updates.length) await prisma.$transaction(updates);
  return { providers: [...new Set([...intelligenceCache.quotes.values()].flatMap((quote) => quote.sources))], globalContext: intelligenceCache.globalContext, refreshedAt: new Date(now) };
}

function finiteNumber(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value); }

async function readExternalIntelligence(now: number) {
  const quotes = new Map<string, ExternalQuote>();
  const globalContext: Record<string, unknown> = {};
  const merge = (symbol: string, values: Omit<ExternalQuote, 'sources'>, source: string) => {
    const current = quotes.get(symbol) ?? { sources: [] };
    quotes.set(symbol, { ...values, ...current, sources: [...new Set([...current.sources, source])] });
  };
  const coinGeckoHeaders = env.COINGECKO_API_KEY
    ? { [env.COINGECKO_API_BASE_URL.includes('pro-api') ? 'x-cg-pro-api-key' : 'x-cg-demo-api-key']: env.COINGECKO_API_KEY }
    : {};
  await Promise.allSettled([
    fetch(`${env.COINGECKO_API_BASE_URL}/coins/markets?vs_currency=usd&ids=${CORE_TRADING_UNIVERSE.map(([id]) => id).join(',')}&order=market_cap_desc&per_page=100&page=1&sparkline=false`, {
      headers: coinGeckoHeaders, signal: AbortSignal.timeout(4_000),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`CoinGecko ${response.status}`);
      const rows = await response.json() as Array<{ symbol: string; market_cap?: number; total_volume?: number; market_cap_rank?: number }>;
      for (const row of rows) merge(row.symbol.toUpperCase(), { marketCap: row.market_cap, volume24h: row.total_volume, rank: row.market_cap_rank }, 'COINGECKO');
    }),
    fetch(`${env.COINGECKO_API_BASE_URL}/global`, { headers: coinGeckoHeaders, signal: AbortSignal.timeout(4_000) })
      .then(async (response) => { if (response.ok) globalContext.coinGecko = (await response.json() as { data?: unknown }).data ?? null; }),
    ...(env.COINMARKETCAP_API_KEY ? [
      fetch(`${env.COINMARKETCAP_API_BASE_URL}/cryptocurrency/quotes/latest?symbol=${CORE_TRADING_UNIVERSE.map(([, , symbol]) => symbol).join(',')}&convert=USD`, {
        headers: { 'X-CMC_PRO_API_KEY': env.COINMARKETCAP_API_KEY }, signal: AbortSignal.timeout(4_000),
      }).then(async (response) => {
        if (!response.ok) throw new Error(`CoinMarketCap ${response.status}`);
        const payload = await response.json() as { data?: Record<string, { cmc_rank?: number; quote?: { USD?: { market_cap?: number; volume_24h?: number; volume_change_24h?: number } } }> };
        for (const [symbol, row] of Object.entries(payload.data ?? {})) { const usd = row.quote?.USD; merge(symbol, { marketCap: usd?.market_cap, volume24h: usd?.volume_24h, rank: row.cmc_rank, volumeChange24h: usd?.volume_change_24h }, 'COINMARKETCAP'); }
      }),
      fetch(`${env.COINMARKETCAP_API_BASE_URL}/global-metrics/quotes/latest`, { headers: { 'X-CMC_PRO_API_KEY': env.COINMARKETCAP_API_KEY }, signal: AbortSignal.timeout(4_000) })
        .then(async (response) => { if (response.ok) globalContext.coinMarketCap = (await response.json() as { data?: unknown }).data ?? null; }),
    ] : []),
  ]);
  return { expiresAt: now + 5 * 60_000, quotes, globalContext };
}
