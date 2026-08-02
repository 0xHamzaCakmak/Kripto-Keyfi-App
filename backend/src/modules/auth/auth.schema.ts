import { z } from 'zod';

const normalizeUsername = (value: string) => value
  .trim()
  .toLocaleLowerCase('tr-TR')
  .replaceAll('ı', 'i')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9_]+/g, '_')
  .replace(/^_+|_+$/g, '');

export const loginBodySchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(1_024),
}).strict();

export const registerBodySchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  username: z.string().transform(normalizeUsername).pipe(
    z.string().regex(/^[a-z0-9_]{3,30}$/, 'Kullanıcı adı 3-30 karakter olmalı; harf, rakam ve alt çizgi kullanılabilir.'),
  ),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
  termsAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
}).strict().superRefine((value, context) => {
  if (value.password !== value.confirmPassword) context.addIssue({ code: z.ZodIssueCode.custom, path: ['confirmPassword'], message: 'Şifreler eşleşmiyor.' });
});

export const googleBodySchema = z.object({
  credential: z.string().min(100).max(10_000),
  termsAccepted: z.boolean().default(false),
  privacyAccepted: z.boolean().default(false),
}).strict();

export type LoginInput = z.infer<typeof loginBodySchema>;
export type RegisterInput = z.infer<typeof registerBodySchema>;
export type GoogleInput = z.infer<typeof googleBodySchema>;
