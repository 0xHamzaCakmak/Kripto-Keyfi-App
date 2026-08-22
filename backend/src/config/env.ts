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
  GOOGLE_CLIENT_ID: z.string().trim().default(''),
  TRADING_CREDENTIALS_MASTER_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/, 'must be a 32-byte hexadecimal key'),
  TRADING_ENGINE_SHADOW_COMPARE_ENABLED: booleanString.default('false'),
  TRADING_ENGINE_EXECUTION_ENABLED: booleanString.default('false'),
  AUTONOMOUS_TESTNET_EXECUTION_ENABLED: booleanString.default('false'),
  AI_TRADING_EVOLUTION_ENABLED: booleanString.default('true'),
  AI_TRADING_EVOLUTION_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(1440).default(5),
  AI_TRADING_EVOLUTION_MIN_TRADES: z.coerce.number().int().min(50).max(1_000_000).default(200),
  AI_TRADING_MAX_GENERATIONS: z.coerce.number().int().min(2).max(1000).default(20),
  AI_TRADING_UNIVERSE_ENABLED: booleanString.default('true'),
  AI_TRADING_UNIVERSE_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(1440).default(5),
  AI_TRADING_LEARNING_ENABLED: booleanString.default('true'),
  AI_TRADING_LEARNING_INTERVAL_MINUTES: z.coerce.number().int().min(5).max(1440).default(15),
  AI_TRADING_LEARNING_MIN_NEW_TRADES: z.coerce.number().int().min(10).max(100_000).default(100),
  TRADING_ENGINE_URL: z.string().url().default('http://127.0.0.1:8081'),
  TRADING_ENGINE_TOKEN: z.string().default(''),
  NEWS_AI_PROVIDER: z.enum(['multi', 'groq', 'deepseek', 'disabled']).default('multi'),
  NEWS_AI_PROVIDER_ORDER: z.string().trim().regex(/^(?:groq|deepseek)(?:,(?:groq|deepseek))*$/).default('groq,deepseek'),
  NEWS_AI_ENABLED: booleanString.default('true'),
  NEWS_AI_AUTO_PROCESS: booleanString.default('false'),
  NEWS_AI_AUTO_PUBLISH_ENABLED: booleanString.default('false'),
  NEWS_SYNC_ENABLED: booleanString.default('true'),
  NEWS_AI_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(2),
  NEWS_AI_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(24),
  NEWS_IMAGE_RETRY_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(12),
  NEWS_EXTERNAL_RETENTION_LIMIT: z.coerce.number().int().min(0).default(0),
  GROQ_API_KEY: z.string().trim().default(''),
  GROQ_API_BASE_URL: z.string().url().default('https://api.groq.com/openai/v1'),
  GROQ_PRIMARY_MODEL: z.string().trim().default('openai/gpt-oss-20b'),
  GROQ_FALLBACK_MODEL: z.string().trim().default('openai/gpt-oss-120b'),
  DEEPSEEK_API_KEY: z.string().trim().default(''),
  DEEPSEEK_API_BASE_URL: z.string().url().default('https://api.deepseek.com'),
  DEEPSEEK_MODEL: z.string().trim().default('deepseek-v4-flash'),
  R2_ACCOUNT_ID: z.string().trim().default(''),
  R2_ACCESS_KEY_ID: z.string().trim().default(''),
  R2_SECRET_ACCESS_KEY: z.string().trim().default(''),
  R2_BUCKET_NAME: z.string().trim().default(''),
  R2_PUBLIC_URL: z.union([z.literal(''), z.string().url()]).default(''),
  SORSA_API_KEY: z.string().trim().default(''),
  SORSA_API_BASE_URL: z.string().url().default('https://api.sorsa.io/v3'),
  X_API_BEARER_TOKEN: z.string().trim().default(''),
  X_API_BASE_URL: z.string().url().default('https://api.x.com/2'),
  OKX_ONCHAIN_API_KEY: z.string().trim().default(''),
  OKX_ONCHAIN_SECRET_KEY: z.string().trim().default(''),
  OKX_ONCHAIN_PASSPHRASE: z.string().trim().default(''),
  OKX_ONCHAIN_API_BASE_URL: z.string().url().default('https://web3.okx.com'),
  YOUTUBE_API_KEY: z.string().trim().default(''),
  YOUTUBE_SYNC_ENABLED: booleanString.default('true'),
  YOUTUBE_SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(15).max(1_440).default(45),
  YOUTUBE_INITIAL_SYNC_LIMIT: z.coerce.number().int().min(1).max(50).default(20),
  YOUTUBE_METRICS_ENABLED: booleanString.default('true'),
  YOUTUBE_METRICS_INTERVAL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  UMAMI_API_URL: z.union([z.literal(''), z.string().url()]).default(''),
  UMAMI_WEBSITE_ID: z.string().trim().default(''),
  UMAMI_USERNAME: z.string().trim().default(''),
  UMAMI_PASSWORD: z.string().default(''),
  GA4_DASHBOARD_URL: z.union([z.literal(''), z.string().url()]).default('https://analytics.google.com/analytics/web/'),
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && !value.COOKIE_SECURE) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['COOKIE_SECURE'], message: 'must be true in production' });
  }
  if (value.COOKIE_SAME_SITE === 'none' && !value.COOKIE_SECURE) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['COOKIE_SAME_SITE'], message: 'none requires COOKIE_SECURE=true' });
  }
  if ((value.TRADING_ENGINE_SHADOW_COMPARE_ENABLED || value.TRADING_ENGINE_EXECUTION_ENABLED || value.AUTONOMOUS_TESTNET_EXECUTION_ENABLED) && value.TRADING_ENGINE_TOKEN.length < 32) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['TRADING_ENGINE_TOKEN'], message: 'must contain at least 32 characters when shadow comparison is enabled' });
  }
  if (value.AUTONOMOUS_TESTNET_EXECUTION_ENABLED && !value.TRADING_ENGINE_EXECUTION_ENABLED) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['AUTONOMOUS_TESTNET_EXECUTION_ENABLED'], message: 'requires TRADING_ENGINE_EXECUTION_ENABLED=true' });
  }
  const r2Values = [value.R2_ACCOUNT_ID, value.R2_ACCESS_KEY_ID, value.R2_SECRET_ACCESS_KEY, value.R2_BUCKET_NAME, value.R2_PUBLIC_URL];
  const configuredR2Values = r2Values.filter(Boolean).length;
  if (configuredR2Values > 0 && configuredR2Values < r2Values.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['R2_ACCOUNT_ID'], message: 'all R2 variables must be configured together' });
  }
  if (value.NODE_ENV === 'production' && configuredR2Values !== r2Values.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['R2_ACCOUNT_ID'], message: 'R2 configuration is required in production' });
  }
  const okxValues = [value.OKX_ONCHAIN_API_KEY, value.OKX_ONCHAIN_SECRET_KEY, value.OKX_ONCHAIN_PASSPHRASE];
  const configuredOkxValues = okxValues.filter(Boolean).length;
  if (configuredOkxValues > 0 && configuredOkxValues < okxValues.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['OKX_ONCHAIN_API_KEY'], message: 'all OKX OnchainOS credentials must be configured together' });
  }
  const umamiValues = [value.UMAMI_API_URL, value.UMAMI_WEBSITE_ID, value.UMAMI_USERNAME, value.UMAMI_PASSWORD];
  const configuredUmamiValues = umamiValues.filter(Boolean).length;
  if (configuredUmamiValues > 0 && configuredUmamiValues < umamiValues.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['UMAMI_API_URL'], message: 'all Umami variables must be configured together' });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

export const env = parsed.data;
