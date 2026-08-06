import { prisma } from '../src/database/prisma.js';
import { storyClusterKey } from '../src/modules/news/news-story-cluster.js';

const articles = await prisma.newsArticle.findMany({ where: { storyKey: null }, select: { id: true, title: true } });
let clustered = 0;
for (const article of articles) {
  const storyKey = storyClusterKey(article.title);
  if (!storyKey) continue;
  await prisma.newsArticle.update({ where: { id: article.id }, data: { storyKey } });
  clustered += 1;
}
const groups = await prisma.newsArticle.groupBy({ by: ['storyKey'], where: { storyKey: { not: null } }, _count: { _all: true } });
const multiArticleClusters = groups.filter((group) => group._count._all > 1).length;
const sampleKey = groups.find((group) => group._count._all > 1)?.storyKey;
const sample = sampleKey ? await prisma.newsArticle.findFirst({ where: { storyKey: sampleKey }, select: { slug: true } }) : null;
console.info(JSON.stringify({ scanned: articles.length, clustered, multiArticleClusters, sampleSlug: sample?.slug ?? null }, null, 2));
await prisma.$disconnect();
