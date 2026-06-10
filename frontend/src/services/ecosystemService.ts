import { EcosystemProject, EcosystemTool } from '../types';

export const ECOSYSTEM_PROJECTS: EcosystemProject[] = [
  {
    id: 'p1',
    slug: 'nebula-dex',
    name: 'Nebula DEX',
    description: 'Cross-chain liquidity routing, yield farming and intent based swap execution for DeFi teams.',
    logo: 'https://picsum.photos/seed/nebula-ecosystem/120/120',
    category: 'DeFi',
    networks: ['Ethereum', 'Arbitrum', 'Base'],
    status: 'Active',
    tvl: '$184M',
    users: '128K',
    auditStatus: 'Audited',
    riskScore: 18,
    website: 'https://nebula.example',
    twitter: 'https://x.com/nebula',
    github: 'https://github.com/nebula',
    communityRating: 4.7,
    isFeatured: true,
    createdAt: '2026-05-22'
  },
  {
    id: 'p2',
    slug: 'titan-protocol',
    name: 'Titan Protocol',
    description: 'Institutional lending primitives and under-collateralized credit markets for Web3 treasuries.',
    logo: 'https://picsum.photos/seed/titan-ecosystem/120/120',
    category: 'DeFi',
    networks: ['Base', 'Polygon'],
    status: 'Beta',
    tvl: '$42M',
    users: '31K',
    auditStatus: 'Partial',
    riskScore: 42,
    website: 'https://titan.example',
    twitter: 'https://x.com/titan',
    github: 'https://github.com/titan',
    communityRating: 4.1,
    isFeatured: true,
    createdAt: '2026-05-18'
  },
  {
    id: 'p3',
    slug: 'zenith-nft',
    name: 'Zenith NFT',
    description: 'Curated digital art marketplace with creator royalties, drops and collector analytics.',
    logo: 'https://picsum.photos/seed/zenith-ecosystem/120/120',
    category: 'NFT Marketplace',
    networks: ['Ethereum', 'Polygon'],
    status: 'Active',
    tvl: '$18M',
    users: '86K',
    auditStatus: 'Audited',
    riskScore: 24,
    website: 'https://zenith.example',
    twitter: 'https://x.com/zenith',
    github: 'https://github.com/zenith',
    communityRating: 4.5,
    isFeatured: false,
    createdAt: '2026-04-27'
  },
  {
    id: 'p4',
    slug: 'oracle-guard',
    name: 'Oracle Guard',
    description: 'Security analytics, oracle anomaly detection and risk monitoring for smart contract teams.',
    logo: 'https://picsum.photos/seed/oracle-ecosystem/120/120',
    category: 'Tools & Infrastructure',
    networks: ['Ethereum', 'Arbitrum', 'Solana'],
    status: 'Active',
    tvl: '$9M',
    users: '19K',
    auditStatus: 'Audited',
    riskScore: 12,
    website: 'https://oracle.example',
    twitter: 'https://x.com/oracle',
    github: 'https://github.com/oracle',
    communityRating: 4.8,
    isFeatured: true,
    createdAt: '2026-05-29'
  },
  {
    id: 'p5',
    slug: 'dao-forge',
    name: 'DAO Forge',
    description: 'Governance setup, treasury dashboards and proposal tooling for DAO operators.',
    logo: 'https://picsum.photos/seed/dao-forge/120/120',
    category: 'DAO',
    networks: ['Ethereum', 'Arbitrum'],
    status: 'Testnet',
    tvl: '$3M',
    users: '8K',
    auditStatus: 'Unaudited',
    riskScore: 58,
    website: 'https://dao.example',
    twitter: 'https://x.com/dao',
    github: 'https://github.com/dao',
    communityRating: 3.8,
    isFeatured: false,
    createdAt: '2026-06-01'
  },
  {
    id: 'p6',
    slug: 'ai-indexer',
    name: 'AI Indexer',
    description: 'AI assisted blockchain data indexing, alerts and natural language analytics for protocols.',
    logo: 'https://picsum.photos/seed/ai-indexer/120/120',
    category: 'AI & Data',
    networks: ['Base', 'Solana'],
    status: 'Beta',
    tvl: '$6M',
    users: '14K',
    auditStatus: 'Partial',
    riskScore: 36,
    website: 'https://ai-indexer.example',
    twitter: 'https://x.com/aiindexer',
    github: 'https://github.com/aiindexer',
    communityRating: 4.2,
    isFeatured: false,
    createdAt: '2026-05-10'
  },
  {
    id: 'p7',
    slug: 'shadow-yield',
    name: 'Shadow Yield',
    description: 'High APY vaults with opaque strategy routing. Community reports indicate elevated withdrawal risk.',
    logo: 'https://picsum.photos/seed/shadow-yield/120/120',
    category: 'DeFi',
    networks: ['BNB Chain'],
    status: 'Risky',
    tvl: '$12M',
    users: '22K',
    auditStatus: 'Unaudited',
    riskScore: 86,
    website: 'https://shadow.example',
    twitter: 'https://x.com/shadow',
    github: 'https://github.com/shadow',
    communityRating: 2.1,
    isFeatured: false,
    createdAt: '2026-06-04'
  }
];

export const ECOSYSTEM_TOOLS: EcosystemTool[] = [
  { id: 'token-launchpad', name: 'Token Launchpad', description: 'OpenZeppelin tabanli ERC20 token olusturma akisi.', category: 'Build', status: 'Active', route: '/ecosystem/build/token-launchpad', icon: 'Rocket' },
  { id: 'contract-generator', name: 'Contract Generator', description: 'Common contract templates for NFT, DAO and vault flows.', category: 'Build', status: 'Coming Soon', route: '/ecosystem/build/contract-generator', icon: 'Code' },
  { id: 'abi-decoder', name: 'ABI Decoder', description: 'Decode contract ABI and inspect function signatures.', category: 'Build', status: 'Mock', route: '/ecosystem/build/abi-decoder', icon: 'FileCode' },
  { id: 'gas-estimator', name: 'Gas Estimator', description: 'Estimate gas by network, contract type and complexity.', category: 'Build', status: 'Mock', route: '/ecosystem/build/gas-estimator', icon: 'Zap' },
  { id: 'contract-verifier', name: 'Contract Verifier', description: 'Prepare source verification checklist for explorers.', category: 'Build', status: 'Coming Soon', route: '/ecosystem/build/contract-verifier', icon: 'BadgeCheck' },
  { id: 'wallet-intelligence', name: 'Wallet Intelligence', description: 'Analyze wallet age, activity, risk and protocol exposure.', category: 'Monitor', status: 'Mock', route: '/ecosystem/monitor', icon: 'Wallet' },
  { id: 'whale-tracker', name: 'Whale Tracker', description: 'Track high value transfers, staking and bridge activity.', category: 'Monitor', status: 'Mock', route: '/ecosystem/monitor', icon: 'Activity' },
  { id: 'rug-pull-scanner', name: 'Rug Pull Scanner', description: 'Mock token risk report for owner permissions and liquidity.', category: 'Security', status: 'Mock', route: '/ecosystem/security', icon: 'ShieldAlert' }
];

export function getEcosystemProjects() {
  return ECOSYSTEM_PROJECTS;
}

export function getEcosystemProjectBySlug(slug: string) {
  return ECOSYSTEM_PROJECTS.find((project) => project.slug === slug);
}

export function getEcosystemTools(category?: EcosystemTool['category']) {
  return category ? ECOSYSTEM_TOOLS.filter((tool) => tool.category === category) : ECOSYSTEM_TOOLS;
}
