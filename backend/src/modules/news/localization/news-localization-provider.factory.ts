import { env } from '../../../config/env.js';
import { FallbackNewsLocalizationProvider } from './fallback-news-localization-provider.js';
import { GroqNewsLocalizationProvider } from './groq-news-localization-provider.js';
import { DeepSeekNewsLocalizationProvider } from './openai-compatible-news-localization-provider.js';
import type { NewsLocalizationProvider } from './news-localization-provider.js';

export function createNewsLocalizationProvider(): NewsLocalizationProvider | null {
  if (!env.NEWS_AI_ENABLED || env.NEWS_AI_PROVIDER === 'disabled') return null;
  const providers = {
    groq: new GroqNewsLocalizationProvider({
    apiKey: env.GROQ_API_KEY,
    baseUrl: env.GROQ_API_BASE_URL,
    primaryModel: env.GROQ_PRIMARY_MODEL,
    fallbackModel: env.GROQ_FALLBACK_MODEL,
    }),
    deepseek: new DeepSeekNewsLocalizationProvider({
      apiKey: env.DEEPSEEK_API_KEY, baseUrl: env.DEEPSEEK_API_BASE_URL, model: env.DEEPSEEK_MODEL,
    }),
  } satisfies Record<'groq' | 'deepseek', NewsLocalizationProvider>;
  if (env.NEWS_AI_PROVIDER !== 'multi') return providers[env.NEWS_AI_PROVIDER];
  const ordered = env.NEWS_AI_PROVIDER_ORDER.split(',').map((name) => providers[name as keyof typeof providers]);
  return new FallbackNewsLocalizationProvider(ordered);
}
