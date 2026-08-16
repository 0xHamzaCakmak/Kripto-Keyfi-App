import { z } from 'zod';

export const createVideoBodySchema = z.object({
  youtube_url: z.string().trim().min(1, 'YouTube bağlantısı zorunludur.').max(500),
});
