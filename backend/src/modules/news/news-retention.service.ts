// News URLs and their media are permanent. Age limits belong to feed queries,
// never to destructive retention. Keep these exports for existing maintenance callers.
export const NEWS_RETENTION_DAYS = 7;
export const NEWS_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

export async function deleteExpiredNews(now = new Date()) {
  return {
    cutoff: new Date(now.getTime() - NEWS_RETENTION_DAYS * 86_400_000),
    deletedArticles: 0, deletedImages: 0, deletedOrphanTags: 0,
    policy: 'PRESERVE_NEWS_ARCHIVE' as const,
  };
}

export function scheduleNewsRetention() {
  // No timer or daily-maintenance task: retained articles remain indexable.
  return () => {};
}
