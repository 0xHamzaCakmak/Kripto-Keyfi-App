import { createHash } from 'node:crypto';
import { NewsAiStatus, NewsPublicationStatus } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';
import { createNewsLocalizationProvider } from './localization/news-localization-provider.factory.js';
import { evaluateNewsLocalization } from './localization/news-localization-quality.js';
import type { NewsLocalizationInput, NewsLocalizationOutput } from './localization/news-localization-provider.js';
import { canAutoPublishLocalizedNews, isSourceEligibleForAutoPublish } from './news-editorial-policy.js';
import { markWorkerError } from './news-operations.service.js';
import { shouldSkipNewsLocalization } from './news-localization-idempotency.js';

const provider = createNewsLocalizationProvider();
const PROMPT_VERSION = 'news-editorial-v3';
const localizationRetryDelay = (attempts: number) => Math.min(6 * 60, 2 ** Math.min(Math.max(attempts, 1), 9));
const nextLocalizationAttempt = (attempts: number) => new Date(Date.now() + localizationRetryDelay(attempts) * 60_000);

const slugify = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'haber';
const repairMojibake = (value: string) => /(?:Ã.|Ä.|Å.|â€)/.test(value) ? Buffer.from(value, 'latin1').toString('utf8') : value;
export const cleanFeedText = (value: string | null) => value
  ? repairMojibake(value)
    .replace(/Devam(?:ı|i)\s*(?:nı)?\s*Oku\s*:?[^]*?(?:yazısı|yazisi)\s+ilk\s+önce[^]*$/i, '')
    .replace(/The post .*? appeared first on .*?\.?$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  : null;

async function runWithConcurrency<T, R>(items: T[], concurrency: number, task: (item: T) => Promise<R>) {
  const results: R[] = [];
  let index = 0;
  async function worker() {
    for (;;) {
      const current = index++;
      const item = items[current];
      if (item === undefined) return;
      results[current] = await task(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

export async function localizeNewsArticle(articleId: string, options: { force?: boolean } = {}) {
  const article = await prisma.newsArticle.findUnique({
    where: { id: articleId },
    select: {
      id: true, title: true, excerpt: true, language: true, category: true, publishedAt: true,
      titleTr: true, summaryTr: true, localizationAttempts: true, manualEditedAt: true, aiStatus: true,
      source: { select: { id: true, name: true, autoPublish: true, aiEnabled: true, minimumManualReviews: true, isActive: true, isTrusted: true, commercialUseAllowed: true, excerptAllowed: true, lastTermsCheckedAt: true } },
      tags: { select: { tag: { select: { name: true } } } },
      aiSummary: { select: { inputHash: true, needsReview: true } },
    },
  });
  if (!article) return false;

  const title = cleanFeedText(article.title) ?? article.title;
  const excerpt = cleanFeedText(article.excerpt);
  const input: NewsLocalizationInput = {
    title,
    excerpt,
    language: article.language,
    sourceName: article.source?.name ?? 'Bilinmeyen kaynak',
    category: article.category,
    publishedAt: article.publishedAt,
    existingTags: article.tags.map(({ tag }) => tag.name),
  };
  const inputHash = createHash('sha256').update(JSON.stringify({ ...input, publishedAt: input.publishedAt.toISOString(), promptVersion: PROMPT_VERSION })).digest('hex');
  if (shouldSkipNewsLocalization({ force: options.force === true, manualEditedAt: article.manualEditedAt, aiEnabled: article.source?.aiEnabled !== false, existingInputHash: article.aiSummary?.inputHash ?? null, inputHash, titleTr: article.titleTr, summaryTr: article.summaryTr, hasAiSummary: Boolean(article.aiSummary) })) return false;
  const lock = await prisma.newsArticle.updateMany({ where: { id: article.id, aiStatus: { not: NewsAiStatus.PROCESSING } }, data: { aiStatus: NewsAiStatus.PROCESSING, localizationStartedAt: new Date(), nextLocalizationAttemptAt: null } });
  if (!lock.count) return false;

  try {
    let localized: NewsLocalizationOutput;
    if (provider?.configured) {
      localized = await provider.localize(input);
    } else if (article.language.toLocaleLowerCase('tr-TR').startsWith('tr')) {
      localized = { titleTr: title, summaryTr: excerpt || title, whyItMatters: '', marketImpact: '', watchOuts: '', confidence: 1, needsReview: true, tags: input.existingTags, relatedCoins: [], provider: 'source', model: 'passthrough' };
    } else {
      throw new Error('Haber AI sağlayıcısı yapılandırılmamış');
    }

    const quality = evaluateNewsLocalization(input, localized);
    localized = quality.output;
    const localizedAt = new Date();
    const publishWhileRetrying = env.NEWS_AI_AUTO_PUBLISH_ENABLED && Boolean(article.source && isSourceEligibleForAutoPublish(article.source));
    const storedTitle = localized.needsReview ? (article.titleTr ?? title) : localized.titleTr;
    const storedSummary = localized.needsReview ? (article.summaryTr ?? excerpt ?? title) : localized.summaryTr;

    await prisma.$transaction(async (transaction) => {
      await transaction.newsArticle.update({
        where: { id: article.id },
        data: { title, excerpt, titleTr: storedTitle.slice(0, 500), summaryTr: storedSummary.slice(0, 2_000), localizedAt, localizationError: null, localizationAttempts: { increment: 1 }, aiStatus: localized.needsReview ? NewsAiStatus.REVIEW_REQUIRED : NewsAiStatus.READY, localizationStartedAt: null, nextLocalizationAttemptAt: localized.needsReview ? nextLocalizationAttempt(article.localizationAttempts + 1) : null, ...(publishWhileRetrying ? { status: NewsPublicationStatus.PUBLISHED } : {}), ...(options.force ? { manualEditedAt: null } : {}) },
      });

      const aiData = { whyItMatters: localized.needsReview ? '' : localized.whyItMatters, marketImpact: localized.needsReview ? '' : localized.marketImpact, watchOuts: localized.needsReview ? '' : localized.watchOuts, confidence: localized.confidence, needsReview: localized.needsReview, wordCount: quality.wordCount, qualityFlags: localized.needsReview ? [...quality.flags, 'SAFE_SOURCE_FALLBACK_PUBLISHED', 'BACKGROUND_RETRY_SCHEDULED'] : quality.flags, provider: localized.provider, model: localized.model, promptVersion: PROMPT_VERSION, inputHash, generatedAt: localizedAt };
      await transaction.newsAiSummary.upsert({ where: { articleId: article.id }, create: { article: { connect: { id: article.id } }, ...aiData }, update: aiData });

      if (localized.provider !== 'source') {
        for (const name of localized.tags) {
          const tagSlug = slugify(name);
          const tag = await transaction.newsTag.upsert({ where: { slug: tagSlug }, create: { slug: tagSlug, name: name.slice(0, 100) }, update: {} });
          await transaction.newsArticleTag.upsert({ where: { articleId_tagId: { articleId: article.id, tagId: tag.id } }, create: { articleId: article.id, tagId: tag.id }, update: {} });
        }
        if (localized.relatedCoins.length) await transaction.newsArticleCoin.createMany({ data: localized.relatedCoins.map((symbol) => ({ articleId: article.id, symbol })), skipDuplicates: true });
      }

      const approvedForeignReviews = article.source
        ? await transaction.newsArticle.count({
          where: {
            sourceId: article.source.id,
            status: NewsPublicationStatus.PUBLISHED,
            editorialReviewedAt: { not: null },
            NOT: { language: { startsWith: 'tr' } },
          },
        })
        : 0;
      if (env.NEWS_AI_AUTO_PUBLISH_ENABLED && canAutoPublishLocalizedNews({ source: article.source, language: article.language, needsReview: localized.needsReview, approvedForeignReviews })) {
        await transaction.newsArticle.update({ where: { id: article.id }, data: { status: NewsPublicationStatus.PUBLISHED } });
      }
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Bilinmeyen yerelleştirme hatası';
    const stillExists = await prisma.newsArticle.findUnique({ where: { id: article.id }, select: { id: true } });
    if (!stillExists) return false;
    const failed = await prisma.newsArticle.update({ where: { id: article.id }, data: { localizationError: message, localizationAttempts: { increment: 1 }, localizationStartedAt: null }, select: { localizationAttempts: true } });
    const fallbackTitle = cleanFeedText(article.title) ?? article.title;
    const fallbackSummary = cleanFeedText(article.excerpt) ?? fallbackTitle;
    const publishFallback = env.NEWS_AI_AUTO_PUBLISH_ENABLED && Boolean(article.source && isSourceEligibleForAutoPublish(article.source));
    await prisma.$transaction(async (transaction) => {
      await transaction.newsArticle.update({
        where: { id: article.id },
        data: {
          aiStatus: failed.localizationAttempts >= 5 ? NewsAiStatus.FAILED : NewsAiStatus.WAITING,
          nextLocalizationAttemptAt: nextLocalizationAttempt(failed.localizationAttempts),
          ...(!article.titleTr ? { titleTr: fallbackTitle.slice(0, 500) } : {}),
          ...(!article.summaryTr ? { summaryTr: fallbackSummary.slice(0, 2_000) } : {}),
          ...(!article.titleTr || !article.summaryTr ? { localizedAt: new Date() } : {}),
          ...(publishFallback ? { status: NewsPublicationStatus.PUBLISHED } : {}),
        },
      });
      if (!article.aiSummary) {
        await transaction.newsAiSummary.create({
          data: { article: { connect: { id: article.id } }, needsReview: true, qualityFlags: ['LOCALIZATION_FAILED', 'SOURCE_EXCERPT_FALLBACK', 'BACKGROUND_RETRY_SCHEDULED'], provider: provider?.name ?? 'disabled', promptVersion: PROMPT_VERSION },
        });
      }
    });
    await markWorkerError(error).catch(() => undefined);
    logger.warn({ articleId, provider: provider?.name ?? 'disabled', err: message }, 'news localization failed');
    return false;
  }
}

export async function runNewsLocalizationBatch(limit = env.NEWS_AI_BATCH_SIZE) {
  if (!env.NEWS_AI_ENABLED) return { processed: 0, localized: 0, skipped: true };
  const canUseAi = Boolean(provider?.configured);
  const now = new Date();
  await prisma.newsArticle.updateMany({
    where: { aiStatus: NewsAiStatus.PROCESSING, localizationStartedAt: { lt: new Date(now.valueOf() - 10 * 60_000) }, manualEditedAt: null },
    data: { aiStatus: NewsAiStatus.WAITING, localizationStartedAt: null, nextLocalizationAttemptAt: now, localizationError: 'Stale localization lock recovered; retry scheduled' },
  });
  const articles = await prisma.newsArticle.findMany({
    where: {
      status: { in: [NewsPublicationStatus.PENDING, NewsPublicationStatus.PUBLISHED] },
      aiStatus: { in: [NewsAiStatus.WAITING, NewsAiStatus.REVIEW_REQUIRED, NewsAiStatus.FAILED] },
      manualEditedAt: null,
      source: { is: { aiEnabled: true } },
      OR: [{ nextLocalizationAttemptAt: null }, { nextLocalizationAttemptAt: { lte: now } }],
      ...(!canUseAi ? { language: { startsWith: 'tr' } } : {}),
    },
    orderBy: [{ nextLocalizationAttemptAt: 'asc' }, { publishedAt: 'desc' }], take: limit, select: { id: true },
  });
  const results = await runWithConcurrency(articles, env.NEWS_AI_MAX_CONCURRENCY, ({ id }) => localizeNewsArticle(id, { force: true }));
  return { processed: articles.length, localized: results.filter(Boolean).length, skipped: false };
}
