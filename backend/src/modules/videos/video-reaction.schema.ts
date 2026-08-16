import { z } from 'zod';

export const videoReactionParamsSchema = z.object({ videoId: z.coerce.number().int().positive() });
export const videoReactionBodySchema = z.object({ reaction: z.enum(['like', 'dislike']) });
