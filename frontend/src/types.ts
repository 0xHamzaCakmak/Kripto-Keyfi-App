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

export interface VideoComment {
  id: string;
  username: string;
  avatar: string;
  date: string;
  content: string;
  likes: number;
}

export interface VideoAiTimestamp {
  time: string;
  label: string;
}

export interface Video {
  id: string;
  youtubeVideoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  duration: string;
  channelName: string;
  channelSlug: string;
  channelAvatar: string;
  channelVerified: boolean;
  channelDescription: string;
  channelBanner: string;
  channelSubscribers: string;
  publishedAt: string;
  viewCount: string;
  category: string;
  tags: string[];
  isShort: boolean;
  isTrending: boolean;
  aiSummary: string;
  aiTopics: string[];
  aiTimestamps: VideoAiTimestamp[];
  comments: VideoComment[];
}

export interface AcademyComment {
  id: string;
  username: string;
  avatar: string;
  date: string;
  content: string;
  likes: number;
}

export interface AcademyContentBlock {
  id: string;
  heading: string;
  body: string;
  kind?: 'text' | 'code' | 'quote' | 'info' | 'warning';
}

export interface AcademyArticle {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  content: AcademyContentBlock[];
  coverImage: string;
  category: string;
  tags: string[];
  authorName: string;
  authorAvatar: string;
  authorBio: string;
  publishedAt: string;
  updatedAt: string;
  readingTime: string;
  viewCount: string;
  commentCount: number;
  level: 'Başlangıç' | 'Orta' | 'İleri';
  contentType: 'Makale' | 'Rehber' | 'Eğitim Serisi' | 'Analiz' | 'Akademik Çalışma' | 'Rapor' | 'Sözlük' | 'Güvenlik Uyarısı';
  isFeatured: boolean;
  isPopular: boolean;
  seriesId?: string;
  aiSummary: string;
  aiKeyPoints: string[];
  aiWhoShouldRead: string[];
  aiLearningOutcomes: string[];
  relatedConcepts: string[];
  comments: AcademyComment[];
}

export interface AcademySeriesLesson {
  articleSlug: string;
  title: string;
  readingTime: string;
  completed?: boolean;
}

export interface AcademySeries {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImage: string;
  level: 'Başlangıç' | 'Orta' | 'İleri';
  totalLessons: number;
  totalReadingTime: string;
  progress: number;
  lessons: AcademySeriesLesson[];
}

export interface GlossaryTerm {
  id: string;
  term: string;
  slug: string;
  shortDefinition: string;
  fullDefinition: string;
  relatedTerms: string[];
}

export interface NewsComment {
  id: string;
  username: string;
  avatar: string;
  date: string;
  content: string;
  likes: number;
}

export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  originalTitle: string;
  isLocalized: boolean;
  localizationPending: boolean;
  aiStatus: 'WAITING' | 'PROCESSING' | 'READY' | 'REVIEW_REQUIRED' | 'FAILED';
  localizationError: string | null;
  localizationAttempts: number;
  manualEditedAt: string | null;
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  category: string | null;
  authorName: string | null;
  source: { name: string; slug: string; websiteUrl: string; logoUrl: string | null; attributionRequired: boolean } | null;
  publishedAt: string;
  sourceUpdatedAt: string | null;
  readingTimeMinutes: number;
  viewCount: number;
  isFeatured: boolean;
  isBreaking: boolean;
  isEditorPick: boolean;
  archivedAt: string | null;
  tags: { name: string; slug: string }[];
  coins: { symbol: string; name: string | null }[];
  originalUrl: string;
  aiSummary: { whyItMatters: string | null; marketImpact: string | null; watchOuts: string | null; confidence: number | null; needsReview: boolean; wordCount: number | null; generatedAt: string | null; qualityFlags: string[]; provider: string | null; model: string | null } | null;
}

export interface ChatCoin {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: string;
  trend: 'up' | 'down' | 'sideways';
}

export interface ChatUser {
  id: string;
  name: string;
  avatar: string;
  role: string;
  badge: string;
  isOnline: boolean;
  reputation: number;
}

export interface ChatReaction {
  id: string;
  label: string;
  count: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  channelId: string;
  text: string;
  createdAt: string;
  reactions: ChatReaction[];
  code?: string;
}

export interface ChatChannel {
  id: string;
  name: string;
  group: string;
  online?: number;
  unread?: number;
}

export interface WhaleEvent {
  id: string;
  type: string;
  asset: string;
  amount: string;
  network: string;
  time: string;
  importance: 'Düşük' | 'Orta' | 'Yüksek';
}

export interface ChatNewsItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  publishedAt: string;
}

export interface EcosystemProject {
  id: string;
  slug: string;
  name: string;
  description: string;
  logo: string;
  category: string;
  networks: string[];
  status: 'Active' | 'Beta' | 'Testnet' | 'Risky';
  tvl: string;
  users: string;
  auditStatus: 'Audited' | 'Partial' | 'Unaudited';
  riskScore: number;
  website: string;
  twitter: string;
  github: string;
  communityRating: number;
  isFeatured: boolean;
  createdAt: string;
}

export interface EcosystemTool {
  id: string;
  name: string;
  description: string;
  category: 'Build' | 'Monitor' | 'Security';
  status: 'Active' | 'Coming Soon' | 'Mock';
  route: string;
  icon: string;
}

export interface TokenomicsAllocation {
  Community: number;
  Team: number;
  Treasury: number;
  Liquidity: number;
  Airdrop: number;
  Marketing: number;
}

export interface TokenVesting {
  cliff: string;
  duration: string;
  startDate: string;
  lockedPercent: number;
}

export interface CreatedToken {
  id: string;
  name: string;
  symbol: string;
  network: string;
  supply: string;
  decimals: string;
  features: string[];
  tokenomics: TokenomicsAllocation;
  vesting: TokenVesting;
  createdAt: string;
  contractAddress: string;
  status: 'Draft' | 'Testnet Ready' | 'Mock Deployed';
}

export type RoleStatus = 'not_applied' | 'pending' | 'verification_pending' | 'admin_review' | 'verified' | 'rejected' | 'suspended';

export interface PlatformRole {
  id: 'user' | 'creator' | 'author' | 'project_owner' | 'developer' | 'security_researcher' | 'moderator' | 'admin';
  label: string;
  status: RoleStatus;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  verificationStatus?: RoleStatus;
  approvalStatus?: RoleStatus;
}

export interface PlatformUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  avatar: string;
  coverImage: string;
  walletAddress: string;
  bio: string;
  location?: string;
  trustScore: number;
  reputationScore: number;
  memberSince: string;
  roles: PlatformRole[];
  badges: string[];
  socialLinks: {
    youtube?: string;
    twitter?: string;
    linkedin?: string;
    github?: string;
    website?: string;
  };
}

export interface CreatorApplication {
  id: string;
  fullName: string;
  username: string;
  bio: string;
  youtubeUrl: string;
  channelName: string;
  categories: string[];
  socialLinks: string;
  motivation: string;
  status: 'draft' | 'pending_review' | 'verification_pending' | 'admin_review' | 'approved' | 'rejected';
  verificationCode: string;
  verificationLink: string;
  submittedAt: string;
}

export interface CreatorVideo {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  duration: string;
  category: string;
  status: 'Pending Approval' | 'Published' | 'Hidden' | 'Rejected';
  views: string;
  comments: number;
  saves: number;
}
