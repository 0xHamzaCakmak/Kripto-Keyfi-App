import { NewsAnalyticsEventType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { newsAnalyticsEventBodySchema } from '../src/modules/news/news.schema.js';

const articleId = 'cm12345678901234567890123';

describe('news analytics privacy schema', () => {
  it('accepts the minimal anonymous summary engagement payload', () => {
    const result = newsAnalyticsEventBodySchema.safeParse({
      type: NewsAnalyticsEventType.NEWS_SUMMARY_VIEW,
      articleId,
      sourceSlug: 'coindesk',
      category: 'DOGECOIN (DOGE)',
      summaryWordCount: 212,
      durationMs: 18_000,
      scrollDepth: 62,
    });

    expect(result.success).toBe(true);
  });

  it('rejects URLs, user identifiers and arbitrary text', () => {
    const result = newsAnalyticsEventBodySchema.safeParse({
      type: NewsAnalyticsEventType.NEWS_SOURCE_CLICK,
      articleId,
      fullUrl: 'https://example.com/news?email=user@example.com',
      userId: 'user-1',
      query: 'private search',
    });

    expect(result.success).toBe(false);
  });

  it('requires a metric name and value for web vitals', () => {
    expect(newsAnalyticsEventBodySchema.safeParse({ type: NewsAnalyticsEventType.WEB_VITAL }).success).toBe(false);
    expect(newsAnalyticsEventBodySchema.safeParse({
      type: NewsAnalyticsEventType.WEB_VITAL,
      metricName: 'LCP',
      metricValue: 2350,
      pageType: 'news-detail',
    }).success).toBe(true);
  });
});
