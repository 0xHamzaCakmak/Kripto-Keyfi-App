import { z } from 'zod';

export const adminUserListQuerySchema = z.object({
  search: z.string().trim().max(120).optional().transform((value) => value || undefined),
  status: z.enum(['active', 'pending', 'passive', 'suspended', 'deleted']).optional(),
  role: z.enum(['admin', 'user']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
