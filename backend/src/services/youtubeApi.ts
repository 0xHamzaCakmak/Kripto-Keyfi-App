import { z } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

const youtubeVideoResponseSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    snippet: z.object({
      title: z.string(),
      description: z.string().default(''),
      channelTitle: z.string().default('YouTube'),
      publishedAt: z.string(),
      thumbnails: z.record(z.object({ url: z.string().url() })).default({}),
    }),
    contentDetails: z.object({ duration: z.string() }),
  })),
});

export type YoutubeVideoDetails = {
  youtubeVideoId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  duration: string;
  publishedAt: Date;
  channelName: string;
};

export function parseYoutubeVideoId(input: string) {
  const value = input.trim();

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(400, 'Geçerli bir YouTube video bağlantısı girin.', 'INVALID_YOUTUBE_URL');
  }

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

  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    throw new ApiError(400, 'Desteklenen bir YouTube video bağlantısı girin.', 'INVALID_YOUTUBE_URL');
  }
  return videoId;
}

export function formatYoutubeDuration(duration: string) {
  const match = /^P(?:([0-9]+)D)?T(?:([0-9]+)H)?(?:([0-9]+)M)?(?:([0-9]+)S)?$/.exec(duration);
  if (!match) return duration;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0) + days * 24;
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export async function getVideoDetails(videoId: string, apiKey = env.YOUTUBE_API_KEY): Promise<YoutubeVideoDetails> {
  if (!apiKey) throw new ApiError(503, 'YouTube entegrasyonu henüz yapılandırılmadı.', 'YOUTUBE_NOT_CONFIGURED');

  const params = new URLSearchParams({ part: 'snippet,contentDetails', id: videoId, key: apiKey });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new ApiError(response.status === 403 ? 502 : 503, 'YouTube video bilgileri alınamadı. Lütfen daha sonra tekrar deneyin.', 'YOUTUBE_API_ERROR');
  }

  const parsed = youtubeVideoResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new ApiError(502, 'YouTube beklenmeyen bir yanıt döndürdü.', 'YOUTUBE_INVALID_RESPONSE');
  const item = parsed.data.items[0];
  if (!item) throw new ApiError(404, 'Video bulunamadı veya herkese açık değil.', 'YOUTUBE_VIDEO_NOT_FOUND');
  const thumbnails = item.snippet.thumbnails;

  return {
    youtubeVideoId: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnailUrl: thumbnails.maxres?.url ?? thumbnails.standard?.url ?? thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null,
    duration: formatYoutubeDuration(item.contentDetails.duration),
    publishedAt: new Date(item.snippet.publishedAt),
    channelName: item.snippet.channelTitle,
  };
}

// Bu sistem yalnızca YouTube embed player kullanır; video dosyası indirilmez veya depolanmaz.
