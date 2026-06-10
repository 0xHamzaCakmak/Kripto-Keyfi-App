import { ChatChannel, ChatMessage, ChatNewsItem, ChatUser } from '../types';

export const CHAT_USERS: ChatUser[] = [
  { id: 'u1', name: 'AlphaSeeker', avatar: 'https://i.pravatar.cc/150?u=alpha', role: 'Analist', badge: 'On-chain', isOnline: true, reputation: 982 },
  { id: 'u2', name: 'DevLord', avatar: 'https://i.pravatar.cc/150?u=dev', role: 'Blockchain Developer', badge: 'Solidity', isOnline: true, reputation: 876 },
  { id: 'u3', name: 'CryptoQueen', avatar: 'https://i.pravatar.cc/150?u=queen', role: 'Trader', badge: 'DeFi', isOnline: true, reputation: 744 },
  { id: 'u4', name: 'SatoshiDaughter', avatar: 'https://i.pravatar.cc/150?u=satoshi', role: 'Whale', badge: 'BTC', isOnline: true, reputation: 1260 },
  { id: 'u5', name: 'SecOpsTR', avatar: 'https://i.pravatar.cc/150?u=secops', role: 'Güvenlik Uzmanı', badge: 'Audit', isOnline: false, reputation: 690 },
  { id: 'u6', name: 'AcademyMentor', avatar: 'https://i.pravatar.cc/150?u=mentor', role: 'Akademi Eğitmeni', badge: 'Web3', isOnline: true, reputation: 810 }
];

export const CHAT_CHANNELS: ChatChannel[] = [
  { id: 'global', group: 'Piyasalar', name: 'Global Stream', online: 1204 },
  { id: 'bitcoin', group: 'Piyasalar', name: 'Bitcoin', online: 420 },
  { id: 'ethereum', group: 'Piyasalar', name: 'Ethereum', online: 388 },
  { id: 'altcoin', group: 'Piyasalar', name: 'Altcoin', unread: 8 },
  { id: 'defi', group: 'Piyasalar', name: 'DeFi' },
  { id: 'solidity', group: 'Teknik', name: 'Solidity' },
  { id: 'security', group: 'Teknik', name: 'Smart Contract Security', unread: 3 },
  { id: 'layer2', group: 'Teknik', name: 'Layer-2' },
  { id: 'developer', group: 'Teknik', name: 'Developer Hub' },
  { id: 'beginners', group: 'Akademi', name: 'Yeni Başlayanlar' },
  { id: 'career', group: 'Akademi', name: 'Web3 Kariyer' },
  { id: 'education', group: 'Akademi', name: 'Eğitim Soruları' },
  { id: 'projects', group: 'Topluluk', name: 'Proje Tanıtımı' },
  { id: 'airdrop', group: 'Topluluk', name: 'Airdrop' },
  { id: 'alerts', group: 'Topluluk', name: 'Güvenlik Uyarıları', unread: 12 }
];

export const CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'm1',
    userId: 'u1',
    channelId: 'global',
    text: 'Did anyone see the whale movement on $BTC just now? Massive inflow to Binance. This wallet also moved 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D.',
    createdAt: '10:42',
    reactions: [
      { id: 'useful', label: 'Faydalı', count: 12 },
      { id: 'alpha', label: 'Alpha', count: 4 }
    ]
  },
  {
    id: 'm2',
    userId: 'u2',
    channelId: 'global',
    text: 'Updating the liquidity bot logic for the new $ETH pair. Reentrancy risk is low here but tx.origin should never be used.',
    createdAt: '10:45',
    code: 'function calculateHedgeRatio(price, volatility) {\n  return (price * volatility) / Math.sqrt(2 * Math.PI);\n}',
    reactions: [
      { id: 'quality', label: 'Kaliteli analiz', count: 8 }
    ]
  },
  {
    id: 'm3',
    userId: 'u3',
    channelId: 'global',
    text: 'Bullish on $SOL after the latest ecosystem update. This breakdown was useful: https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    createdAt: '10:48',
    reactions: []
  },
  {
    id: 'm4',
    userId: 'u5',
    channelId: 'global',
    text: 'Wallet Security reminder: never sign blind approvals. New phishing kit is targeting airdrop hunters. Read: https://security.kriptokeyfi.local/phishing-alert',
    createdAt: '10:54',
    reactions: [
      { id: 'security', label: 'Güvenlik uyarısı', count: 17 }
    ]
  }
];

export const CHAT_NEWS: ChatNewsItem[] = [
  { id: 'cn1', title: 'Bitcoin ETF girişlerinde artış', slug: 'bitcoin-etf-girisleri-piyasada-yeni-beklenti-olusturdu', category: 'Bitcoin', publishedAt: '10 dk önce' },
  { id: 'cn2', title: 'Ethereum Layer-2 işlem hacmi yükseldi', slug: 'ethereum-layer-2-aglarinda-islem-hacmi-artiyor', category: 'Ethereum', publishedAt: '22 dk önce' },
  { id: 'cn3', title: 'Büyük borsadan yeni listeleme duyurusu', slug: 'buyuk-borsadan-yeni-altcoin-listeleme-duyurusu', category: 'Borsa', publishedAt: '41 dk önce' }
];

export function getChatChannels() {
  return CHAT_CHANNELS;
}

export function getChatMessages(channelId = 'global') {
  return CHAT_MESSAGES.filter((message) => message.channelId === channelId);
}

export function getChatUsers() {
  return CHAT_USERS;
}

export function getChatNews() {
  return CHAT_NEWS;
}
