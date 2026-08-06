import { prisma } from '../src/database/prisma.js';
import { ensureDefaultNewsCatalog } from '../src/modules/news/news.catalog.js';
import { runNewsSync } from '../src/modules/news/news.worker.js';
import { decodeFeedText } from '../src/modules/news/sources/rss-news-provider.js';

const activeSlugs = ['coin-turk', 'btc-haber', 'kripto-para-haber', 'coindesk'];
await ensureDefaultNewsCatalog();
await prisma.newsSource.updateMany({ where: { slug: { in: activeSlugs } }, data: { isActive: true, autoPublish: true, nextFetchAt: null } });
await prisma.newsSource.updateMany({ where: { slug: { in: ['ethereum-foundation', 'cftc', 'sec', 'cryptopanic'] } }, data: { isActive: false } });
await runNewsSync();
const imported = await prisma.newsArticle.findMany({ where: { source: { slug: { in: activeSlugs } } }, select: { id: true, title: true, excerpt: true, originalUrl: true, coverImageUrl: true } });
for (const article of imported) {
  const title = decodeFeedText(article.title); const excerpt = article.excerpt ? decodeFeedText(article.excerpt) : null;
  const originalUrl = decodeFeedText(article.originalUrl); const coverImageUrl = article.coverImageUrl ? decodeFeedText(article.coverImageUrl) : null;
  if (title !== article.title || excerpt !== article.excerpt || originalUrl !== article.originalUrl || coverImageUrl !== article.coverImageUrl) await prisma.newsArticle.update({ where: { id: article.id }, data: { title, excerpt, originalUrl, coverImageUrl } });
}
await prisma.newsSource.updateMany({ where: { slug: { in: activeSlugs } }, data: { failureCount: 0, lastError: null, nextFetchAt: null } });
const sources = await prisma.newsSource.findMany({ where: { slug: { in: activeSlugs } }, select: { name: true, isActive: true, _count: { select: { articles: true } } }, orderBy: { priority: 'asc' } });
for (const source of sources) console.info(`${source.name}: ${source.isActive ? 'active' : 'passive'}, ${source._count.articles} articles`);
await prisma.$disconnect();
