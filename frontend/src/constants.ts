import { Asset, Project, Article, Message } from './types';

export const ASSETS: Asset[] = [
  {
    id: 'btc',
    name: 'Bitcoin',
    symbol: 'BTC',
    price: 64281.0,
    change24h: 2.45,
    balance: 1.54,
    value: 98992.74,
    icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png'
  },
  {
    id: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    price: 3421.12,
    change24h: -0.82,
    balance: 10.25,
    value: 35066.48,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png'
  },
  {
    id: 'sol',
    name: 'Solana',
    symbol: 'SOL',
    price: 145.67,
    change24h: 5.12,
    balance: 60.0,
    value: 8740.2,
    icon: 'https://cryptologos.cc/logos/solana-sol-logo.png'
  }
];

export const PROJECTS: Project[] = [
  {
    id: '1',
    name: 'Nebula DEX',
    description: 'The next generation decentralized exchange for cross-chain liquidity mining and yield farming.',
    category: 'DeFi',
    status: 'ACTIVE',
    chains: ['ETH', 'SOL'],
    icon: 'https://picsum.photos/seed/nebula/100/100'
  },
  {
    id: '2',
    name: 'Titan Protocol',
    description: 'Under-collateralized lending primitives for institutional grade capital markets on Web3.',
    category: 'DeFi',
    status: 'BETA',
    chains: ['BASE'],
    icon: 'https://picsum.photos/seed/titan/100/100'
  },
  {
    id: '3',
    name: 'Zenith NFT',
    description: 'Curated digital art marketplace focusing on generative artists and 1-of-1 masterworks.',
    category: 'NFT Marketplace',
    status: 'ACTIVE',
    chains: ['ETH', 'ARB'],
    icon: 'https://picsum.photos/seed/zenith/100/100'
  },
  {
    id: '4',
    name: 'Oracle Guard',
    description: 'Real-time security analytics and threat detection for smart contract developers.',
    category: 'Tools & Infrastructure',
    status: 'ACTIVE',
    chains: ['ALL'],
    icon: 'https://picsum.photos/seed/oracle/100/100'
  },
  {
    id: '5',
    name: 'Vaultify',
    description: 'Multi-signature hardware wallet integration with social recovery and inheritance features.',
    category: 'Tools & Infrastructure',
    status: 'ACTIVE',
    chains: ['BTC', 'ETH'],
    icon: 'https://picsum.photos/seed/vaultify/100/100'
  },
  {
    id: '6',
    name: 'EtherSync',
    description: 'Sub-second state synchronization for decentralized applications on Ethereum Layer 2s.',
    category: 'Tools & Infrastructure',
    status: 'BETA',
    chains: ['OP', 'ZK'],
    icon: 'https://picsum.photos/seed/ethersync/100/100'
  }
];

export const ARTICLES: Article[] = [
  {
    id: '1',
    title: 'The Liquidity Surge: What Q4 Means for DeFi protocols',
    excerpt: 'Deep dive into the institutional inflows reshaping decentralized finance landscapes this quarter.',
    category: 'Market',
    readTime: '5 min read',
    date: 'Oct 24, 2024',
    author: {
      name: 'Marcus Vane',
      role: 'Chief Strategist',
      avatar: 'https://i.pravatar.cc/150?u=marcus'
    },
    image: 'https://picsum.photos/seed/liquidity/800/600',
    views: '142k'
  },
  {
    id: '2',
    title: 'Bitcoin Halving: 100 Days Out',
    excerpt: 'Analyzing the historical patterns and what to expect from the upcoming halving event.',
    category: 'Analysis',
    readTime: '8 min read',
    date: 'Oct 22, 2024',
    author: {
      name: 'Sarah Chen',
      role: 'Senior Analyst',
      avatar: 'https://i.pravatar.cc/150?u=sarah'
    },
    image: 'https://picsum.photos/seed/bitcoin/800/600',
    views: '89k'
  }
];

export const MESSAGES: Message[] = [
  {
    id: '1',
    user: {
      name: 'AlphaSeeker',
      avatar: 'https://i.pravatar.cc/150?u=alpha',
      color: 'primary'
    },
    content: 'Did anyone see the whale movement on $BTC just now? Massive inflow to exchanges. Might see a temporary dip before another leg up.',
    timestamp: '10:42 AM',
    type: 'text'
  },
  {
    id: '2',
    user: {
      name: 'DevLord',
      avatar: 'https://i.pravatar.cc/150?u=dev',
      color: 'tertiary'
    },
    content: 'Updating the liquidity bot logic for the new $ETH pair:',
    timestamp: '10:45 AM',
    type: 'code',
    code: 'function calculateHedgeRatio(price, volatility) {\n  return (price * volatility) / Math.sqrt(2 * Math.PI);\n}'
  },
  {
    id: '3',
    user: {
      name: 'CryptoQueen',
      avatar: 'https://i.pravatar.cc/150?u=queen',
      color: 'secondary'
    },
    content: 'Bullish on $ETH following the mainnet upgrade. Staking yields are looking great right now.',
    timestamp: '10:48 AM',
    type: 'text'
  }
];
