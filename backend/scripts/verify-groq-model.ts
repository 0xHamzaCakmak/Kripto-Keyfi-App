import { env } from '../src/config/env.js';
import { GroqNewsLocalizationProvider } from '../src/modules/news/localization/groq-news-localization-provider.js';

async function main() {
  if (!env.GROQ_API_KEY) throw new Error('GROQ_API_KEY yapılandırılmamış');
  const provider = new GroqNewsLocalizationProvider({
    apiKey: env.GROQ_API_KEY,
    baseUrl: env.GROQ_API_BASE_URL,
    primaryModel: env.GROQ_PRIMARY_MODEL,
    fallbackModel: env.GROQ_FALLBACK_MODEL,
  });

  const result = await provider.localize({
    title: 'Example blockchain network publishes a fictional test update',
    excerpt: 'This is synthetic test data created only to verify the configured language model connection. It contains no database record, customer information, unpublished content, credential, financial advice, price claim, or real event.',
    sourceName: 'KriptoKeyfi Synthetic Smoke Test',
    language: 'en',
    category: 'Test',
    publishedAt: new Date('2026-08-15T00:00:00.000Z'),
    existingTags: ['Synthetic', 'Test'],
  });

  console.log(JSON.stringify({
    connection: 'ok',
    requestedPrimaryModel: env.GROQ_PRIMARY_MODEL,
    responseModel: result.model,
    provider: result.provider,
    schemaValidated: true,
    titleTr: result.titleTr,
    needsReview: result.needsReview,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
