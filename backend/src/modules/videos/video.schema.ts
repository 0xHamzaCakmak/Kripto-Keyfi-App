import { z } from 'zod';

export const listVideosQuerySchema = z.object({
  content_type: z.enum(['all', 'long', 'short']).optional(),
  type: z.enum(['all', 'long', 'short']).optional(),
  search: z.string().trim().max(120).optional().transform((value) => value || undefined),
  creator: z.string().trim().max(120).optional().transform((value) => value || undefined),
  channel_id: z.coerce.number().int().positive().optional(),
  favorites_only: z.enum(['true', 'false']).transform((value) => value === 'true').default('false'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

export const createVideoBodySchema = z.object({
  youtube_url: z.string().trim().min(1, 'YouTube bağlantısı zorunludur.').max(500),
});

export const adminVideoListQuerySchema = z.object({
  include_deleted: z.enum(['true', 'false']).transform((value) => value === 'true').default('false'),
});

export const videoParamsSchema = z.object({ videoId: z.coerce.number().int().positive() });
export const updateVideoStatusBodySchema = z.object({ status: z.enum(['published', 'hidden']) });

export const createYoutubeChannelBodySchema = z.object({
  channel_url: z.string().trim().min(1, 'YouTube kanal bağlantısı zorunludur.').max(500),
});

export const youtubeChannelParamsSchema = z.object({ channelId: z.coerce.number().int().positive() });
export const updateYoutubeChannelBodySchema = z.object({ status: z.enum(['active', 'paused']) });
