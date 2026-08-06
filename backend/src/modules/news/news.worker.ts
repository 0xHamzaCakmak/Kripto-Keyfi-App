import { NewsPublicationStatus } from '@prisma/client';
import type { NewsIntegrationType, Prisma, NewsSource } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';
import { applyExternalRetention, titleFingerprint } from './news.service.js';
import { ApiNewsProvider } from './sources/api-news-provider.js';
import type { NewsProvider, NormalizedNewsItem } from './sources/news-provider.js';
import { RssNewsProvider } from './sources/rss-news-provider.js';
import { runNewsLocalizationBatch } from './news-localization.service.js';
import { storyClusterKey } from './news-story-cluster.js';
import { markWorkerError, markWorkerStarted, markWorkerSucceeded } from './news-operations.service.js';

const providers: Record<NewsIntegrationType, NewsProvider> = { RSS: new RssNewsProvider(), API: new ApiNewsProvider() };
const slugify = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 170) || 'haber';
async function uniqueSlug(title: string) { const base = slugify(title); for (let suffix = 1; suffix < 10_000; suffix += 1) { const candidate = suffix === 1 ? base : `${base}-${suffix}`; if (!await prisma.newsArticle.findUnique({ where: { slug: candidate }, select: { id: true } })) return candidate; } throw new Error('Unable to generate unique news slug'); }
function retryDelay(failures: number) { return Math.min(24 * 60, 5 * 2 ** Math.min(failures, 8)); }

async function ingest(source: NewsSource, item: NormalizedNewsItem) {
  const fingerprint = titleFingerprint(item.title);
  const duplicate = await prisma.newsArticle.findFirst({ where: { OR: [ ...(item.providerNewsId ? [{ AND: [{ sourceId: source.id }, { providerNewsId: item.providerNewsId }] }] : []), { originalUrl: item.originalUrl }, { titleFingerprint: fingerprint, sourceId: source.id } ] }, select: { id: true, coverImageUrl: true } });
  if (duplicate) {
    if (!duplicate.coverImageUrl && source.imageUseAllowed && item.coverImageUrl) await prisma.newsArticle.update({ where: { id: duplicate.id }, data: { coverImageUrl: item.coverImageUrl, ...(item.coverImageAlt ? { coverImageAlt: item.coverImageAlt } : {}) } });
    return;
  }
  const slug = await uniqueSlug(item.title);
  // Every external article enters the editorial pipeline first. Localization quality
  // and the source review threshold decide whether it can be auto-published.
  const data: Prisma.NewsArticleCreateInput = { source: { connect: { id: source.id } }, slug, originalUrl: item.originalUrl, title: item.title.slice(0, 500), language: item.language ?? source.language, publishedAt: item.publishedAt, status: NewsPublicationStatus.PENDING, titleFingerprint: fingerprint };
  const category = item.category ?? source.category;
  if (item.providerNewsId) data.providerNewsId = item.providerNewsId; if (item.canonicalUrl) data.canonicalUrl = item.canonicalUrl; if (source.excerptAllowed && item.excerpt) data.excerpt = item.excerpt.slice(0, 1_500); if (source.imageUseAllowed && item.coverImageUrl) data.coverImageUrl = item.coverImageUrl; if (source.imageUseAllowed && item.coverImageAlt) data.coverImageAlt = item.coverImageAlt; if (category) data.category = category; if (item.authorName) data.authorName = item.authorName; if (item.sourceUpdatedAt) data.sourceUpdatedAt = item.sourceUpdatedAt; const cluster = item.storyKey ?? storyClusterKey(item.title); if (cluster) data.storyKey = cluster; if (item.tags?.length) data.tags = { create: item.tags.slice(0, 8).map((name) => ({ tag: { connectOrCreate: { where: { slug: slugify(name) }, create: { name: name.slice(0, 100), slug: slugify(name) } } } })) }; if (item.coins?.length) data.coins = { create: item.coins.slice(0, 12).map((coin) => coin.name ? ({ symbol: coin.symbol.toUpperCase().slice(0, 30), name: coin.name.slice(0, 100) }) : ({ symbol: coin.symbol.toUpperCase().slice(0, 30) })) }; await prisma.newsArticle.create({ data });
}

async function syncSource(source: NewsSource) {
  try { const items = await providers[source.integrationType].fetch(source); for (const item of items) await ingest(source, item); const now = new Date(); await prisma.newsSource.update({ where: { id: source.id }, data: { lastFetchedAt: now, lastSuccessAt: now, lastError: null, failureCount: 0, nextFetchAt: new Date(now.valueOf() + source.fetchIntervalMinutes * 60_000) } }); }
  catch (error) { const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown source error'; const failures = source.failureCount + 1; await prisma.newsSource.update({ where: { id: source.id }, data: { lastFetchedAt: new Date(), lastError: message, failureCount: failures, nextFetchAt: new Date(Date.now() + retryDelay(failures) * 60_000) } }); logger.warn({ source: source.slug, err: message }, 'news source sync failed'); }
}

export async function runNewsSync() { await markWorkerStarted(); try { const now = new Date(); const sources = await prisma.newsSource.findMany({ where: { isActive: true, isTrusted: true, commercialUseAllowed: true, excerptAllowed: true, lastTermsCheckedAt: { not: null }, OR: [{ nextFetchAt: null }, { nextFetchAt: { lte: now } }] }, orderBy: [{ priority: 'asc' }, { nextFetchAt: 'asc' }] }); const sourceResults = await Promise.allSettled(sources.map(syncSource)); const rejected = sourceResults.find((result): result is PromiseRejectedResult => result.status === 'rejected'); if (rejected) await markWorkerError(rejected.reason); if (env.NEWS_AI_AUTO_PROCESS) await runNewsLocalizationBatch(); await applyExternalRetention(); await markWorkerSucceeded(); } catch (error) { await markWorkerError(error); throw error; } }
export function scheduleNewsSync() { const timer = setInterval(() => { void runNewsSync().catch((error) => logger.error({ err: error }, 'news sync scheduler failed')); }, 60_000); timer.unref(); void runNewsSync().catch((error) => logger.error({ err: error }, 'initial news sync failed')); return () => clearInterval(timer); }
