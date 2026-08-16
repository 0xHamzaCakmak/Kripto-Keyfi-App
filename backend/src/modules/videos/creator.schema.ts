import { z } from 'zod';

export const connectYoutubeChannelBodySchema = z.object({
  channel_url: z.string().trim().min(1, 'YouTube kanal bağlantısı zorunludur.').max(500),
});

export const creatorVideoBodySchema = z.object({
  youtube_url: z.string().trim().min(1, 'YouTube video bağlantısı zorunludur.').max(500),
});

export const creatorApplicationParamsSchema = z.object({ userId: z.string().trim().min(1).max(191) });
export const reviewCreatorApplicationBodySchema = z.object({ status: z.enum(['approved', 'rejected', 'suspended']) });
