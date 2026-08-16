import { api } from './apiClient';

export type PublicVideo = {
  id: number;
  youtubeVideoId: string;
  youtubeUrl: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  duration: string | null;
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

type Result<T> = { data: T };

export async function getVideos() {
  const response = await api.get<Result<{ videos: PublicVideo[] }>>('/videos');
  return response.data.data.videos;
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
