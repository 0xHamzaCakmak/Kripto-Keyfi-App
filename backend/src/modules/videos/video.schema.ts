import { z } from 'zod';

export const createVideoBodySchema = z.object({
  youtube_url: z.string().trim().min(1, 'YouTube bağlantısı zorunludur.').max(500),
});

export const createYoutubeChannelBodySchema = z.object({
  channel_url: z.string().trim().min(1, 'YouTube kanal bağlantısı zorunludur.').max(500),
});

export const youtubeChannelParamsSchema = z.object({ channelId: z.coerce.number().int().positive() });
export const updateYoutubeChannelBodySchema = z.object({ status: z.enum(['active', 'paused']) });
