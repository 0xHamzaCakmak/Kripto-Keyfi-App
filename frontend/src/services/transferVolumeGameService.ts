export type TransferAssetId = 'eth-mainnet' | 'btc' | 'bnb' | 'eth-arbitrum' | 'eth-base' | 'matic' | 'usdt-ethereum' | 'usdc-ethereum';

export type TransferAsset = {
  id: TransferAssetId;
  asset: string;
  assetName: string;
  network: string;
  icon: string;
  activityLabel: string;
  supported: boolean;
  minTolerance: number;
};

export type MockTransfer = {
  id: string;
  txHash: string;
  from: string;
  to: string;
  amount: number;
  asset: string;
  timeLabel: string;
  createdAt: number;
};

export type TransferVolumeGameConfig = {
  selectedAsset: TransferAsset;
  durationSeconds: number;
  predictionAmount: number;
};

export type TransferVolumeGameState = TransferVolumeGameConfig & {
  startTime: number;
  transfers: MockTransfer[];
  totalVolume: number;
  transferCount: number;
  largestTransfer: number;
};

export type TransferVolumeResultStatus = 'Başarılı' | 'Yaklaştın' | 'Başarısız';

export type TransferVolumeResult = {
  id: string;
  assetId: TransferAssetId;
  asset: string;
  network: string;
  durationSeconds: number;
  predictionAmount: number;
  actualVolume: number;
  difference: number;
  percentageError: number;
  transferCount: number;
  largestTransfer: number;
  status: TransferVolumeResultStatus;
  points: number;
  createdAt: string;
};

export type TransferVolumeStats = {
  totalScore: number;
  totalAttempts: number;
  successfulAttempts: number;
  bestPredictionError: number | null;
};

const STATS_KEY = 'transferVolumeStats';
const HISTORY_KEY = 'transferVolumeHistory';
const HISTORY_LIMIT = 20;

const defaultStats: TransferVolumeStats = {
  totalScore: 0,
  totalAttempts: 0,
  successfulAttempts: 0,
  bestPredictionError: null
};

const exchangeLabels = ['Binance', 'Coinbase', 'Kraken', 'OKX', 'Bybit', 'Cold Wallet', 'Unknown Wallet'];

export function getSupportedAssets(): TransferAsset[] {
  return [
    { id: 'eth-mainnet', asset: 'ETH', assetName: 'Ethereum', network: 'Ethereum', icon: 'Ξ', activityLabel: 'Yüksek aktivite', supported: true, minTolerance: 10 },
    { id: 'btc', asset: 'BTC', assetName: 'Bitcoin', network: 'Bitcoin', icon: '₿', activityLabel: 'Yüksek aktivite', supported: true, minTolerance: 0.25 },
    { id: 'bnb', asset: 'BNB', assetName: 'BNB Chain', network: 'BNB Chain', icon: 'BNB', activityLabel: 'Orta-yüksek aktivite', supported: true, minTolerance: 25 },
    { id: 'eth-arbitrum', asset: 'ETH', assetName: 'Ethereum', network: 'Arbitrum', icon: 'ARB', activityLabel: 'Yoğun L2 aktivitesi', supported: true, minTolerance: 10 },
    { id: 'eth-base', asset: 'ETH', assetName: 'Ethereum', network: 'Base', icon: 'BASE', activityLabel: 'Yükselen L2 aktivitesi', supported: true, minTolerance: 10 },
    { id: 'matic', asset: 'MATIC', assetName: 'Polygon', network: 'Polygon', icon: 'MATIC', activityLabel: 'Orta aktivite', supported: true, minTolerance: 2500 },
    { id: 'usdt-ethereum', asset: 'USDT', assetName: 'Tether', network: 'Ethereum', icon: 'USDT', activityLabel: 'Stablecoin akışı', supported: true, minTolerance: 10000 },
    { id: 'usdc-ethereum', asset: 'USDC', assetName: 'USD Coin', network: 'Ethereum', icon: 'USDC', activityLabel: 'Stablecoin akışı', supported: true, minTolerance: 10000 }
  ];
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function roundAmount(amount: number, asset: string) {
  if (asset === 'BTC') return Number(amount.toFixed(4));
  if (asset === 'USDT' || asset === 'USDC' || asset === 'MATIC') return Number(amount.toFixed(2));
  return Number(amount.toFixed(3));
}

function pickAmount(asset: TransferAsset) {
  const roll = Math.random();

  if (asset.asset === 'BTC') {
    if (roll > 0.92) return randomBetween(2, 20);
    if (roll > 0.58) return randomBetween(0.3, 2);
    return randomBetween(0.01, 0.3);
  }

  if (asset.asset === 'USDT' || asset.asset === 'USDC') {
    if (roll > 0.92) return randomBetween(100000, 5000000);
    if (roll > 0.55) return randomBetween(5000, 100000);
    return randomBetween(100, 5000);
  }

  if (asset.asset === 'BNB') {
    if (roll > 0.92) return randomBetween(300, 3000);
    if (roll > 0.55) return randomBetween(20, 300);
    return randomBetween(1, 20);
  }

  if (asset.asset === 'MATIC') {
    if (roll > 0.92) return randomBetween(50000, 750000);
    if (roll > 0.55) return randomBetween(5000, 50000);
    return randomBetween(100, 5000);
  }

  if (roll > 0.92) return randomBetween(100, 1000);
  if (roll > 0.55) return randomBetween(5, 50);
  return randomBetween(0.1, 5);
}

function randomHex(length: number) {
  const chars = '0123456789abcdef';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateEvmAddress() {
  return `0x${randomHex(40)}`;
}

function generateBtcAddress() {
  const chars = '023456789abcdefghijkmnopqrstuvwxyz';
  return `bc1q${Array.from({ length: 34 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')}`;
}

function generateAddress(asset: TransferAsset) {
  if (asset.network === 'Bitcoin') return generateBtcAddress();
  if (Math.random() > 0.76) return exchangeLabels[Math.floor(Math.random() * exchangeLabels.length)];
  return generateEvmAddress();
}

export function shortenAddress(value: string) {
  if (!value.includes('0x') && !value.startsWith('bc1')) return value;
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatTransferAmount(amount: number, asset: string) {
  return `${amount.toLocaleString('en-US', {
    minimumFractionDigits: asset === 'BTC' ? 4 : 2,
    maximumFractionDigits: asset === 'BTC' ? 4 : 3
  })} ${asset}`;
}

export function generateMockTransfer(asset: TransferAsset): MockTransfer {
  const isBtc = asset.network === 'Bitcoin';
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    txHash: isBtc ? randomHex(64) : `0x${randomHex(64)}`,
    from: generateAddress(asset),
    to: generateAddress(asset),
    amount: roundAmount(pickAmount(asset), asset.asset),
    asset: asset.asset,
    timeLabel: 'az önce',
    createdAt: Date.now()
  };
}

export function getLatestTransfers(asset: TransferAsset, count = 6) {
  return Array.from({ length: count }, (_, index) => ({
    ...generateMockTransfer(asset),
    timeLabel: `${(index + 1) * 8} sn önce`,
    createdAt: Date.now() - (index + 1) * 8000
  }));
}

export function startTransferVolumeGame(config: TransferVolumeGameConfig): TransferVolumeGameState {
  return {
    ...config,
    startTime: Date.now(),
    transfers: [],
    totalVolume: 0,
    transferCount: 0,
    largestTransfer: 0
  };
}

export function finishTransferVolumeGame(gameState: TransferVolumeGameState): TransferVolumeResult {
  const actualVolume = Number(gameState.totalVolume.toFixed(4));
  const predictionAmount = gameState.predictionAmount;
  const difference = Number(Math.abs(predictionAmount - actualVolume).toFixed(4));
  const percentageError = actualVolume > 0 ? Number(((difference / actualVolume) * 100).toFixed(2)) : 100;
  const successTolerance = Math.max(gameState.selectedAsset.minTolerance, actualVolume * 0.1);
  const closeTolerance = Math.max(gameState.selectedAsset.minTolerance * 2, actualVolume * 0.2);
  const status: TransferVolumeResultStatus = difference <= successTolerance
    ? 'Başarılı'
    : difference <= closeTolerance
      ? 'Yaklaştın'
      : 'Başarısız';
  const points = status === 'Başarılı' ? 30 : status === 'Yaklaştın' ? 10 : 0;

  return {
    id: `${Date.now()}`,
    assetId: gameState.selectedAsset.id,
    asset: gameState.selectedAsset.asset,
    network: gameState.selectedAsset.network,
    durationSeconds: gameState.durationSeconds,
    predictionAmount,
    actualVolume,
    difference,
    percentageError,
    transferCount: gameState.transferCount,
    largestTransfer: gameState.largestTransfer,
    status,
    points,
    createdAt: new Date().toISOString()
  };
}

export function getTransferVolumeHistory(): TransferVolumeResult[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTransferVolumeHistory(result: TransferVolumeResult) {
  const nextHistory = [result, ...getTransferVolumeHistory()].slice(0, HISTORY_LIMIT);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  return nextHistory;
}

export function getTransferVolumeStats(): TransferVolumeStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? { ...defaultStats, ...JSON.parse(raw) } : defaultStats;
  } catch {
    return defaultStats;
  }
}

export function saveTransferVolumeStats(previousStats: TransferVolumeStats, result: TransferVolumeResult) {
  const isSuccess = result.status === 'Başarılı';
  const bestPredictionError = previousStats.bestPredictionError === null
    ? result.percentageError
    : Math.min(previousStats.bestPredictionError, result.percentageError);
  const nextStats: TransferVolumeStats = {
    totalScore: previousStats.totalScore + result.points,
    totalAttempts: previousStats.totalAttempts + 1,
    successfulAttempts: previousStats.successfulAttempts + (isSuccess ? 1 : 0),
    bestPredictionError
  };

  localStorage.setItem(STATS_KEY, JSON.stringify(nextStats));
  return nextStats;
}
