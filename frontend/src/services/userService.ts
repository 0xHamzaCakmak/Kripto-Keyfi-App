import { PlatformUser } from '../types';

export const CURRENT_USER: PlatformUser = {
  id: 'user-1',
  username: 'hamzacakmak',
  fullName: 'Hamza Cakmak',
  email: '0xhamzacakmak@gmail.com',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hamza',
  coverImage: 'https://picsum.photos/seed/hamza-profile-cover/1400/420',
  walletAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  bio: 'Kripto, Web3 ürünleri, içerik üretimi ve topluluk odaklı projeler üzerine çalışan Kripto Keyfi kullanıcısı.',
  location: 'Istanbul',
  trustScore: 98,
  reputationScore: 8420,
  memberSince: 'Oct 2023',
  roles: [
    { id: 'user', label: 'Normal User', status: 'verified' },
    { id: 'creator', label: 'Creator / YouTuber', status: 'pending', submittedAt: '2026-06-10', verificationStatus: 'verification_pending', approvalStatus: 'pending' },
    { id: 'author', label: 'Author / Akademi Yazarı', status: 'not_applied' },
    { id: 'project_owner', label: 'Project Owner', status: 'not_applied' },
    { id: 'developer', label: 'Developer', status: 'verified', reviewedAt: '2026-05-18', reviewedBy: 'admin' },
    { id: 'security_researcher', label: 'Security Researcher', status: 'pending', submittedAt: '2026-06-08' }
  ],
  badges: ['Diamond Elite', 'Early Member', 'Wallet Verified', 'DeFi Explorer', 'Developer'],
  socialLinks: {
    youtube: 'https://youtube.com/@hamzacakmak',
    twitter: 'https://x.com/hamzacakmak',
    linkedin: 'https://linkedin.com/in/hamzacakmak',
    github: 'https://github.com/hamzacakmak',
    website: 'https://hamzacakmak.dev'
  }
};

export function getCurrentUser() {
  return CURRENT_USER;
}

export function getPublicProfile(username: string) {
  return username === CURRENT_USER.username ? CURRENT_USER : null;
}

export function updateIdentityProfile(data: Partial<PlatformUser>) {
  return { ...CURRENT_USER, ...data };
}

export function getUserRoles() {
  return CURRENT_USER.roles;
}

export function getRoleStatus(roleId: PlatformUser['roles'][number]['id']) {
  return CURRENT_USER.roles.find((role) => role.id === roleId)?.status || 'not_applied';
}
