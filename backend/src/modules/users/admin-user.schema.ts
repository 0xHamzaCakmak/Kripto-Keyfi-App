import { z } from 'zod';

export const adminUserListQuerySchema = z.object({
  search: z.string().trim().max(120).optional().transform((value) => value || undefined),
  status: z.enum(['active', 'pending', 'passive', 'suspended', 'deleted']).optional(),
  role: z.enum(['admin', 'user']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const normalizeUsername = (value: string) => value
  .trim()
  .toLocaleLowerCase('tr-TR')
  .replaceAll('ı', 'i')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9_]+/g, '_')
  .replace(/^_+|_+$/g, '');

export const createAdminUserBodySchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  username: z.string().transform(normalizeUsername).pipe(
    z.string().regex(/^[a-z0-9_]{3,30}$/, 'Kullanıcı adı 3-30 karakter olmalı; harf, rakam ve alt çizgi kullanılabilir.'),
  ),
  display_name: z.string().trim().min(2).max(120),
  password: z.string().min(8, 'Geçici şifre en az 8 karakter olmalıdır.').max(128),
  role: z.enum(['admin', 'user']),
}).strict();

export const adminUserParamsSchema = z.object({
  id: z.string().trim().min(1).max(191),
});

export const updateAdminUserBodySchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
  username: z.string().transform(normalizeUsername).pipe(
    z.string().regex(/^[a-z0-9_]{3,30}$/, 'Kullanıcı adı 3-30 karakter olmalı; harf, rakam ve alt çizgi kullanılabilir.'),
  ).optional(),
  display_name: z.string().trim().min(2).max(120).optional(),
  role: z.enum(['admin', 'user']).optional(),
  status: z.enum(['active', 'pending', 'passive', 'suspended']).optional(),
  notes: z.string().trim().max(5_000).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'En az bir alan değiştirilmelidir.');

export const resetAdminUserPasswordBodySchema = z.object({
  new_password: z.string().min(8, 'Yeni şifre en az 8 karakter olmalıdır.').max(128),
}).strict();

export type AdminUserListQuery = z.infer<typeof adminUserListQuerySchema>;
export type CreateAdminUserInput = z.infer<typeof createAdminUserBodySchema>;
export type UpdateAdminUserInput = z.infer<typeof updateAdminUserBodySchema>;
export type ResetAdminUserPasswordInput = z.infer<typeof resetAdminUserPasswordBodySchema>;
