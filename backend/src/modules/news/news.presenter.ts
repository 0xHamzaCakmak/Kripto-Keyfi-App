import type { NewsArticle, NewsSource, Prisma } from '@prisma/client';

type Article = NewsArticle & {
  source: Pick<NewsSource, 'name' | 'slug' | 'websiteUrl' | 'logoUrl' | 'attributionRequired'> | null;
  tags: { tag: { name: string; slug: string } }[];
  coins: { symbol: string; name: string | null }[];
  aiSummary?: {
    whyItMatters: string | null;
    marketImpact: string | null;
    watchOuts: string | null;
    confidence: Prisma.Decimal | null;
    needsReview: boolean;
    wordCount: number | null;
    generatedAt: Date | null;
    qualityFlags: Prisma.JsonValue | null;
    provider: string | null;
    model: string | null;
  } | null;
};

export function presentNewsArticle(article: Article) {
  return {
    id: article.id,
    slug: article.slug,
    title: article.titleTr ?? article.title,
    excerpt: article.summaryTr ?? article.excerpt,
    originalTitle: article.title,
    isLocalized: Boolean(article.titleTr && article.summaryTr),
    localizationPending: !article.titleTr || !article.summaryTr,
    aiStatus: article.aiStatus,
    localizationError: article.localizationError,
    localizationAttempts: article.localizationAttempts,
    manualEditedAt: article.manualEditedAt?.toISOString() ?? null,
    coverImageUrl: article.coverImageUrl,
    coverImageAlt: article.coverImageAlt,
    category: article.category,
    authorName: article.authorName,
    language: article.language,
    publishedAt: article.publishedAt.toISOString(),
    sourceUpdatedAt: article.sourceUpdatedAt?.toISOString() ?? null,
    status: article.status,
    isBreaking: article.isBreaking,
    isFeatured: article.isFeatured,
    isEditorPick: article.isEditorPick,
    archivedAt: article.archivedAt?.toISOString() ?? null,
    readingTimeMinutes: article.readingTimeMinutes,
    viewCount: article.viewCount,
    source: article.source,
    tags: article.tags.map(({ tag }) => tag),
    coins: article.coins,
    aiSummary: article.aiSummary ? {
      whyItMatters: article.aiSummary.whyItMatters,
      marketImpact: article.aiSummary.marketImpact,
      watchOuts: article.aiSummary.watchOuts,
      confidence: article.aiSummary.confidence?.toNumber() ?? null,
      needsReview: article.aiSummary.needsReview,
      wordCount: article.aiSummary.wordCount,
      generatedAt: article.aiSummary.generatedAt?.toISOString() ?? null,
      qualityFlags: Array.isArray(article.aiSummary.qualityFlags) ? article.aiSummary.qualityFlags : [],
      provider: article.aiSummary.provider,
      model: article.aiSummary.model,
    } : null,
    originalUrl: article.originalUrl,
  };
}
