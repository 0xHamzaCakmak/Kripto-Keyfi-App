import { env } from '../../../config/env.js';
import { GroqNewsLocalizationProvider } from './groq-news-localization-provider.js';
import type { NewsLocalizationProvider } from './news-localization-provider.js';

export function createNewsLocalizationProvider(): NewsLocalizationProvider | null {
  if (!env.NEWS_AI_ENABLED || env.NEWS_AI_PROVIDER === 'disabled') return null;
  return new GroqNewsLocalizationProvider({
    apiKey: env.GROQ_API_KEY,
    baseUrl: env.GROQ_API_BASE_URL,
    primaryModel: env.GROQ_PRIMARY_MODEL,
    fallbackModel: env.GROQ_FALLBACK_MODEL,
  });
}
