import { api } from './apiClient';

export type PublicVideo = {
  id: number;
  youtubeVideoId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  duration: string | null;
  publishedAt: string | null;
  channelName: string;
  channelAvatarUrl: string | null;
  source: 'manual' | 'auto';
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
