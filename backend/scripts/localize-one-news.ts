import { prisma } from '../src/database/prisma.js';
import { localizeNewsArticle } from '../src/modules/news/news-localization.service.js';

async function main() {
  const article = await prisma.newsArticle.findFirst({
    where: { language: { not: 'tr' }, OR: [{ titleTr: null }, { summaryTr: null }] },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, slug: true, title: true },
  });
  if (!article) throw new Error('İşlenecek yabancı haber bulunamadı');

  const localized = await localizeNewsArticle(article.id);
  const saved = await prisma.newsArticle.findUnique({
    where: { id: article.id },
    select: {
      slug: true,
      titleTr: true,
      summaryTr: true,
      localizationError: true,
      aiSummary: { select: { needsReview: true, confidence: true, wordCount: true, model: true } },
    },
  });
  console.log(JSON.stringify({ localized, originalTitle: article.title, ...saved }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
