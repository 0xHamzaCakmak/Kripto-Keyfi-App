import { createHash } from 'node:crypto';
import { NewsAiStatus, NewsPublicationStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { prisma } from '../../database/prisma.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import { presentNewsArticle } from './news.presenter.js';
import type { createNewsSourceBodySchema, listAdminNewsQuerySchema, listNewsQuerySchema, updateArticleContentBodySchema, updateArticleStatusBodySchema, updateNewsSourceBodySchema } from './news.schema.js';
import { localizeNewsArticle } from './news-localization.service.js';
import { cleanFeedText } from './news-localization.service.js';
import { createNewsLocalizationProvider } from './localization/news-localization-provider.factory.js';
import { evaluateNewsLocalization } from './localization/news-localization-quality.js';

const articleInclude = { source: { select: { name: true, slug: true, websiteUrl: true, logoUrl: true, attributionRequired: true } }, tags: { include: { tag: { select: { name: true, slug: true } } } }, coins: { select: { symbol: true, name: true } }, aiSummary: { select: { whyItMatters: true, marketImpact: true, watchOuts: true, confidence: true, needsReview: true, wordCount: true, generatedAt: true, qualityFlags: true, provider: true, model: true } } } satisfies Prisma.NewsArticleInclude;
export type NewsSourceInput = z.infer<typeof createNewsSourceBodySchema>;
type SourceUpdate = z.infer<typeof updateNewsSourceBodySchema>;
type NewsListQuery = z.infer<typeof listNewsQuerySchema>;
type AdminNewsListQuery = z.infer<typeof listAdminNewsQuerySchema>;
type ArticleStatusUpdate = z.infer<typeof updateArticleStatusBodySchema>;
type ArticleContentUpdate = z.infer<typeof updateArticleContentBodySchema>;
const withoutUndefined = <T extends object>(value: T) => Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

export async function listNews(query: NewsListQuery) {
  const and: Prisma.NewsArticleWhereInput[] = [];
  if (query.category) {
    const aliases: Record<string, string[]> = {
      bitcoin: ['bitcoin', 'btc'], ethereum: ['ethereum', 'eth'], altcoin: ['altcoin', 'solana', 'xrp', 'bnb'], defi: ['defi', 'decentralized finance'], web3: ['web3', 'blockchain'],
      'borsa-haberleri': ['borsa', 'binance', 'coinbase', 'exchange'], regulasyon: ['regülasyon', 'regulasyon', 'sec', 'cftc'], guvenlik: ['güvenlik', 'guvenlik', 'hack', 'saldırı'], analiz: ['analiz'], nft: ['nft'], 'yapay-zeka': ['yapay zeka', 'artificial intelligence'],
    };
    const terms = aliases[query.category] ?? [query.category.replaceAll('-', ' ')];
    and.push({ OR: terms.flatMap((term) => [{ category: { contains: term } }, { titleTr: { contains: term } }, { tags: { some: { tag: { name: { contains: term } } } } }]) });
  }
  if (query.topic) {
    const term = query.topic.replaceAll('-', ' ');
    and.push({ OR: [{ category: { contains: term } }, { titleTr: { contains: term } }, { summaryTr: { contains: term } }, { tags: { some: { tag: { slug: query.topic } } } }, { coins: { some: { symbol: query.topic.toUpperCase() } } }] });
  }
  if (query.q) and.push({ OR: [{ title: { contains: query.q } }, { excerpt: { contains: query.q } }, { titleTr: { contains: query.q } }, { summaryTr: { contains: query.q } }] });
  const where: Prisma.NewsArticleWhereInput = {
    status: NewsPublicationStatus.PUBLISHED,
    ...(query.tag ? { tags: { some: { tag: { slug: query.tag } } } } : {}),
    ...(query.coin ? { coins: { some: { symbol: query.coin } } } : {}),
    ...(and.length ? { AND: and } : {}),
  };
  const articles = await prisma.newsArticle.findMany({ where, include: articleInclude, orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }], take: query.limit + 1, ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}) });
  const hasMore = articles.length > query.limit;
  if (hasMore) articles.pop();
  return { articles: articles.map(presentNewsArticle), nextCursor: hasMore ? articles.at(-1)?.id ?? null : null };
}

export async function getNewsBySlug(slug: string, userId?: string, trackView = true) {
  const article = await prisma.newsArticle.findUnique({ where: { slug }, include: articleInclude });
  if (!article || (article.status !== NewsPublicationStatus.PUBLISHED && !article.archivedAt)) throw new ApiError(404, 'News article not found', 'NEWS_NOT_FOUND');
  if (trackView) await prisma.newsArticle.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } });
  const related = await prisma.newsArticle.findMany({ where: { id: { not: article.id }, status: NewsPublicationStatus.PUBLISHED, ...(article.storyKey ? { OR: [{ storyKey: article.storyKey }, ...(article.category ? [{ category: article.category }] : [])] } : article.category ? { category: article.category } : {}) }, include: articleInclude, orderBy: [{ storyKey: 'desc' }, { publishedAt: 'desc' }], take: 4 });
  const popular = await prisma.newsArticle.findMany({ where: { id: { not: article.id }, status: NewsPublicationStatus.PUBLISHED }, include: articleInclude, orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }], take: 5 });
  const saved = userId ? Boolean(await prisma.newsSavedArticle.findUnique({ where: { userId_articleId: { userId, articleId: article.id } } })) : false;
  return { article: presentNewsArticle(article), related: related.map(presentNewsArticle), popular: popular.map(presentNewsArticle), saved };
}

export async function saveArticle(userId: string, articleId: string) {
  const article = await prisma.newsArticle.findFirst({ where: { id: articleId, status: NewsPublicationStatus.PUBLISHED }, select: { id: true } });
  if (!article) throw new ApiError(404, 'News article not found', 'NEWS_NOT_FOUND');
  await prisma.newsSavedArticle.upsert({ where: { userId_articleId: { userId, articleId } }, create: { userId, articleId }, update: {} });
}

export async function unsaveArticle(userId: string, articleId: string) {
  await prisma.newsSavedArticle.deleteMany({ where: { userId, articleId } });
}

export async function listSources() { return prisma.newsSource.findMany({ orderBy: [{ priority: 'asc' }, { name: 'asc' }], select: { id: true, name: true, slug: true, websiteUrl: true, feedUrl: true, integrationType: true, language: true, category: true, logoUrl: true, isActive: true, isTrusted: true, autoPublish: true, aiEnabled: true, minimumManualReviews: true, commercialUseAllowed: true, excerptAllowed: true, imageUseAllowed: true, attributionRequired: true, termsUrl: true, lastTermsCheckedAt: true, lastFetchedAt: true, lastSuccessAt: true, lastError: true, failureCount: true, nextFetchAt: true, fetchIntervalMinutes: true, priority: true, createdAt: true, updatedAt: true } }); }
export async function createSource(input: NewsSourceInput) { return prisma.newsSource.create({ data: withoutUndefined(input) as Prisma.NewsSourceCreateInput }); }
export async function updateSource(id: string, input: SourceUpdate) { const current = await prisma.newsSource.findUnique({ where: { id } }); if (!current) throw new ApiError(404, 'News source not found', 'NEWS_SOURCE_NOT_FOUND'); const merged = { ...current, ...input }; const eligible = merged.isTrusted && merged.commercialUseAllowed && merged.excerptAllowed && Boolean(merged.lastTermsCheckedAt); if ((merged.isActive || merged.autoPublish) && !eligible) throw new ApiError(400, 'Active/auto-publish sources require verified commercial/excerpt permissions and terms review', 'SOURCE_PERMISSION_REQUIRED'); return prisma.newsSource.update({ where: { id }, data: withoutUndefined(input) as Prisma.NewsSourceUpdateInput }); }

export async function listAdminArticles(query: AdminNewsListQuery) {
  const articles = await prisma.newsArticle.findMany({ where: { ...(query.status ? { status: query.status } : { status: { notIn: [NewsPublicationStatus.REJECTED, NewsPublicationStatus.ARCHIVED] } }), ...(query.aiStatus ? { aiStatus: query.aiStatus } : {}) }, include: articleInclude, orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }], take: query.limit });
  return articles.map((article) => ({ ...presentNewsArticle(article), editorialReviewedAt: article.editorialReviewedAt?.toISOString() ?? null }));
}

export async function updateArticleContent(id: string, input: ArticleContentUpdate) {
  const article = await prisma.newsArticle.findUnique({ where: { id }, select: { id: true } });
  if (!article) throw new ApiError(404, 'News article not found', 'NEWS_NOT_FOUND');
  const tagNames = [...new Set(input.tags.map((name) => name.trim()).filter(Boolean))];
  await prisma.$transaction(async (transaction) => {
    await transaction.newsArticle.update({ where: { id }, data: { titleTr: input.titleTr, summaryTr: input.summaryTr, localizedAt: new Date(), localizationError: null, manualEditedAt: new Date(), aiStatus: NewsAiStatus.READY } });
    await transaction.newsAiSummary.upsert({ where: { articleId: id }, create: { article: { connect: { id } }, whyItMatters: input.whyItMatters, marketImpact: input.marketImpact, watchOuts: input.watchOuts, needsReview: false, qualityFlags: ['MANUALLY_EDITED'], provider: 'manual', model: null, generatedAt: new Date() }, update: { whyItMatters: input.whyItMatters, marketImpact: input.marketImpact, watchOuts: input.watchOuts, needsReview: false, qualityFlags: ['MANUALLY_EDITED'], provider: 'manual', model: null, generatedAt: new Date() } });
    await transaction.newsArticleTag.deleteMany({ where: { articleId: id } });
    for (const name of tagNames) { const tagSlug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100); if (!tagSlug) continue; const tag = await transaction.newsTag.upsert({ where: { slug: tagSlug }, create: { slug: tagSlug, name }, update: { name } }); await transaction.newsArticleTag.create({ data: { articleId: id, tagId: tag.id } }); }
  });
  const updated = await prisma.newsArticle.findUniqueOrThrow({ where: { id }, include: articleInclude });
  return { ...presentNewsArticle(updated), editorialReviewedAt: updated.editorialReviewedAt?.toISOString() ?? null };
}

export async function relocalizeArticle(id: string) {
  const exists = await prisma.newsArticle.findUnique({ where: { id }, select: { id: true, aiStatus: true } });
  if (!exists) throw new ApiError(404, 'News article not found', 'NEWS_NOT_FOUND');
  if (exists.aiStatus === NewsAiStatus.PROCESSING) throw new ApiError(409, 'Article is already being localized', 'NEWS_LOCALIZATION_IN_PROGRESS');
  const localized = await localizeNewsArticle(id, { force: true });
  const updated = await prisma.newsArticle.findUniqueOrThrow({ where: { id }, include: articleInclude });
  return { localized, article: { ...presentNewsArticle(updated), editorialReviewedAt: updated.editorialReviewedAt?.toISOString() ?? null } };
}

export async function createArticleAiDraft(id: string) {
  const article = await prisma.newsArticle.findUnique({
    where: { id },
    select: {
      title: true, excerpt: true, language: true, category: true, publishedAt: true,
      source: { select: { name: true } },
      tags: { select: { tag: { select: { name: true } } } },
    },
  });
  if (!article) throw new ApiError(404, 'News article not found', 'NEWS_NOT_FOUND');
  const provider = createNewsLocalizationProvider();
  if (!provider?.configured) throw new ApiError(503, 'AI news provider is not configured', 'NEWS_AI_UNAVAILABLE');
  const input = {
    title: cleanFeedText(article.title) ?? article.title,
    excerpt: cleanFeedText(article.excerpt),
    language: article.language,
    sourceName: article.source?.name ?? 'Bilinmeyen kaynak',
    category: article.category,
    publishedAt: article.publishedAt,
    existingTags: article.tags.map(({ tag }) => tag.name),
  };
  const localized = await provider.localize(input);
  const quality = evaluateNewsLocalization(input, localized);
  return {
    titleTr: quality.output.titleTr,
    summaryTr: quality.output.summaryTr,
    whyItMatters: quality.output.whyItMatters,
    marketImpact: quality.output.marketImpact,
    watchOuts: quality.output.watchOuts,
    tags: quality.output.tags,
    needsReview: quality.output.needsReview,
    qualityFlags: quality.flags,
    provider: quality.output.provider,
    model: quality.output.model,
  };
}

export async function updateArticleStatus(id: string, input: ArticleStatusUpdate) {
  const article = await prisma.newsArticle.findUnique({ where: { id }, select: { id: true, titleTr: true, summaryTr: true, aiSummary: { select: { articleId: true } } } });
  if (!article) throw new ApiError(404, 'News article not found', 'NEWS_NOT_FOUND');
  if (input.status === NewsPublicationStatus.PUBLISHED && (!article.titleTr || !article.summaryTr || !article.aiSummary)) throw new ApiError(409, 'Article must complete localization before editorial approval', 'NEWS_LOCALIZATION_REQUIRED');
  const reviewed = input.status === NewsPublicationStatus.PUBLISHED || input.status === NewsPublicationStatus.REJECTED || input.status === NewsPublicationStatus.ARCHIVED;
  const data: Prisma.NewsArticleUpdateInput = {
    ...withoutUndefined(input),
    ...(reviewed ? { editorialReviewedAt: new Date() } : {}),
    ...(input.status === NewsPublicationStatus.PUBLISHED ? { aiStatus: NewsAiStatus.READY, localizationError: null } : {}),
    ...(input.status === NewsPublicationStatus.ARCHIVED ? { archivedAt: new Date() } : input.status === NewsPublicationStatus.PUBLISHED ? { archivedAt: null } : {}),
  };
  const updated = await prisma.$transaction(async (transaction) => {
    await transaction.newsArticle.update({ where: { id }, data });
    if (input.status === NewsPublicationStatus.PUBLISHED) await transaction.newsAiSummary.updateMany({ where: { articleId: id }, data: { needsReview: false } });
    return transaction.newsArticle.findUniqueOrThrow({ where: { id }, include: articleInclude });
  });
  return { ...presentNewsArticle(updated), editorialReviewedAt: updated.editorialReviewedAt?.toISOString() ?? null };
}

export async function applyExternalRetention() {
  if (env.NEWS_EXTERNAL_RETENTION_LIMIT === 0) return 0;
  const removable = { isExternal: true, isFeatured: false, isEditorPick: false, isBreaking: false, savedBy: { none: {} } } satisfies Prisma.NewsArticleWhereInput;
  const expired = await prisma.newsArticle.findMany({ where: { ...removable, status: { not: NewsPublicationStatus.ARCHIVED } }, orderBy: { publishedAt: 'desc' }, skip: env.NEWS_EXTERNAL_RETENTION_LIMIT, select: { id: true } });
  if (!expired.length) return 0;
  const result = await prisma.newsArticle.updateMany({ where: { ...removable, id: { in: expired.map((article) => article.id) } }, data: { status: NewsPublicationStatus.ARCHIVED, archivedAt: new Date() } });
  return result.count;
}
export function titleFingerprint(title: string) { return createHash('sha256').update(title.normalize('NFKD').replace(/[^\w\s]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex'); }
