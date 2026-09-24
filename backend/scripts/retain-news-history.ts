import { prisma } from '../src/database/prisma.js';
import { deleteExpiredNews, NEWS_RETENTION_DAYS } from '../src/modules/news/news-retention.service.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply')) throw new Error('Usage: npm run retention:news -- [--apply]');
  const now = new Date();
  const cutoff = new Date(now.getTime() - NEWS_RETENTION_DAYS * 86_400_000);
  console.log({ cutoff, articles: await prisma.newsArticle.count({ where: { publishedAt: { lt: cutoff } } }) });
  if (args.includes('--apply')) console.log(await deleteExpiredNews(now));
  else console.log('Archive report only. News and images are retained permanently; --apply no longer deletes old news.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
