export type PricePoint = {
  id: number;
  price: number;
  time: number;
};

export type BtcPriceState = {
  anchorPrice: number;
  targetAnchorPrice: number;
  currentPrice: number;
  pricePoints: PricePoint[];
  drift: number;
};

export type PriceAssetId = 'btc' | 'eth';

const INITIAL_BTC_PRICE = 62534.25;
const INITIAL_ASSET_PRICES: Record<PriceAssetId, number> = {
  btc: INITIAL_BTC_PRICE,
  eth: 3421.12
};
const MAX_POINT_COUNT = 120;

export const COINGECKO_IDS_BY_ASSET_ID: Record<string, string> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  bnb: 'binancecoin',
  xrp: 'ripple',
  sol: 'solana',
  tron: 'tron',
  doge: 'dogecoin',
  ada: 'cardano',
  ton: 'the-open-network',
  avax: 'avalanche-2',
  xaut: 'tether-gold',
  arb: 'arbitrum',
};

export type LiveMarketPrice = {
  usd?: number;
  usd_24h_change?: number;
};

export type LiveMarketPrices = Record<string, LiveMarketPrice>;

function roundPrice(price: number) {
  return Number(price.toFixed(2));
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export function getBtcPriceMock(anchorPrice = INITIAL_BTC_PRICE) {
  return roundPrice(anchorPrice + randomBetween(-10, 10));
}

export function getAssetPriceMock(assetId: PriceAssetId, anchorPrice = INITIAL_ASSET_PRICES[assetId]) {
  return getBtcPriceMock(anchorPrice);
}

export async function getAssetPriceFromApi(assetId: PriceAssetId) {
  const coinGeckoId = COINGECKO_IDS_BY_ASSET_ID[assetId];
  const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`);
  if (!response.ok) throw new Error('CoinGecko price request failed');

  const data = await response.json();
  const price = Number(data?.[coinGeckoId]?.usd);
  if (!Number.isFinite(price)) throw new Error('CoinGecko price response is invalid');

  return roundPrice(price);
}

export async function getBtcPriceFromApi() {
  return getAssetPriceFromApi('btc');
}

export async function getLiveAssetPrice(assetId: PriceAssetId) {
  return getAssetPriceFromApi(assetId);
}

export async function getLiveBtcPrice() {
  return getLiveAssetPrice('btc');
}

export function getFallbackAssetPrice(assetId: PriceAssetId) {
  return getAssetPriceMock(assetId, INITIAL_ASSET_PRICES[assetId]);
}

export function getFallbackBtcPrice() {
  return getFallbackAssetPrice('btc');
}

export async function getCurrentBtcAnchorPrice({ preferApi = false } = {}) {
  if (!preferApi) return getBtcPriceMock(INITIAL_BTC_PRICE);

  try {
    return await getBtcPriceFromApi();
  } catch {
    return getBtcPriceMock(INITIAL_BTC_PRICE);
  }
}

export async function getLiveMarketPrices(assetIds = Object.keys(COINGECKO_IDS_BY_ASSET_ID)) {
  const ids = assetIds
    .map((assetId) => COINGECKO_IDS_BY_ASSET_ID[assetId])
    .filter(Boolean)
    .join(',');

  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
  );

  if (!response.ok) {
    throw new Error(`CoinGecko price request failed: ${response.status}`);
  }

  return await response.json() as LiveMarketPrices;
}

export function createInitialBtcPriceState(initialPrice = INITIAL_BTC_PRICE, pointCount = 72): BtcPriceState {
  const points = Array.from({ length: pointCount }, (_, index) => ({
    id: index,
    price: roundPrice(initialPrice + Math.sin(index / 6) * 4 + randomBetween(-2.5, 2.5)),
    time: Date.now() - (pointCount - index) * 500
  }));

  return {
    anchorPrice: initialPrice,
    targetAnchorPrice: initialPrice,
    currentPrice: points[points.length - 1]?.price ?? initialPrice,
    pricePoints: points,
    drift: randomBetween(-0.45, 0.45)
  };
}

export function createInitialAssetPriceState(assetId: PriceAssetId, initialPrice = INITIAL_ASSET_PRICES[assetId], pointCount = 72): BtcPriceState {
  return createInitialBtcPriceState(initialPrice, pointCount);
}

export function createNextAnchorPrice(anchorPrice: number) {
  return roundPrice(anchorPrice + randomBetween(-70, 70));
}

export function getNextBtcPriceState(state: BtcPriceState, frameIntensity = 1): BtcPriceState {
  const intensity = Math.max(0.05, Math.min(frameIntensity, 1));
  const anchorGap = state.targetAnchorPrice - state.anchorPrice;
  const anchorPrice = roundPrice(state.anchorPrice + anchorGap * 0.12 * intensity);
  const pullToAnchor = (anchorPrice - state.currentPrice) * 0.18 * intensity;
  const driftMemory = 1 - 0.24 * intensity;
  const nextDrift = Math.max(-1.1, Math.min(1.1, state.drift * driftMemory + randomBetween(-0.32, 0.32) * intensity));
  const burst = Math.random() > 1 - 0.02 * intensity ? randomBetween(-1, 1) * randomBetween(2.2, 4.2) * intensity : 0;
  const microMove = nextDrift * intensity + randomBetween(-0.7, 0.7) * intensity + burst;
  const boundedPrice = Math.min(anchorPrice + 12, Math.max(anchorPrice - 12, state.currentPrice + pullToAnchor + microMove));
  const currentPrice = roundPrice(boundedPrice);
  const nextPoint = {
    id: (state.pricePoints[state.pricePoints.length - 1]?.id ?? 0) + 1,
    price: currentPrice,
    time: Date.now()
  };

  return {
    anchorPrice,
    targetAnchorPrice: state.targetAnchorPrice,
    currentPrice,
    pricePoints: [...state.pricePoints.slice(-(MAX_POINT_COUNT - 1)), nextPoint],
    drift: nextDrift
  };
}

export function getNextAssetPriceState(state: BtcPriceState, frameIntensity = 1): BtcPriceState {
  return getNextBtcPriceState(state, frameIntensity);
}

export function retargetBtcPriceState(state: BtcPriceState, targetAnchorPrice = createNextAnchorPrice(state.anchorPrice)): BtcPriceState {
  return {
    ...state,
    targetAnchorPrice
  };
}

export function retargetAssetPriceState(state: BtcPriceState, targetAnchorPrice = createNextAnchorPrice(state.anchorPrice)): BtcPriceState {
  return retargetBtcPriceState(state, targetAnchorPrice);
}

export function subscribeToBtcPriceMock(onPrice: (price: number) => void) {
  let anchorPrice = INITIAL_BTC_PRICE;
  const intervalId = window.setInterval(() => {
    anchorPrice = createNextAnchorPrice(anchorPrice);
    onPrice(anchorPrice);
  }, 60_000);

  return () => window.clearInterval(intervalId);
}
