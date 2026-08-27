import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { getBinanceFuturesPublicSymbols } from '../trading/exchanges/binance-futures.adapter.js';
import type { ExchangeSymbol } from '../trading/exchanges/exchange-adapter.js';
import type { SearchTradingUniverseQuery } from './trading-universe.schema.js';

export const CORE_TRADING_UNIVERSE = [
  ['bitcoin', 'Bitcoin', 'BTC'], ['ethereum', 'Ethereum', 'ETH'], ['binancecoin', 'BNB', 'BNB'],
  ['solana', 'Solana', 'SOL'], ['ripple', 'XRP', 'XRP'], ['tron', 'TRON', 'TRX'],
  ['dogecoin', 'Dogecoin', 'DOGE'], ['cardano', 'Cardano', 'ADA'], ['bitcoin-cash', 'Bitcoin Cash', 'BCH'],
  ['chainlink', 'Chainlink', 'LINK'], ['avalanche-2', 'Avalanche', 'AVAX'], ['litecoin', 'Litecoin', 'LTC'],
  ['polkadot', 'Polkadot', 'DOT'], ['pump-fun', 'Pump.fun', 'PUMP'], ['sui', 'Sui', 'SUI'],
  ['uniswap', 'Uniswap', 'UNI'], ['aave', 'Aave', 'AAVE'], ['near', 'NEAR', 'NEAR'],
  ['ethereum-classic', 'Ethereum Classic', 'ETC'], ['stellar', 'Stellar', 'XLM'],
] as const;

type ExternalQuote = { marketCap?: number | undefined; volume24h?: number | undefined; rank?: number | undefined; volumeChange24h?: number | undefined; sources: string[] };
let intelligenceCache: { expiresAt: number; quotes: Map<string, ExternalQuote>; globalContext: Record<string, unknown> } | null = null;
const exchangeCatalogCache = new Map<string, { expiresAt: number; symbols: ExchangeSymbol[] }>();

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
  const [intelligence, catalog] = await Promise.all([refreshExternalIntelligence(userId), loadExchangeCatalog(userId, false)]);
  const assets = await prisma.tradingUniverseAsset.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } });
  const available = catalog ? new Set(catalog.symbols.map((item) => item.symbol)) : null;
  return {
    assets: assets.map((asset) => ({ ...asset,
      marketCap: asset.marketCap?.toString() ?? null, volume24h: asset.volume24h?.toString() ?? null,
      volumeChange24h: asset.volumeChange24h?.toString() ?? null,
      exchangeAvailable: available ? available.has(asset.symbol) : null,
    })),
    intelligence,
    exchange: catalog ? { accountId: catalog.account.id, name: catalog.account.name, environment: catalog.account.environment, accountType: catalog.account.accountType, catalogStatus: 'FRESH' as const }
      : { accountId: null, name: null, environment: null, accountType: null, catalogStatus: 'UNAVAILABLE' as const },
  };
}

export async function updateTradingUniverseAsset(userId: string, symbol: string, enabled: boolean, ipAddress?: string) {
  await ensureCoreTradingUniverse(userId);
  const existing = await prisma.tradingUniverseAsset.findUnique({ where: { userId_symbol: { userId, symbol } } });
  if (!existing) throw new ApiError(404, 'Core Trading Universe asset not found.', 'TRADING_UNIVERSE_ASSET_NOT_FOUND');
  if (enabled) await requireExchangeSymbol(userId, symbol);
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
  return { ...asset, marketCap: asset.marketCap?.toString() ?? null, volume24h: asset.volume24h?.toString() ?? null, volumeChange24h: asset.volumeChange24h?.toString() ?? null, exchangeAvailable: enabled ? true : null };
}

export async function searchTradingUniverse(userId: string, query: SearchTradingUniverseQuery) {
  const catalog = await loadExchangeCatalog(userId, true);
  const needle = query.q.replace(/[^A-Z0-9]/g, '');
  const matches = catalog.symbols.filter((item) => !needle || item.symbol.includes(needle) || item.baseAsset.includes(needle)).slice(0, query.limit);
  const configured = await prisma.tradingUniverseAsset.findMany({
    where: { userId, symbol: { in: matches.map((item) => item.symbol) } }, select: { symbol: true, enabled: true },
  });
  const configuredBySymbol = new Map(configured.map((item) => [item.symbol, item.enabled]));
  return {
    account: { id: catalog.account.id, name: catalog.account.name, environment: catalog.account.environment, accountType: catalog.account.accountType },
    results: matches.map((item) => ({
      symbol: item.symbol, baseAsset: item.baseAsset, quoteAsset: item.quoteAsset, maxLeverage: item.maxLeverage,
      minNotional: item.minNotional, listed: configuredBySymbol.has(item.symbol), enabled: configuredBySymbol.get(item.symbol) === true,
    })),
  };
}

export async function addTradingUniverseAsset(userId: string, symbol: string, ipAddress?: string) {
  await ensureCoreTradingUniverse(userId);
  const exchangeSymbol = await requireExchangeSymbol(userId, symbol);
  const aggregate = await prisma.tradingUniverseAsset.aggregate({ where: { userId }, _max: { sortOrder: true } });
  const asset = await prisma.$transaction(async (tx) => {
    const saved = await tx.tradingUniverseAsset.upsert({
      where: { userId_symbol: { userId, symbol } },
      create: { userId, symbol, baseAsset: exchangeSymbol.baseAsset, displayName: exchangeSymbol.baseAsset, enabled: true, sortOrder: (aggregate._max.sortOrder ?? -1) + 1 },
      update: { baseAsset: exchangeSymbol.baseAsset, enabled: true },
    });
    await tx.tradingAuditLog.create({ data: {
      userId, action: 'AI_TRADING_UNIVERSE_ASSET_ADDED', entityType: 'TRADING_UNIVERSE_ASSET', entityId: saved.id,
      metadata: { symbol, exchangeValidated: true, exchangeMarket: 'USD_M_FUTURES', enabled: true, productionLive: false },
      ...(ipAddress ? { ipAddress } : {}),
    } });
    return saved;
  });
  return { ...asset, marketCap: asset.marketCap?.toString() ?? null, volume24h: asset.volume24h?.toString() ?? null, volumeChange24h: asset.volumeChange24h?.toString() ?? null, exchangeAvailable: true };
}

type ExchangeCatalog = { account: { id: string; name: string; environment: string; accountType: string }; symbols: ExchangeSymbol[] };

async function requireExchangeSymbol(userId: string, symbol: string) {
  const catalog = await loadExchangeCatalog(userId, true);
  const match = catalog.symbols.find((item) => item.symbol === symbol);
  if (!match) throw new ApiError(422, `${symbol}, bağlı Binance USDⓈ-M Futures ortamında işlem gören bir perpetual sembol değil.`, 'TRADING_UNIVERSE_SYMBOL_NOT_AVAILABLE');
  return match;
}

async function loadExchangeCatalog(userId: string, required: true): Promise<ExchangeCatalog>;
async function loadExchangeCatalog(userId: string, required: false): Promise<ExchangeCatalog | null>;
async function loadExchangeCatalog(userId: string, required: boolean): Promise<ExchangeCatalog | null> {
  const accountWhere = { userId, provider: 'BINANCE' as const, accountType: 'USDT_M' as const, isActive: true };
  const account = await prisma.exchangeAccount.findFirst({ where: { ...accountWhere, connectionStatus: 'CONNECTED' }, orderBy: { createdAt: 'asc' } })
    ?? await prisma.exchangeAccount.findFirst({ where: accountWhere, orderBy: { createdAt: 'asc' } });
  if (!account) {
    if (required) throw new ApiError(409, 'Aktif Binance USDⓈ-M Futures hesabı bulunamadı.', 'TRADING_UNIVERSE_EXCHANGE_ACCOUNT_REQUIRED');
    return null;
  }
  const cached = exchangeCatalogCache.get(account.id);
  if (cached && cached.expiresAt > Date.now()) return { account, symbols: cached.symbols };
  try {
    const symbols = (await getBinanceFuturesPublicSymbols()).filter((item) => item.status === 'TRADING' && item.quoteAsset === 'USDT');
    exchangeCatalogCache.set(account.id, { expiresAt: Date.now() + 5 * 60_000, symbols });
    return { account, symbols };
  } catch (error) {
    if (required) throw new ApiError(503, 'Binance Futures public sembol kataloğu alınamadı. Ağ erişimini kontrol edip yeniden deneyin.', 'TRADING_UNIVERSE_EXCHANGE_CATALOG_UNAVAILABLE', error instanceof Error ? error.message : undefined);
    return null;
  }
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
