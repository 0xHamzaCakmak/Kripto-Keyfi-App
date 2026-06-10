import { WhaleEvent } from '../types';

export const MOCK_WHALE_FEED: WhaleEvent[] = [
  { id: 'w1', type: 'Exchange Inflow', asset: 'BTC', amount: '500 BTC', network: 'Bitcoin', time: '3 dk önce', importance: 'Yüksek' },
  { id: 'w2', type: 'Transfer', asset: 'USDT', amount: '2M USDT', network: 'Ethereum', time: '11 dk önce', importance: 'Orta' },
  { id: 'w3', type: 'Stake', asset: 'ETH', amount: '1200 ETH', network: 'Ethereum', time: '18 dk önce', importance: 'Orta' },
  { id: 'w4', type: 'Bridge', asset: 'USDC', amount: '8M USDC', network: 'Arbitrum', time: '26 dk önce', importance: 'Yüksek' }
];

export function getWhaleFeed() {
  return MOCK_WHALE_FEED;
}
