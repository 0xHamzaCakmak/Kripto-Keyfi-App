import { api } from './apiClient';

export type PublicVideo = {
  id: number;
  youtubeVideoId: string;
  youtubeUrl: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  duration: string | null;
  durationSeconds: number | null;
  contentType: 'long' | 'short';
  publishedAt: string | null;
  channelName: string;
  channelAvatarUrl: string | null;
  source: 'admin_manual' | 'creator_auto' | 'kriptokeyfi_auto';
  isOwnChannel: boolean;
};

export type YoutubeChannel = {
  id: number;
  channelId: string;
  channelName: string | null;
  channelUrl: string | null;
  avatarUrl: string | null;
  isOwnChannel: boolean;
  status: 'active' | 'paused';
  lastSyncedAt: string | null;
  videoCount: number;
  createdAt: string;
};

export type CreatorApplicationState = {
  status: 'not_applied' | 'pending' | 'approved' | 'rejected' | 'suspended';
  appliedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
};

export type MyCreatorState = { channel: YoutubeChannel | null; application: CreatorApplicationState };
export type AdminCreatorApplication = {
  user: { id: string; name: string | null; username: string; email: string; avatarUrl: string | null };
  channel: YoutubeChannel | null;
  application: CreatorApplicationState;
};

type Result<T> = { data: T };

export type VideoCounts = { all: number; long: number; short: number };

export async function getVideos(filters: { contentType?: 'all' | 'long' | 'short'; creator?: string } = {}) {
  const response = await api.get<Result<{ videos: PublicVideo[]; counts: VideoCounts }>>('/videos', {
    params: { content_type: filters.contentType ?? 'all', ...(filters.creator ? { creator: filters.creator } : {}) },
  });
  return response.data.data;
}

export async function addVideo(youtubeUrl: string) {
  const response = await api.post<Result<{ video: PublicVideo }>>('/admin/videos', { youtube_url: youtubeUrl });
  return response.data.data.video;
}

export async function getYoutubeChannels() {
  const response = await api.get<Result<{ channels: YoutubeChannel[] }>>('/admin/youtube-channels');
  return response.data.data.channels;
}

export async function addYoutubeChannel(channelUrl: string) {
  const response = await api.post<Result<{ channel: YoutubeChannel; sync: { discovered: number; created: number; syncedAt: string } }>>('/admin/youtube-channels', { channel_url: channelUrl });
  return response.data.data;
}

export async function setYoutubeChannelStatus(id: number, status: YoutubeChannel['status']) {
  const response = await api.patch<Result<{ channel: YoutubeChannel }>>(`/admin/youtube-channels/${id}/status`, { status });
  return response.data.data.channel;
}

export async function getMyCreatorState() {
  const response = await api.get<Result<MyCreatorState>>('/creator/me');
  return response.data.data;
}

export async function connectMyYoutubeChannel(channelUrl: string) {
  const response = await api.post<Result<{ channel: YoutubeChannel }>>('/creator/channel', { channel_url: channelUrl });
  return response.data.data.channel;
}

export async function applyForYoutubeCreator() {
  const response = await api.post<Result<{ application: CreatorApplicationState }>>('/creator/apply');
  return response.data.data.application;
}

export async function addMyCreatorVideo(youtubeUrl: string) {
  const response = await api.post<Result<{ video: PublicVideo }>>('/creator/videos', { youtube_url: youtubeUrl });
  return response.data.data.video;
}

export async function getCreatorApplications() {
  const response = await api.get<Result<{ applications: AdminCreatorApplication[] }>>('/admin/creator-applications');
  return response.data.data.applications;
}

export async function reviewCreatorApplication(userId: string, status: 'approved' | 'rejected' | 'suspended') {
  const response = await api.patch<Result<{ application: CreatorApplicationState; sync: { created: number; discovered: number } | null }>>(`/admin/creator-applications/${userId}/status`, { status });
  return response.data.data;
}
