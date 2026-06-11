export type GameStatus = 'active' | 'coming_soon';

export type GameCategory =
  | 'Tahmin Oyunları'
  | 'On-Chain Oyunları'
  | 'Eğitim Oyunları'
  | 'Güvenlik Oyunları'
  | 'Quizler';

export type GameCatalogItem = {
  id: string;
  slug: string;
  title: string;
  description: string;
  longDescription: string;
  status: GameStatus;
  category: GameCategory;
  route?: string;
  icon: string;
  isFeatured?: boolean;
  hasMiniChart?: boolean;
};

export const gameCategories = [
  'Tümü',
  'Tahmin Oyunları',
  'On-Chain Oyunları',
  'Eğitim Oyunları',
  'Güvenlik Oyunları',
  'Quizler',
  'Aktif',
  'Yakında'
] as const;

export type GameFilter = (typeof gameCategories)[number];

export const gamesCatalog: GameCatalogItem[] = [
  {
    id: 'bitcoin-up-down',
    slug: 'up-down',
    title: 'Bitcoin Up / Down',
    status: 'active',
    category: 'Tahmin Oyunları',
    route: '/games/up-down',
    icon: 'trend',
    isFeatured: true,
    hasMiniChart: true,
    description: '30 saniyelik BTC fiyat yönü tahmin oyunu.',
    longDescription: 'Canlı BTC fiyatını baz alan, 30 saniyelik eğlence amaçlı UP / DOWN tahmin modu.'
  },
  {
    id: 'ethereum-up-down',
    slug: 'eth-up-down',
    title: 'Ethereum Up / Down',
    status: 'coming_soon',
    category: 'Tahmin Oyunları',
    route: '/games/eth-up-down',
    icon: 'trend',
    description: 'ETH fiyat hareketleri için eğlence amaçlı tahmin modu.',
    longDescription: 'Ethereum fiyat yönünü kısa süreli sanal puan akışıyla tahmin etmeye odaklanan mod.'
  },
  {
    id: 'whale-guess',
    slug: 'whale-guess',
    title: 'Whale Guess',
    status: 'coming_soon',
    category: 'On-Chain Oyunları',
    route: '/games/whale-guess',
    icon: 'wallet',
    description: 'Büyük cüzdan hareketlerinin piyasa etkisini tahmin et.',
    longDescription: 'Yüklü transfer, borsa girişi veya çıkışı gibi hareketlerin olası piyasa etkisini yorumla.'
  },
  {
    id: 'transfer-volume-guess',
    slug: 'transfer-volume-guess',
    title: 'Transfer Volume Guess',
    status: 'coming_soon',
    category: 'On-Chain Oyunları',
    route: '/games/transfer-volume-guess',
    icon: 'activity',
    description: 'ETH, BNB, BTC gibi ağlarda belirli sürede gerçekleşen toplam transfer miktarını tahmin et.',
    longDescription: 'Kullanıcı süre seçer, tahmin girer; oyun başlangıcından itibaren transferler toplanır ve süre sonunda tahminle karşılaştırılır.'
  },
  {
    id: 'gas-fee-challenge',
    slug: 'gas-fee-challenge',
    title: 'Gas Fee Challenge',
    status: 'coming_soon',
    category: 'On-Chain Oyunları',
    route: '/games/gas-fee-challenge',
    icon: 'gauge',
    description: 'Ağ ücretlerini ve işlem maliyetlerini tahmin etmeye dayalı mini oyun.',
    longDescription: 'Yoğunluk, gas seviyesi ve işlem maliyetlerini okuyarak eğlence amaçlı tahminler yap.'
  },
  {
    id: 'market-sentiment-quiz',
    slug: 'market-sentiment-quiz',
    title: 'Market Sentiment Quiz',
    status: 'coming_soon',
    category: 'Quizler',
    route: '/games/market-sentiment-quiz',
    icon: 'sentiment',
    description: 'Piyasa duyarlılığına dair hızlı bilgi ve yorumlama soruları.',
    longDescription: 'Haber, fiyat davranışı ve sosyal sinyaller üzerinden piyasa duyarlılığı soruları.'
  },
  {
    id: 'crypto-knowledge-quiz',
    slug: 'crypto-knowledge-quiz',
    title: 'Crypto Knowledge Quiz',
    status: 'coming_soon',
    category: 'Quizler',
    route: '/games/crypto-knowledge-quiz',
    icon: 'brain',
    description: 'Kripto, blockchain ve Web3 kavramlarıyla ilgili bilgi yarışması.',
    longDescription: 'Temel kripto kavramları, ağlar, token standartları ve Web3 kültürüyle ilgili quiz modu.'
  },
  {
    id: 'scam-or-safe',
    slug: 'scam-or-safe',
    title: 'Scam mı Değil mi?',
    status: 'coming_soon',
    category: 'Güvenlik Oyunları',
    route: '/games/scam-or-safe',
    icon: 'shield',
    description: 'Token, proje veya kontrat risk sinyallerini okuyarak güvenilir mi tahmin et.',
    longDescription: 'Sözleşme izinleri, likidite, sosyal sinyaller ve proje davranışları üzerinden risk okuma egzersizleri.'
  },
  {
    id: 'wallet-security-challenge',
    slug: 'wallet-security-challenge',
    title: 'Wallet Security Challenge',
    status: 'coming_soon',
    category: 'Güvenlik Oyunları',
    route: '/games/wallet-security-challenge',
    icon: 'lock',
    description: 'Seed phrase, phishing, izinler ve cüzdan güvenliği konularında öğretici senaryolar.',
    longDescription: 'Cüzdan güvenliği, phishing farkındalığı ve izin yönetimi üzerine eğitim odaklı mini senaryolar.'
  },
  {
    id: 'whale-flow-direction',
    slug: 'whale-flow-direction',
    title: 'Whale Flow Direction',
    status: 'coming_soon',
    category: 'On-Chain Oyunları',
    route: '/games/whale-flow-direction',
    icon: 'flow',
    description: 'Exchange inflow, outflow, bridge veya staking hareketlerini tahmin et.',
    longDescription: 'On-chain akış yönlerini okuyarak büyük transferlerin hangi kategoriye girdiğini tahmin et.'
  }
];
