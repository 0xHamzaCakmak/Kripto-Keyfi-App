import { NewsIntegrationType } from '@prisma/client';
import { prisma } from '../src/database/prisma.js';
import { RssNewsProvider } from '../src/modules/news/sources/rss-news-provider.js';

const provider = new RssNewsProvider();
const sources = await prisma.newsSource.findMany({
  where: { isActive: true, imageUseAllowed: true, integrationType: NewsIntegrationType.RSS, feedUrl: { not: null } },
});

let scanned = 0;
let updated = 0;
const errors: { source: string; message: string }[] = [];

for (const source of sources) {
  try {
    const items = await provider.fetch(source);
    for (const item of items) {
      if (!item.coverImageUrl) continue;
      scanned += 1;
      const article = await prisma.newsArticle.findFirst({
        where: {
          sourceId: source.id,
          coverImageUrl: null,
          OR: [
            { originalUrl: item.originalUrl },
            ...(item.providerNewsId ? [{ providerNewsId: item.providerNewsId }] : []),
          ],
        },
        select: { id: true },
      });
      if (!article) continue;
      await prisma.newsArticle.update({ where: { id: article.id }, data: { coverImageUrl: item.coverImageUrl, coverImageAlt: item.coverImageAlt ?? item.title.slice(0, 500) } });
      updated += 1;
    }
  } catch (error) {
    errors.push({ source: source.slug, message: error instanceof Error ? error.message : 'Bilinmeyen hata' });
  }
}

console.info(JSON.stringify({ sources: sources.length, scanned, updated, errors }, null, 2));
await prisma.$disconnect();
