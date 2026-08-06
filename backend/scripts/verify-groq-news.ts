import { prisma } from '../src/database/prisma.js';
import { createNewsLocalizationProvider } from '../src/modules/news/localization/news-localization-provider.factory.js';

async function main() {
  const provider = createNewsLocalizationProvider();
  if (!provider?.configured) throw new Error('GROQ_API_KEY backend/.env içinde yapılandırılmamış');

  const article = await prisma.newsArticle.findFirst({
    where: { language: { not: 'tr' }, excerpt: { not: null } },
    orderBy: { publishedAt: 'desc' },
    select: { title: true, excerpt: true, language: true, category: true, publishedAt: true, tags: { select: { tag: { select: { name: true } } } }, source: { select: { name: true } } },
  });
  if (!article) throw new Error('Test için yabancı dilde ve excerpt içeren haber bulunamadı');

  const result = await provider.localize({
    title: article.title,
    excerpt: article.excerpt,
    language: article.language,
    sourceName: article.source?.name ?? 'Bilinmeyen kaynak',
    category: article.category,
    publishedAt: article.publishedAt,
    existingTags: article.tags.map(({ tag }) => tag.name),
  });

  console.log(JSON.stringify({
    connection: 'ok',
    provider: result.provider,
    model: result.model,
    titleTr: result.titleTr,
    summaryTr: result.summaryTr,
    whyItMatters: result.whyItMatters,
    marketImpact: result.marketImpact,
    watchOuts: result.watchOuts,
    confidence: result.confidence,
    needsReview: result.needsReview,
    summaryWords: result.summaryTr.trim().split(/\s+/).length,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
