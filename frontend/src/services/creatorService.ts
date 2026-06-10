import { CreatorApplication, CreatorVideo } from '../types';
import { getCurrentUser, getRoleStatus } from './userService';

const CREATOR_APPLICATION_KEY = 'kripto-keyfi-creator-application';

export const creatorVideos: CreatorVideo[] = [
  { id: 'cv1', title: 'Ethereum ETF Etkisi ve 2026 Beklentileri', thumbnail: 'https://picsum.photos/seed/creator-video-1/520/300', publishedAt: '10 Haziran 2026', duration: '18:42', category: 'Ethereum', status: 'Published', views: '42.8K', comments: 128, saves: 920 },
  { id: 'cv2', title: 'Airdrop Avcılığı İçin Güvenli Cüzdan Rutini', thumbnail: 'https://picsum.photos/seed/creator-video-2/520/300', publishedAt: '8 Haziran 2026', duration: '00:58', category: 'Airdrop', status: 'Pending Approval', views: '0', comments: 0, saves: 0 },
  { id: 'cv3', title: 'DeFi Yield Rehberi: APR ve APY', thumbnail: 'https://picsum.photos/seed/creator-video-3/520/300', publishedAt: '4 Haziran 2026', duration: '21:37', category: 'DeFi', status: 'Published', views: '22.1K', comments: 74, saves: 430 }
];

export function applyForCreator(data: Omit<CreatorApplication, 'id' | 'status' | 'verificationCode' | 'verificationLink' | 'submittedAt'>) {
  const application: CreatorApplication = {
    ...data,
    id: crypto.randomUUID(),
    status: 'verification_pending',
    verificationCode: `KRIPTOKEYFI-${Math.floor(10000 + Math.random() * 89999)}`,
    verificationLink: `https://kriptokeyfi.com/creator/${data.username}`,
    submittedAt: new Date().toLocaleString('tr-TR')
  };
  localStorage.setItem(CREATOR_APPLICATION_KEY, JSON.stringify(application));
  return application;
}

export function getCreatorApplicationStatus(): CreatorApplication {
  const raw = localStorage.getItem(CREATOR_APPLICATION_KEY);
  if (raw) return JSON.parse(raw);
  const user = getCurrentUser();
  return {
    id: 'mock-creator-application',
    fullName: user.fullName,
    username: user.username,
    bio: user.bio,
    youtubeUrl: user.socialLinks.youtube || '',
    channelName: 'Kripto Keyfi Hamza',
    categories: ['Kripto', 'Web3', 'Eğitim'],
    socialLinks: Object.values(user.socialLinks).filter(Boolean).join('\n'),
    motivation: 'Kripto Keyfi topluluğunda düzenli ve güvenilir video içerikleri yayınlamak istiyorum.',
    status: 'verification_pending',
    verificationCode: 'KRIPTOKEYFI-84291',
    verificationLink: `https://kriptokeyfi.com/creator/${user.username}`,
    submittedAt: '10 Haziran 2026'
  };
}

export function getCreatorDashboard() {
  const verified = getRoleStatus('creator') === 'verified';
  return {
    hasAccess: verified,
    overview: {
      totalVideos: 18,
      publishedVideos: 14,
      pendingVideos: 3,
      totalViews: '284K',
      totalComments: 842,
      followers: '12.4K',
      engagement: '8.6%',
      trustScore: 91
    },
    channel: {
      name: 'Kripto Keyfi Hamza',
      avatar: 'https://i.pravatar.cc/150?u=creator-channel',
      description: 'Kripto, Web3, DeFi ve güvenlik odaklı Türkçe video içerikleri.',
      url: 'https://youtube.com/@hamzacakmak',
      verificationStatus: verified ? 'Approved' : 'Verification Pending',
      lastSync: '10 Haziran 2026, 11:20'
    },
    videos: creatorVideos
  };
}

export function checkCreatorVerification() {
  const application = getCreatorApplicationStatus();
  return { ...application, status: 'admin_review' as const };
}
