import { NewsAiStatus, NewsPublicationStatus } from '@prisma/client';
import { prisma } from '../../database/prisma.js';

const HEALTH_ID = 'primary';
const isRateLimit = (message: string) => /(?:\b429\b|rate.?limit|tokens? per day|\bTPD\b|daily (?:token )?limit)/i.test(message);

export async function markWorkerStarted() {
  await prisma.newsWorkerHealth.upsert({ where: { id: HEALTH_ID }, create: { id: HEALTH_ID, lastRunAt: new Date() }, update: { lastRunAt: new Date() } });
}
export async function markWorkerSucceeded() {
  const [pendingCount, processingCount] = await Promise.all([prisma.newsArticle.count({ where: { aiStatus: NewsAiStatus.WAITING } }), prisma.newsArticle.count({ where: { aiStatus: NewsAiStatus.PROCESSING } })]);
  await prisma.newsWorkerHealth.upsert({ where: { id: HEALTH_ID }, create: { id: HEALTH_ID, lastRunAt: new Date(), lastSuccessfulAt: new Date(), pendingCount, processingCount }, update: { lastSuccessfulAt: new Date(), pendingCount, processingCount, lastError: null } });
}
export async function markWorkerError(error: unknown) {
  const message = error instanceof Error ? error.message.slice(0, 500) : 'Bilinmeyen worker hatası';
  await prisma.newsWorkerHealth.upsert({ where: { id: HEALTH_ID }, create: { id: HEALTH_ID, lastRunAt: new Date(), errorCount: 1, rateLimitCount: isRateLimit(message) ? 1 : 0, lastError: message }, update: { errorCount: { increment: 1 }, ...(isRateLimit(message) ? { rateLimitCount: { increment: 1 } } : {}), lastError: message } });
}
export async function getNewsOperations() {
  const [health, counts, sourceErrors] = await Promise.all([
    prisma.newsWorkerHealth.findUnique({ where: { id: HEALTH_ID } }),
    prisma.newsArticle.groupBy({ by: ['aiStatus'], where: { status: { notIn: [NewsPublicationStatus.REJECTED, NewsPublicationStatus.ARCHIVED] } }, _count: { _all: true } }),
    prisma.newsSource.findMany({ where: { lastError: { not: null } }, select: { id: true, name: true, slug: true, lastError: true, failureCount: true, nextFetchAt: true }, orderBy: { failureCount: 'desc' }, take: 10 }),
  ]);
  const statuses = Object.fromEntries(Object.values(NewsAiStatus).map((status) => [status, counts.find((item) => item.aiStatus === status)?._count._all ?? 0]));
  return { health, statuses, sourceErrors, quota: { limited: Boolean(health?.lastError && isRateLimit(health.lastError)), message: health?.lastError && isRateLimit(health.lastError) ? 'Groq kotası veya hız sınırı devrede. Bekleyen haberler korunuyor ve sonraki worker turunda yeniden denenecek.' : null } };
}
