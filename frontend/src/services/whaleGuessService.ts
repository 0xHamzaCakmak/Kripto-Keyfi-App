export type WhaleSentiment = 'bullish' | 'bearish' | 'neutral';

export type WhaleFlowType =
  | 'exchange_inflow'
  | 'exchange_outflow'
  | 'wallet_to_wallet'
  | 'bridge'
  | 'staking'
  | 'mint_burn'
  | 'unknown';

export type WhaleSeverity = 'Medium' | 'High' | 'Critical';

export type WhaleScenario = {
  id: string;
  asset: string;
  assetName: string;
  network: string;
  amount: string;
  amountUsd: string;
  fromLabel: string;
  fromAddress: string;
  toLabel: string;
  toAddress: string;
  txHash: string;
  timestamp: string;
  severity: WhaleSeverity;
  correctSentiment: WhaleSentiment;
  correctFlowType: WhaleFlowType;
  explanation: string;
  learningNote: string;
};

export type WhaleGuessResult = {
  sentimentCorrect: boolean;
  flowTypeCorrect: boolean;
  points: number;
  isPerfect: boolean;
};

export type WhaleGuessHistoryItem = {
  id: string;
  scenarioId: string;
  asset: string;
  amount: string;
  selectedSentiment: WhaleSentiment;
  correctSentiment: WhaleSentiment;
  selectedFlowType: WhaleFlowType;
  correctFlowType: WhaleFlowType;
  points: number;
  createdAt: string;
};

export type WhaleGuessStats = {
  totalScore: number;
  totalAttempts: number;
  correctAttempts: number;
  bestStreak: number;
  currentStreak: number;
};

const SCORE_KEY = 'whaleGuessScore';
const STATS_KEY = 'whaleGuessStats';
const HISTORY_KEY = 'whaleGuessHistory';
const HISTORY_LIMIT = 20;

export const sentimentOptions: Array<{ value: WhaleSentiment; label: string; icon: string; description: string }> = [
  { value: 'bullish', label: 'Bullish', icon: 'TrendingUp', description: 'Potansiyel pozitif yorum' },
  { value: 'bearish', label: 'Bearish', icon: 'TrendingDown', description: 'Potansiyel satış baskısı' },
  { value: 'neutral', label: 'Neutral', icon: 'Minus', description: 'Tek başına net yön üretmez' }
];

export const flowTypeOptions: Array<{ value: WhaleFlowType; label: string }> = [
  { value: 'exchange_inflow', label: 'Exchange Inflow' },
  { value: 'exchange_outflow', label: 'Exchange Outflow' },
  { value: 'wallet_to_wallet', label: 'Wallet to Wallet' },
  { value: 'bridge', label: 'Bridge' },
  { value: 'staking', label: 'Staking' },
  { value: 'mint_burn', label: 'Mint / Burn' },
  { value: 'unknown', label: 'Unknown' }
];

export const whaleScenarios: WhaleScenario[] = [
  {
    id: 'btc-wallet-binance',
    asset: 'BTC',
    assetName: 'Bitcoin',
    network: 'Bitcoin',
    amount: '2.500 BTC',
    amountUsd: '$162.500.000',
    fromLabel: 'Unknown Wallet',
    fromAddress: 'bc1q9v4ztl8xj0r3s6pu5z2k8v7n3h4m9p2q6w1e0a',
    toLabel: 'Binance',
    toAddress: 'bc1qbinance8x3e2n7p4q9m0z6w5r1a2s3d4f5g6h7j',
    txHash: 'f4b812c9a71d46e2b0c6a4e9f89123ab76de45f89012cdef34567890abcd1234',
    timestamp: '4 dakika önce',
    severity: 'Critical',
    correctSentiment: 'bearish',
    correctFlowType: 'exchange_inflow',
    explanation: 'Büyük cüzdanlardan borsaya transferler genellikle potansiyel satış hazırlığı olarak yorumlanır. Bu kesin düşüş anlamına gelmez ama satış baskısı ihtimalini artırabilir.',
    learningNote: 'Wallet to exchange akışlarında bağlam önemlidir: borsa etiketi, transfer boyutu ve piyasa koşulları birlikte okunmalıdır.'
  },
  {
    id: 'eth-coinbase-wallet',
    asset: 'ETH',
    assetName: 'Ethereum',
    network: 'Ethereum',
    amount: '38.200 ETH',
    amountUsd: '$131.026.000',
    fromLabel: 'Coinbase',
    fromAddress: '0x8f3a4c90d72b4a47f2e912db7649ac72d5f90111',
    toLabel: 'Unknown Wallet',
    toAddress: '0x91de45f2039ab82c54e17bd44c903fb0a21678cd',
    txHash: '0x4b91df726ad6e31f0c920bd8a7f3e69a54d108c4d8a91f20c6b17a341e6d9981',
    timestamp: '9 dakika önce',
    severity: 'High',
    correctSentiment: 'bullish',
    correctFlowType: 'exchange_outflow',
    explanation: 'Borsadan kişisel veya cold wallet tarafına çıkışlar genellikle elde tutma eğilimi olarak yorumlanır. Bu, satış baskısının azalabileceği anlamına gelebilir.',
    learningNote: 'Exchange outflow tek başına kesin yön vermez; ancak arzın borsa dışına taşınması önemli bir on-chain ipucudur.'
  },
  {
    id: 'usdt-treasury-mint',
    asset: 'USDT',
    assetName: 'Tether',
    network: 'Ethereum',
    amount: '500.000.000 USDT',
    amountUsd: '$500.000.000',
    fromLabel: 'Treasury',
    fromAddress: '0x0000000000000000000000000000000000000000',
    toLabel: 'Tether Treasury',
    toAddress: '0x5754284f345afc66a98fbb0a0afe71e0f007b949',
    txHash: '0xa19e55738fd5ba2339038c6e2be419f82350b519ae35ef84587f61f8eb42d901',
    timestamp: '16 dakika önce',
    severity: 'Critical',
    correctSentiment: 'neutral',
    correctFlowType: 'mint_burn',
    explanation: 'Stablecoin mint işlemleri piyasaya likidite hazırlığı olarak okunabilir, ancak tek başına yön sinyali üretmez.',
    learningNote: 'Mint/Burn hareketleri arz değişimini gösterir; etkisini anlamak için bu tokenların borsalara akıp akmadığı da izlenmelidir.'
  },
  {
    id: 'usdc-burn',
    asset: 'USDC',
    assetName: 'USD Coin',
    network: 'Ethereum',
    amount: '210.000.000 USDC',
    amountUsd: '$210.000.000',
    fromLabel: 'Circle Treasury',
    fromAddress: '0x55fe002aeff02f77364de339a1292923a15844b8',
    toLabel: 'Burn Address',
    toAddress: '0x0000000000000000000000000000000000000000',
    txHash: '0x7f9242f7a461a523a9e3caaf01e458638bfdf8572672d994f9bb231479de293a',
    timestamp: '22 dakika önce',
    severity: 'High',
    correctSentiment: 'neutral',
    correctFlowType: 'mint_burn',
    explanation: 'Burn işlemi arz azaltımıdır. Stablecoin tarafında bu hareket tek başına piyasa yönünü belirlemez.',
    learningNote: 'Stablecoin arz hareketleri likidite okumalarında kullanılır, fakat borsa akışları ve hacimle birlikte değerlendirilmelidir.'
  },
  {
    id: 'eth-wallet-staking',
    asset: 'ETH',
    assetName: 'Ethereum',
    network: 'Ethereum',
    amount: '14.400 ETH',
    amountUsd: '$49.392.000',
    fromLabel: 'Unknown Wallet',
    fromAddress: '0x25ad8e1779470d7f6c4f76c4cab9de613a6b7a91',
    toLabel: 'Staking Contract',
    toAddress: '0x00000000219ab540356cbb839cbe05303d7705fa',
    txHash: '0x5be040129f77e1a10c61a076cc1f046d46a0fc245f4ae89531edce638a66ab09',
    timestamp: '31 dakika önce',
    severity: 'High',
    correctSentiment: 'bullish',
    correctFlowType: 'staking',
    explanation: 'Staking kontratına büyük girişler genellikle uzun vadeli kilitleme davranışı olarak okunur. Bu, dolaşımdaki satış baskısını azaltabilir.',
    learningNote: 'Staking akışları yön sinyali değildir; daha çok arzın ne kadarının likit kaldığını anlamaya yardımcı olur.'
  },
  {
    id: 'usdc-eth-arb-bridge',
    asset: 'USDC',
    assetName: 'USD Coin',
    network: 'Ethereum to Arbitrum',
    amount: '76.000.000 USDC',
    amountUsd: '$76.000.000',
    fromLabel: 'Unknown Wallet',
    fromAddress: '0x34ff82cb1f7c45abd92d18ea45bfaa721fc2db12',
    toLabel: 'Bridge Contract',
    toAddress: '0x8315177aB297bA92A06054cE80a67Ed4DBd7ed3a',
    txHash: '0x93206ce4d6e1dd9a471a0b6ff027deca48910eb7db58df8e49ed470eb412cb10',
    timestamp: '38 dakika önce',
    severity: 'Medium',
    correctSentiment: 'neutral',
    correctFlowType: 'bridge',
    explanation: 'Bridge hareketleri ağlar arası likidite taşınmasını gösterir. Tek başına alım veya satım niyeti anlamına gelmez.',
    learningNote: 'Bridge transferlerinde hedef ağdaki DeFi aktivitesi, borsa akışı ve stablecoin kullanımı birlikte izlenmelidir.'
  },
  {
    id: 'bnb-wallet-binance',
    asset: 'BNB',
    assetName: 'BNB',
    network: 'BNB Chain',
    amount: '910.000 BNB',
    amountUsd: '$542.360.000',
    fromLabel: 'Unknown Wallet',
    fromAddress: '0xf0ab3d17cc0bd628c43b68f17fae8d03729d9251',
    toLabel: 'Binance',
    toAddress: '0x28c6c06298d514db089934071355e5743bf21d60',
    txHash: '0xe31f2fd7fd4c61fece67e9b7eb59e0193d63bb2ce86b14d618f257e84294f090',
    timestamp: '45 dakika önce',
    severity: 'Critical',
    correctSentiment: 'bearish',
    correctFlowType: 'exchange_inflow',
    explanation: 'Büyük miktarda varlığın borsaya girişi potansiyel satış hazırlığı olarak yorumlanabilir. Bu kesin sonuç üretmez.',
    learningNote: 'Borsa girişleri özellikle hacim ve emir defteri verisiyle birlikte değerlendirildiğinde daha anlamlı hale gelir.'
  },
  {
    id: 'sol-exchange-wallet',
    asset: 'SOL',
    assetName: 'Solana',
    network: 'Solana',
    amount: '1.850.000 SOL',
    amountUsd: '$277.500.000',
    fromLabel: 'Kraken',
    fromAddress: '7H6QyJk2dV2bQmWJZn63fTcR7gVnFQFqM6SE9mXudJza',
    toLabel: 'Cold Wallet',
    toAddress: 'BfS1WcX4x19x8fYpHPPi3hQJkb4G1j6axnQo84MqkG5a',
    txHash: '5n5JYJxWZQyS4qp6F2B3UkedP96EAA7hFNiKwjY4Mi73GBQMYZfCsrtzJcJUb2E7kqVKQ3em5qvh8FaE9oWfZs31',
    timestamp: '53 dakika önce',
    severity: 'High',
    correctSentiment: 'bullish',
    correctFlowType: 'exchange_outflow',
    explanation: 'Borsadan cold wallet tarafına taşınan yüksek miktarlar elde tutma eğilimi olarak yorumlanabilir.',
    learningNote: 'Cold wallet etiketleri her zaman doğrulanmış olmayabilir; adres geçmişi ve tekrar eden davranışlar önemlidir.'
  },
  {
    id: 'btc-wallet-wallet',
    asset: 'BTC',
    assetName: 'Bitcoin',
    network: 'Bitcoin',
    amount: '1.120 BTC',
    amountUsd: '$72.800.000',
    fromLabel: 'Unknown Wallet',
    fromAddress: 'bc1qw8ym30hsg6u4yqz3f3s0e9v6vgm0qq8sk8f4sy',
    toLabel: 'Unknown Wallet',
    toAddress: 'bc1qv3xy37an8wq6k0m79s3j9ht3h3n08n6y0kd4fc',
    txHash: 'b0cd4307bf781e29f90b8bdbac089d6ab7f4a2908451c56d23fb9841ab90df01',
    timestamp: '1 saat önce',
    severity: 'Medium',
    correctSentiment: 'neutral',
    correctFlowType: 'wallet_to_wallet',
    explanation: 'Bilinmeyen cüzdanlar arası transfer tek başına güçlü yön sinyali üretmez.',
    learningNote: 'Wallet to wallet hareketleri yeniden cüzdan düzenleme, saklama değişimi veya OTC hazırlığı olabilir; bağlam olmadan nötr okunmalıdır.'
  },
  {
    id: 'eth-whale-kraken',
    asset: 'ETH',
    assetName: 'Ethereum',
    network: 'Ethereum',
    amount: '21.750 ETH',
    amountUsd: '$74.602.500',
    fromLabel: 'Unknown Wallet',
    fromAddress: '0x67cd44961f75db60f95a6515365f8cb797f72310',
    toLabel: 'Kraken',
    toAddress: '0x2910543af39aba0cd09dbb2d50200b3e800a63d2',
    txHash: '0x107dd4d59a1b314cc871e75b1e248b024c568aa1be12b73eca4c8f9613a71855',
    timestamp: '1 saat önce',
    severity: 'High',
    correctSentiment: 'bearish',
    correctFlowType: 'exchange_inflow',
    explanation: 'Whale cüzdanından borsaya ETH girişi genellikle potansiyel satış baskısı olarak takip edilir.',
    learningNote: 'Bu kesin düşüş anlamına gelmez; transfer sonrası borsa cüzdanındaki hareketlerin devamı izlenmelidir.'
  },
  {
    id: 'usdt-binance-wallet',
    asset: 'USDT',
    assetName: 'Tether',
    network: 'Tron',
    amount: '320.000.000 USDT',
    amountUsd: '$320.000.000',
    fromLabel: 'Binance',
    fromAddress: 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj',
    toLabel: 'Unknown Wallet',
    toAddress: 'TQmYzYwR7m9rkJ3QaD5kw9qaqW9WyTcrJ7',
    txHash: '9b36f5e3a67a4cb57b10a7e310912a0c4e715fc56b0d25cd8a22792adc69e2ac',
    timestamp: '2 saat önce',
    severity: 'High',
    correctSentiment: 'neutral',
    correctFlowType: 'exchange_outflow',
    explanation: 'Stablecoin borsa çıkışları farklı amaçlarla yapılabilir: saklama, OTC, DeFi veya başka platforma aktarım. Tek başına net yön üretmez.',
    learningNote: 'Stablecoin akışlarında hedef cüzdan davranışı önemlidir; doğrudan risk-on veya risk-off yorumu yapmak yanıltıcı olabilir.'
  },
  {
    id: 'matic-bridge-transfer',
    asset: 'MATIC',
    assetName: 'Polygon',
    network: 'Polygon to Ethereum',
    amount: '48.000.000 MATIC',
    amountUsd: '$32.160.000',
    fromLabel: 'Bridge Contract',
    fromAddress: '0x401f6c983ea34274ec46f84d70b31c151321188b',
    toLabel: 'Unknown Wallet',
    toAddress: '0x10b2a2fef08c141d6d8d1cb0c1f6d5eb7d622c48',
    txHash: '0x62a8f8450112a03bc1524d913862cb3b6d6eac617d2f9206f196ad3c4db61051',
    timestamp: '2 saat önce',
    severity: 'Medium',
    correctSentiment: 'neutral',
    correctFlowType: 'bridge',
    explanation: 'Bridge transferleri likiditenin ağlar arasında yer değiştirdiğini gösterir; tek başına piyasa yönü çıkarımı yapmak doğru değildir.',
    learningNote: 'Bridge hareketlerinde varlığın hangi ağda kullanılacağı, DeFi havuzları ve borsa bağlantılarıyla anlaşılabilir.'
  }
];

const defaultStats: WhaleGuessStats = {
  totalScore: 0,
  totalAttempts: 0,
  correctAttempts: 0,
  bestStreak: 0,
  currentStreak: 0
};

export function getFlowTypeLabel(flowType: WhaleFlowType) {
  return flowTypeOptions.find((option) => option.value === flowType)?.label ?? flowType;
}

export function getSentimentLabel(sentiment: WhaleSentiment) {
  return sentimentOptions.find((option) => option.value === sentiment)?.label ?? sentiment;
}

export function shortenAddress(address: string) {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function getMockWhaleScenario() {
  return whaleScenarios[0];
}

export function getNextWhaleScenario(currentId?: string) {
  const candidates = currentId ? whaleScenarios.filter((scenario) => scenario.id !== currentId) : whaleScenarios;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? whaleScenarios[0];
}

export function submitWhaleGuess(
  scenario: WhaleScenario,
  selectedSentiment: WhaleSentiment,
  selectedFlowType: WhaleFlowType
): WhaleGuessResult {
  const sentimentCorrect = selectedSentiment === scenario.correctSentiment;
  const flowTypeCorrect = selectedFlowType === scenario.correctFlowType;
  const points = (sentimentCorrect ? 10 : 0) + (flowTypeCorrect ? 15 : 0) + (sentimentCorrect && flowTypeCorrect ? 5 : 0);

  return {
    sentimentCorrect,
    flowTypeCorrect,
    points,
    isPerfect: sentimentCorrect && flowTypeCorrect
  };
}

export function getWhaleGuessStats(): WhaleGuessStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    return raw ? { ...defaultStats, ...JSON.parse(raw) } : defaultStats;
  } catch {
    return defaultStats;
  }
}

export function getWhaleGuessHistory(): WhaleGuessHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveWhaleGuessHistory(item: WhaleGuessHistoryItem) {
  const nextHistory = [item, ...getWhaleGuessHistory()].slice(0, HISTORY_LIMIT);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
  return nextHistory;
}

export function saveWhaleGuessStats(previousStats: WhaleGuessStats, result: WhaleGuessResult) {
  const isCorrectAttempt = result.sentimentCorrect || result.flowTypeCorrect;
  const currentStreak = isCorrectAttempt ? previousStats.currentStreak + 1 : 0;
  const nextStats: WhaleGuessStats = {
    totalScore: previousStats.totalScore + result.points,
    totalAttempts: previousStats.totalAttempts + 1,
    correctAttempts: previousStats.correctAttempts + (isCorrectAttempt ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(previousStats.bestStreak, currentStreak)
  };

  localStorage.setItem(SCORE_KEY, String(nextStats.totalScore));
  localStorage.setItem(STATS_KEY, JSON.stringify(nextStats));
  return nextStats;
}
