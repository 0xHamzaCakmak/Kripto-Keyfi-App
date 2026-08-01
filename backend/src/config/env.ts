import 'dotenv/config';
import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65_535),
  DATABASE_URL: z.string().url().refine((value) => value.startsWith('mysql://'), 'DATABASE_URL must use mysql://'),
  FRONTEND_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_MINUTES: z.coerce.number().int().positive().max(60),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().max(90),
  COOKIE_SECURE: booleanString,
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']),
  INITIAL_ADMIN_EMAIL: z.string().email(),
  INITIAL_ADMIN_PASSWORD: z.string().min(12),
  INITIAL_ADMIN_NAME: z.string().trim().min(1),
  TRADING_CREDENTIALS_MASTER_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/, 'must be a 32-byte hexadecimal key'),
  TRADING_ENGINE_SHADOW_COMPARE_ENABLED: booleanString.default('false'),
  TRADING_ENGINE_EXECUTION_ENABLED: booleanString.default('false'),
  TRADING_ENGINE_URL: z.string().url().default('http://127.0.0.1:8081'),
  TRADING_ENGINE_TOKEN: z.string().default(''),
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && !value.COOKIE_SECURE) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['COOKIE_SECURE'], message: 'must be true in production' });
  }
  if (value.COOKIE_SAME_SITE === 'none' && !value.COOKIE_SECURE) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['COOKIE_SAME_SITE'], message: 'none requires COOKIE_SECURE=true' });
  }
  if ((value.TRADING_ENGINE_SHADOW_COMPARE_ENABLED || value.TRADING_ENGINE_EXECUTION_ENABLED) && value.TRADING_ENGINE_TOKEN.length < 32) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['TRADING_ENGINE_TOKEN'], message: 'must contain at least 32 characters when shadow comparison is enabled' });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsed.data;
