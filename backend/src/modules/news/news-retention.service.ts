import { prisma } from '../../database/prisma.js';
import { deleteImageByPublicUrl } from '../../storage/r2-image.js';
import { logger } from '../../utils/logger.js';

export const NEWS_RETENTION_DAYS = 7;
export const NEWS_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DELETE_BATCH_SIZE = 250;
const IMAGE_DELETE_CONCURRENCY = 10;

let retentionRunning = false;

export async function deleteExpiredNews(now = new Date()) {
  const cutoff = new Date(now.getTime() - NEWS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let deletedArticles = 0;
  let deletedImages = 0;

  while (true) {
    const expired = await prisma.newsArticle.findMany({
      where: { publishedAt: { lt: cutoff } },
      select: { id: true, coverImageUrl: true },
      orderBy: [{ publishedAt: 'asc' }, { id: 'asc' }],
      take: DELETE_BATCH_SIZE,
    });
    if (expired.length === 0) break;

    const ids = expired.map((article) => article.id);
    const deleted = await prisma.$transaction(async (transaction) => {
      // Analytics uses SET NULL by design for general reporting. Retention is
      // stricter: events tied to an expired article are removed with it.
      await transaction.newsAnalyticsEvent.deleteMany({ where: { articleId: { in: ids } } });
      return transaction.newsArticle.deleteMany({ where: { id: { in: ids }, publishedAt: { lt: cutoff } } });
    });
    deletedArticles += deleted.count;
    if (deleted.count === 0) break;

    // Delete media only after the database transaction succeeds. A temporary R2
    // failure may leave an orphaned object, but cannot break a retained article.
    for (let index = 0; index < expired.length; index += IMAGE_DELETE_CONCURRENCY) {
      const batch = expired.slice(index, index + IMAGE_DELETE_CONCURRENCY);
      const results = await Promise.allSettled(batch.map(async (article) => {
        if (!article.coverImageUrl) return false;
        return deleteImageByPublicUrl(article.coverImageUrl);
      }));
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) deletedImages += 1;
        if (result.status === 'rejected') logger.warn({ err: result.reason }, 'expired news R2 image could not be deleted');
      }
    }
  }

  const orphanTags = await prisma.newsTag.deleteMany({ where: { articles: { none: {} } } });
  return { cutoff, deletedArticles, deletedImages, deletedOrphanTags: orphanTags.count };
}

export function scheduleNewsRetention() {
  const execute = async () => {
    if (retentionRunning) return;
    retentionRunning = true;
    try {
      const result = await deleteExpiredNews();
      logger.info(result, 'daily news retention completed');
    } catch (error) {
      logger.error({ err: error }, 'daily news retention failed');
    } finally {
      retentionRunning = false;
    }
  };
  void execute();
  const timer = setInterval(() => { void execute(); }, NEWS_RETENTION_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
