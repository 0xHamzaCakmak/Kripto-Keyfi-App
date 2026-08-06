import { prisma } from '../src/database/prisma.js';
import { ensureDefaultNewsCatalog } from '../src/modules/news/news.catalog.js';
import { runNewsSync } from '../src/modules/news/news.worker.js';

try {
  await ensureDefaultNewsCatalog();
  await runNewsSync();
  const [sourceCount, articleCount, sources] = await Promise.all([
    prisma.newsSource.count(),
    prisma.newsArticle.count(),
    prisma.newsSource.findMany({ select: { name: true, isActive: true, _count: { select: { articles: true } } }, orderBy: { priority: 'asc' } }),
  ]);
  console.info(`News bootstrap completed: ${sourceCount} sources, ${articleCount} articles.`);
  for (const source of sources) console.info(`- ${source.name}: ${source.isActive ? 'active' : 'passive'}, ${source._count.articles} articles`);
} finally {
  await prisma.$disconnect();
}
