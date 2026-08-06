import { NewsAiStatus, NewsAnalyticsEventType, NewsPublicationStatus, type Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import type { analyticsReportQuerySchema, newsAnalyticsEventBodySchema } from './news.schema.js';

type AnalyticsInput = z.infer<typeof newsAnalyticsEventBodySchema>;
type ReportQuery = z.infer<typeof analyticsReportQuerySchema>;

export async function recordNewsAnalytics(input: AnalyticsInput) {
  if (input.articleId) {
    const exists = await prisma.newsArticle.findUnique({ where: { id: input.articleId }, select: { id: true } });
    if (!exists) throw new ApiError(404, 'News article not found', 'NEWS_NOT_FOUND');
  }
  const data: Prisma.NewsAnalyticsEventUncheckedCreateInput = {
    type: input.type,
    ...(input.articleId ? { articleId: input.articleId } : {}),
    ...(input.sourceSlug ? { sourceSlug: input.sourceSlug } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.summaryWordCount !== undefined ? { summaryWordCount: input.summaryWordCount } : {}),
    ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
    ...(input.scrollDepth !== undefined ? { scrollDepth: input.scrollDepth } : {}),
    ...(input.targetArticleId ? { targetArticleId: input.targetArticleId } : {}),
    ...(input.metricName ? { metricName: input.metricName } : {}),
    ...(input.metricValue !== undefined ? { metricValue: input.metricValue } : {}),
    ...(input.pageType ? { pageType: input.pageType } : {}),
  };
  await prisma.newsAnalyticsEvent.create({ data });
  return { accepted: true };
}

const percentile = (values: number[], ratio: number) => {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ?? null;
};
const summaryBucket = (words: number | null) => words == null ? 'unknown' : words < 150 ? '<150' : words < 200 ? '150-199' : words < 250 ? '200-249' : '250+';

export async function getNewsAnalyticsReport(query: ReportQuery) {
  const since = new Date(Date.now() - query.days * 24 * 60 * 60 * 1_000);
  const events = await prisma.newsAnalyticsEvent.findMany({ where: { createdAt: { gte: since } }, select: { type: true, sourceSlug: true, summaryWordCount: true, durationMs: true, scrollDepth: true, metricName: true, metricValue: true } });
  const count = (type: NewsAnalyticsEventType) => events.filter((event) => event.type === type).length;
  const summaryViews = count(NewsAnalyticsEventType.NEWS_SUMMARY_VIEW);
  const sourceClicks = count(NewsAnalyticsEventType.NEWS_SOURCE_CLICK);
  const relatedClicks = count(NewsAnalyticsEventType.RELATED_NEWS_CLICK);
  const summaryEvents = events.filter((event) => event.type === NewsAnalyticsEventType.NEWS_SUMMARY_VIEW);
  const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  const lengthBuckets = new Map<string, { views: number; sourceClicks: number }>();
  for (const event of events.filter((item) => item.type === NewsAnalyticsEventType.NEWS_SUMMARY_VIEW || item.type === NewsAnalyticsEventType.NEWS_SOURCE_CLICK)) {
    const bucket = summaryBucket(event.summaryWordCount);
    const current = lengthBuckets.get(bucket) ?? { views: 0, sourceClicks: 0 };
    if (event.type === NewsAnalyticsEventType.NEWS_SUMMARY_VIEW) current.views += 1; else current.sourceClicks += 1;
    lengthBuckets.set(bucket, current);
  }
  const vitals = Object.fromEntries(['LCP', 'CLS', 'INP'].map((name) => [name, percentile(events.filter((event) => event.type === NewsAnalyticsEventType.WEB_VITAL && event.metricName === name).map((event) => event.metricValue?.toNumber() ?? 0), 0.75)]));
  const [published, technicallyIndexable, aiErrors] = await Promise.all([
    prisma.newsArticle.count({ where: { status: NewsPublicationStatus.PUBLISHED } }),
    prisma.newsArticle.count({ where: { status: NewsPublicationStatus.PUBLISHED, archivedAt: null, aiStatus: NewsAiStatus.READY } }),
    prisma.newsArticle.count({ where: { aiStatus: NewsAiStatus.FAILED } }),
  ]);
  return {
    periodDays: query.days,
    privacy: { provider: 'KriptoKeyfi first-party', storesUserId: false, storesIp: false, storesFullUrl: false, consentRequired: true },
    engagement: { summaryViews, sourceClicks, relatedClicks, categoryClicks: count(NewsAnalyticsEventType.CATEGORY_CLICK), averageReadMs: average(summaryEvents.map((event) => event.durationMs ?? 0).filter(Boolean)), averageScrollDepth: average(summaryEvents.map((event) => event.scrollDepth ?? 0).filter(Boolean)), sourceCtr: summaryViews ? Number((sourceClicks / summaryViews * 100).toFixed(2)) : 0, relatedCtr: summaryViews ? Number((relatedClicks / summaryViews * 100).toFixed(2)) : 0 },
    summaryLength: [...lengthBuckets].map(([bucket, value]) => ({ bucket, ...value, sourceCtr: value.views ? Number((value.sourceClicks / value.views * 100).toFixed(2)) : 0 })),
    webVitalsP75: vitals,
    quality: { published, technicallyIndexable, technicalIndexEligibilityRate: published ? Number((technicallyIndexable / published * 100).toFixed(2)) : 0, aiErrors },
  };
}
