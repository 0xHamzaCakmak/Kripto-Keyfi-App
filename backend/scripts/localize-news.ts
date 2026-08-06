import { prisma } from '../src/database/prisma.js';
import { env } from '../src/config/env.js';
import { runNewsLocalizationBatch } from '../src/modules/news/news-localization.service.js';

async function main() {
  let processed = 0;
  let localized = 0;

  for (;;) {
    const result = await runNewsLocalizationBatch(25);
    processed += result.processed;
    localized += result.localized;
    if (result.processed === 0 || result.localized === 0) break;
  }

  console.log(JSON.stringify({
    processed,
    localized,
    aiEnabled: env.NEWS_AI_ENABLED && env.NEWS_AI_PROVIDER !== 'disabled' && Boolean(env.GROQ_API_KEY),
    provider: env.NEWS_AI_PROVIDER,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
