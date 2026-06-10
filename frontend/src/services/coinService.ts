import { ChatCoin } from '../types';

export const MOCK_COINS: ChatCoin[] = [
  { symbol: 'BTC', name: 'Bitcoin', price: 64281, change24h: 2.45, marketCap: '$1.26T', trend: 'up' },
  { symbol: 'ETH', name: 'Ethereum', price: 3421.12, change24h: -0.82, marketCap: '$411B', trend: 'sideways' },
  { symbol: 'SOL', name: 'Solana', price: 145.67, change24h: 5.12, marketCap: '$68B', trend: 'up' },
  { symbol: 'ARB', name: 'Arbitrum', price: 1.18, change24h: -1.24, marketCap: '$4.2B', trend: 'down' },
  { symbol: 'AVAX', name: 'Avalanche', price: 31.42, change24h: 12.4, marketCap: '$12.5B', trend: 'up' },
  { symbol: 'BNB', name: 'BNB', price: 612.2, change24h: 0.74, marketCap: '$90B', trend: 'sideways' },
  { symbol: 'XRP', name: 'XRP', price: 0.61, change24h: -0.34, marketCap: '$33B', trend: 'sideways' }
];

export function getCoinBySymbol(symbol: string) {
  return MOCK_COINS.find((coin) => coin.symbol === symbol.replace('$', '').toUpperCase());
}

export function getMentionedCoins(messageText: string) {
  const matches = messageText.match(/\$[A-Za-z]{2,6}\b/g) || [];
  const symbols = [...new Set(matches.map((match) => match.replace('$', '').toUpperCase()))];
  return symbols.map(getCoinBySymbol).filter(Boolean) as ChatCoin[];
}
