import { z } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

const thumbnailSchema = z.record(z.object({ url: z.string().url() })).default({});
const videoItemSchema = z.object({
  id: z.string(),
  snippet: z.object({
    title: z.string(), description: z.string().default(''), channelId: z.string(), channelTitle: z.string().default('YouTube'),
    publishedAt: z.string(), thumbnails: thumbnailSchema,
  }),
  contentDetails: z.object({ duration: z.string() }),
});
const youtubeVideoResponseSchema = z.object({ items: z.array(videoItemSchema) });
const youtubeChannelResponseSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    snippet: z.object({ title: z.string(), customUrl: z.string().optional(), thumbnails: thumbnailSchema }),
    contentDetails: z.object({ relatedPlaylists: z.object({ uploads: z.string() }) }),
  })),
});
const youtubeSearchResponseSchema = z.object({
  items: z.array(z.object({ id: z.object({ channelId: z.string() }) })),
});
const youtubePlaylistResponseSchema = z.object({
  nextPageToken: z.string().optional(),
  items: z.array(z.object({
    contentDetails: z.object({ videoId: z.string(), videoPublishedAt: z.string().optional() }),
  })),
});

export type YoutubeVideoDetails = {
  youtubeVideoId: string;
  youtubeUrl: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  duration: string;
  publishedAt: Date;
  channelName: string;
  channelId: string;
};

export type YoutubeChannelInfo = {
  channelId: string;
  channelName: string;
  channelUrl: string;
  avatarUrl: string | null;
  uploadsPlaylistId: string;
};

function bestThumbnail(thumbnails: Record<string, { url: string }>) {
  return thumbnails.maxres?.url ?? thumbnails.standard?.url ?? thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null;
}

async function youtubeGet<S extends z.ZodTypeAny>(path: string, params: Record<string, string>, schema: S, apiKey = env.YOUTUBE_API_KEY): Promise<z.output<S>> {
  if (!apiKey) throw new ApiError(503, 'YouTube entegrasyonu henüz yapılandırılmadı.', 'YOUTUBE_NOT_CONFIGURED');
  const query = new URLSearchParams({ ...params, key: apiKey });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${query.toString()}`, {
    headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new ApiError(response.status === 403 ? 502 : 503, 'YouTube bilgileri alınamadı. Lütfen daha sonra tekrar deneyin.', 'YOUTUBE_API_ERROR');
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) throw new ApiError(502, 'YouTube beklenmeyen bir yanıt döndürdü.', 'YOUTUBE_INVALID_RESPONSE');
  return parsed.data;
}

export function parseYoutubeVideoId(input: string) {
  const value = input.trim();
  let url: URL;
  try { url = new URL(value); } catch { throw new ApiError(400, 'Geçerli bir YouTube video bağlantısı girin.', 'INVALID_YOUTUBE_URL'); }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let videoId: string | null = null;
  if (host === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0] ?? null;
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') videoId = url.searchParams.get('v');
    else {
      const [kind, id] = url.pathname.split('/').filter(Boolean);
      if (kind && ['shorts', 'embed', 'live'].includes(kind)) videoId = id ?? null;
    }
  }
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) throw new ApiError(400, 'Desteklenen bir YouTube video bağlantısı girin.', 'INVALID_YOUTUBE_URL');
  return videoId;
}

export function formatYoutubeDuration(duration: string) {
  const match = /^P(?:([0-9]+)D)?T(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?$/.exec(duration);
  if (!match) return duration;
  const hours = Number(match[2] ?? 0) + Number(match[1] ?? 0) * 24;
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function normalizeVideo(item: z.infer<typeof videoItemSchema>): YoutubeVideoDetails {
  return {
    youtubeVideoId: item.id,
    youtubeUrl: `https://www.youtube.com/watch?v=${item.id}`,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnailUrl: bestThumbnail(item.snippet.thumbnails),
    duration: formatYoutubeDuration(item.contentDetails.duration),
    publishedAt: new Date(item.snippet.publishedAt),
    channelName: item.snippet.channelTitle,
    channelId: item.snippet.channelId,
  };
}

export async function getVideoDetailsBatch(videoIds: string[], apiKey = env.YOUTUBE_API_KEY) {
  const uniqueIds = [...new Set(videoIds)].slice(0, 50);
  if (!uniqueIds.length) return [];
  const response = await youtubeGet('videos', { part: 'snippet,contentDetails', id: uniqueIds.join(',') }, youtubeVideoResponseSchema, apiKey);
  return response.items.map(normalizeVideo);
}

export async function getVideoDetails(videoId: string, apiKey = env.YOUTUBE_API_KEY) {
  const [video] = await getVideoDetailsBatch([videoId], apiKey);
  if (!video) throw new ApiError(404, 'Video bulunamadı veya herkese açık değil.', 'YOUTUBE_VIDEO_NOT_FOUND');
  return video;
}

function parseChannelReference(input: string) {
  const value = input.trim();
  if (/^UC[A-Za-z0-9_-]{20,}$/.test(value)) return { channelId: value };
  if (/^@[A-Za-z0-9._-]+$/.test(value)) return { handle: value.slice(1) };
  let url: URL;
  try { url = new URL(value); } catch { throw new ApiError(400, 'Geçerli bir YouTube kanal bağlantısı girin.', 'INVALID_YOUTUBE_CHANNEL_URL'); }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== 'youtube.com' && host !== 'm.youtube.com') throw new ApiError(400, 'Geçerli bir YouTube kanal bağlantısı girin.', 'INVALID_YOUTUBE_CHANNEL_URL');
  const [kind, identifier] = url.pathname.split('/').filter(Boolean);
  if (kind === 'channel' && identifier) return { channelId: identifier };
  if (kind?.startsWith('@')) return { handle: kind.slice(1) };
  if (['c', 'user'].includes(kind ?? '') && identifier) return { search: identifier };
  throw new ApiError(400, 'Desteklenen bir YouTube kanal bağlantısı girin.', 'INVALID_YOUTUBE_CHANNEL_URL');
}

export async function getChannelInfo(input: string, apiKey = env.YOUTUBE_API_KEY): Promise<YoutubeChannelInfo> {
  const reference = parseChannelReference(input);
  let channelId = reference.channelId;
  if (!channelId && reference.search) {
    const search = await youtubeGet('search', { part: 'snippet', type: 'channel', maxResults: '1', q: reference.search }, youtubeSearchResponseSchema, apiKey);
    channelId = search.items[0]?.id.channelId;
  }
  if (!channelId && !reference.handle) throw new ApiError(404, 'YouTube kanalı bulunamadı veya herkese açık değil.', 'YOUTUBE_CHANNEL_NOT_FOUND');
  const lookup = channelId ? { id: channelId } : { forHandle: reference.handle! };
  const response = await youtubeGet('channels', { part: 'snippet,contentDetails', ...lookup }, youtubeChannelResponseSchema, apiKey);
  const channel = response.items[0];
  if (!channel) throw new ApiError(404, 'YouTube kanalı bulunamadı veya herkese açık değil.', 'YOUTUBE_CHANNEL_NOT_FOUND');
  return {
    channelId: channel.id,
    channelName: channel.snippet.title,
    channelUrl: `https://www.youtube.com/channel/${channel.id}`,
    avatarUrl: bestThumbnail(channel.snippet.thumbnails),
    uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads,
  };
}

export async function getUploadsFromPlaylist(playlistId: string, publishedAfter: Date | null, limit = 50, apiKey = env.YOUTUBE_API_KEY) {
  const videoIds: string[] = [];
  let pageToken: string | undefined;
  let reachedOlderVideo = false;
  do {
    const response = await youtubeGet('playlistItems', {
      part: 'contentDetails', playlistId, maxResults: String(Math.min(50, limit - videoIds.length)),
      ...(pageToken ? { pageToken } : {}),
    }, youtubePlaylistResponseSchema, apiKey);
    for (const item of response.items) {
      const publishedAt = item.contentDetails.videoPublishedAt ? new Date(item.contentDetails.videoPublishedAt) : null;
      if (publishedAfter && publishedAt && publishedAt <= publishedAfter) { reachedOlderVideo = true; break; }
      videoIds.push(item.contentDetails.videoId);
      if (videoIds.length >= limit) break;
    }
    pageToken = response.nextPageToken;
  } while (pageToken && videoIds.length < limit && !reachedOlderVideo);

  const videos: YoutubeVideoDetails[] = [];
  for (let index = 0; index < videoIds.length; index += 50) videos.push(...await getVideoDetailsBatch(videoIds.slice(index, index + 50), apiKey));
  return videos;
}

// Bu sistem yalnızca YouTube embed player kullanır; video dosyası indirilmez veya depolanmaz.
