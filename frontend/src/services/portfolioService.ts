import { ASSETS, VIDEOS } from '../constants';
import { ACADEMY_ARTICLES } from '../constants';
import { getEcosystemProjects } from './ecosystemService';
import { getCurrentUser } from './userService';

export function getUserPortfolio() {
  return {
    totalValue: '$142,854.32',
    change24h: '+12.4%',
    profitLoss: '+$24,500',
    assets: ASSETS,
    allocation: [
      { name: 'Bitcoin', value: 70, color: '#8dacff' },
      { name: 'Ethereum', value: 25, color: '#00ffa3' },
      { name: 'Solana', value: 5, color: '#ac89ff' }
    ],
    chart: [
      { name: '00:00', value: 120000 },
      { name: '04:00', value: 125000 },
      { name: '08:00', value: 122000 },
      { name: '12:00', value: 135000 },
      { name: '16:00', value: 130000 },
      { name: '20:00', value: 142854 }
    ]
  };
}

export function getSavedContent() {
  return {
    // News are loaded asynchronously from the backend in the News module.
    news: [],
    academy: ACADEMY_ARTICLES.slice(0, 3),
    videos: VIDEOS.slice(0, 3),
    projects: getEcosystemProjects().slice(0, 3)
  };
}

export function getUserActivity() {
  return [
    { id: 'ua1', type: 'Comment', text: 'Ethereum ETF haberine yorum yaptı', date: 'Bugün' },
    { id: 'ua2', type: 'Like', text: 'Smart Contract güvenliği içeriğini beğendi', date: 'Dün' },
    { id: 'ua3', type: 'Chat', text: 'Global Stream kanalında $BTC analizi paylaştı', date: 'Dün' },
    { id: 'ua4', type: 'Video', text: 'DeFi Yield Rehberi videosunu izledi', date: '2 gün önce' },
    { id: 'ua5', type: 'Read', text: 'Wallet Security makalesini okudu', date: '3 gün önce' }
  ];
}

export function getConnectedWallets() {
  const user = getCurrentUser();
  return [
    { id: 'w1', label: 'Main Wallet', address: user.walletAddress, network: 'Ethereum', status: 'Connected' },
    { id: 'w2', label: 'Secondary Wallet', address: '0x8ba1f109551bD432803012645Ac136ddd64DBA72', network: 'Arbitrum', status: 'Connected' }
  ];
}

export function getWatchlist() {
  return ASSETS.map((asset) => ({ ...asset, note: `${asset.symbol} price alert active` }));
}
