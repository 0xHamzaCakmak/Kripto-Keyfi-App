import { NewsPublicationStatus } from '@prisma/client';
import { prisma } from '../src/database/prisma.js';

const [users, tradingBots, published, pending, reviewedForeign, protectedArticles, missingImages, sources] = await Promise.all([
  prisma.user.count(),
  prisma.tradingBot.count(),
  prisma.newsArticle.count({ where: { status: NewsPublicationStatus.PUBLISHED } }),
  prisma.newsArticle.count({ where: { status: NewsPublicationStatus.PENDING } }),
  prisma.newsArticle.count({ where: { editorialReviewedAt: { not: null }, status: NewsPublicationStatus.PUBLISHED, NOT: { language: { startsWith: 'tr' } } } }),
  prisma.newsArticle.count({ where: { OR: [{ isExternal: false }, { isFeatured: true }, { isEditorPick: true }, { isBreaking: true }, { savedBy: { some: {} } }] } }),
  prisma.newsArticle.groupBy({ by: ['sourceId'], where: { status: NewsPublicationStatus.PUBLISHED, coverImageUrl: null }, _count: { _all: true } }),
  prisma.newsSource.findMany({ select: { id: true, slug: true, isActive: true, isTrusted: true, autoPublish: true, commercialUseAllowed: true, excerptAllowed: true, lastTermsCheckedAt: true } }),
]);

console.info(JSON.stringify({ users, tradingBots, published, pending, reviewedForeign, protectedArticles, missingImages: missingImages.map((group) => ({ source: sources.find((source) => source.id === group.sourceId)?.slug ?? group.sourceId, count: group._count._all })), sources }, null, 2));
await prisma.$disconnect();
