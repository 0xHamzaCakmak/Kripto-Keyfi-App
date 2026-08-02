import { z } from 'zod';

const reservedUsernames = new Set([
  'admin', 'administrator', 'support', 'kriptokeyfi', 'api', 'login', 'register', 'settings', 'security',
]);

const normalizeUsername = (value: string) => value
  .trim()
  .toLocaleLowerCase('tr-TR')
  .replaceAll('ı', 'i')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9_.]+/g, '_')
  .replace(/^[_.]+|[_.]+$/g, '');

const optionalUrl = z.preprocess(
  (value) => value === '' ? null : value,
  z.string().trim().url().max(500).refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Avatar adresi http veya https olmalıdır.').nullable().optional(),
);

export const updateMeBodySchema = z.object({
  displayName: z.string().trim().min(2, 'Görünen ad en az 2 karakter olmalıdır.').max(120).optional(),
  username: z.string().transform(normalizeUsername).pipe(
    z.string().regex(/^[a-z0-9_](?:[a-z0-9_.]{1,28}[a-z0-9_])$/, 'Kullanıcı adı 3-30 karakter olmalı; harf, rakam, nokta ve alt çizgi kullanılabilir.')
      .refine((value) => !reservedUsernames.has(value), 'Bu kullanıcı adı kullanılamaz.'),
  ).optional(),
  bio: z.string().trim().max(500, 'Biyografi en fazla 500 karakter olabilir.').nullable().optional(),
  avatarUrl: optionalUrl,
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'Güncellenecek en az bir alan gönderilmelidir.' });

export type UpdateMeInput = z.infer<typeof updateMeBodySchema>;
