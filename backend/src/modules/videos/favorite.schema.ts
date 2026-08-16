import { z } from 'zod';

export const favoriteChannelParamsSchema = z.object({ channelId: z.coerce.number().int().positive() });
