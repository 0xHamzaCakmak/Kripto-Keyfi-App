import { z } from 'zod';

export const userIdParamsSchema = z.object({ id: z.string().cuid() });

