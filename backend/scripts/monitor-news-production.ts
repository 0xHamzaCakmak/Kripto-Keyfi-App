import { NewsAiStatus } from '@prisma/client';
import { prisma } from '../src/database/prisma.js';

const durationMinutes = Math.max(0, Number(process.env.NEWS_MONITOR_DURATION_MINUTES ?? 0));
const intervalSeconds = Math.max(30, Number(process.env.NEWS_MONITOR_INTERVAL_SECONDS ?? 300));
const strict = process.env.NEWS_MONITOR_STRICT === 'true';
const deadline = Date.now() + durationMinutes * 60_000;
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function snapshot() {
  const [health, statuses, sourceFailures, published, events24h] = await Promise.all([
    prisma.newsWorkerHealth.findUnique({ where: { id: 'primary' } }),
    prisma.newsArticle.groupBy({ by: ['aiStatus'], _count: { _all: true } }),
    prisma.newsSource.count({ where: { isActive: true, lastError: { not: null } } }),
    prisma.newsArticle.count({ where: { status: 'PUBLISHED' } }),
    prisma.newsAnalyticsEvent.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1_000) } } }),
  ]);
  const counts = Object.fromEntries(Object.values(NewsAiStatus).map((status) => [status, statuses.find((item) => item.aiStatus === status)?._count._all ?? 0]));
  const lastSuccessAgeMinutes = health?.lastSuccessfulAt ? Math.round((Date.now() - health.lastSuccessfulAt.valueOf()) / 60_000) : null;
  const alerts = [
    ...(lastSuccessAgeMinutes == null || lastSuccessAgeMinutes > 15 ? ['WORKER_STALE'] : []),
    ...(sourceFailures > 0 ? ['SOURCE_FAILURES'] : []),
    ...((counts.FAILED ?? 0) > 0 ? ['AI_FAILURES'] : []),
    ...(health?.rateLimitCount ? ['RATE_LIMIT_OBSERVED'] : []),
  ];
  const result = { timestamp: new Date().toISOString(), lastSuccessAgeMinutes, sourceFailures, published, events24h, aiStatuses: counts, workerErrors: health?.errorCount ?? 0, rateLimits: health?.rateLimitCount ?? 0, alerts };
  console.info(JSON.stringify(result));
  if (strict && alerts.length) process.exitCode = 1;
}

do {
  await snapshot();
  if (Date.now() >= deadline) break;
  await wait(Math.min(intervalSeconds * 1_000, Math.max(0, deadline - Date.now())));
} while (Date.now() <= deadline);

await prisma.$disconnect();
