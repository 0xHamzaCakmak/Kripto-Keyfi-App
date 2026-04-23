export interface Asset {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  balance: number;
  value: number;
  icon: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'ACTIVE' | 'BETA';
  chains: string[];
  icon: string;
}

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  date: string;
  author: {
    name: string;
    role: string;
    avatar: string;
  };
  image: string;
  views: string;
}

export interface Message {
  id: string;
  user: {
    name: string;
    avatar: string;
    role?: string;
    color?: string;
  };
  content: string;
  timestamp: string;
  type?: 'text' | 'code' | 'image';
  image?: string;
  code?: string;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  tier: string;
  walletAddress: string;
  trustScore: number;
  isVerified: boolean;
}
