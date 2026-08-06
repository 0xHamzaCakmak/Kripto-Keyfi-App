import { NewsPublicationStatus } from '@prisma/client';
import { prisma } from '../src/database/prisma.js';
import { localizeNewsArticle } from '../src/modules/news/news-localization.service.js';

const delayMs = Math.max(1_000, Number(process.env.BACKFILL_DELAY_MS ?? 5_200));
const shardCount = Math.max(1, Number(process.env.BACKFILL_SHARD_COUNT ?? 1));
const shardIndex = Math.max(0, Number(process.env.BACKFILL_SHARD_INDEX ?? 0));
const limit = Math.min(100, Math.max(1, Number(process.env.BACKFILL_LIMIT ?? 20)));
const dryRun = process.env.BACKFILL_DRY_RUN !== 'false';
const includePublished = process.env.BACKFILL_INCLUDE_PUBLISHED === 'true';
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main() {
  const allArticles = await prisma.newsArticle.findMany({
    where: {
      status: includePublished ? { in: [NewsPublicationStatus.PENDING, NewsPublicationStatus.PUBLISHED] } : NewsPublicationStatus.PENDING,
      manualEditedAt: null,
      source: { is: { aiEnabled: true } },
    },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, slug: true, source: { select: { name: true } }, aiSummary: { select: { promptVersion: true, generatedAt: true, inputHash: true, model: true, provider: true } } },
  });
  const articles = allArticles
    .filter((article) => article.aiSummary?.provider === 'local-fallback' || !(article.aiSummary?.promptVersion === 'news-editorial-v3' && article.aiSummary.generatedAt && article.aiSummary.inputHash && article.aiSummary.model))
    .filter((_article, index) => index % shardCount === shardIndex)
    .slice(0, limit);

  if (dryRun) {
    console.info(JSON.stringify({ dryRun: true, includePublished, limit, candidates: articles.map((article) => ({ slug: article.slug, source: article.source?.name ?? null, currentProvider: article.aiSummary?.provider ?? null })) }, null, 2));
    return;
  }
  if (process.env.BACKFILL_CONFIRM !== 'I_UNDERSTAND') throw new Error('Gerçek backfill için BACKFILL_DRY_RUN=false ve BACKFILL_CONFIRM=I_UNDERSTAND birlikte gereklidir.');

  let localized = 0;
  let skipped = 0;
  for (const [index, article] of articles.entries()) {
    const success = await localizeNewsArticle(article.id, { force: true });
    if (success) localized += 1; else skipped += 1;
    console.info(`[${index + 1}/${articles.length}] ${success ? 'localized' : 'skipped'} ${article.source?.name ?? 'source'} / ${article.slug}`);
    if (index < articles.length - 1) await wait(delayMs);
  }

  const reviewCount = await prisma.newsAiSummary.count({ where: { needsReview: true } });
  console.info(JSON.stringify({ dryRun: false, shardIndex, shardCount, total: articles.length, localized, skipped, reviewCount }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
