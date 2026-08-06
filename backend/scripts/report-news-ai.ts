import { NewsPublicationStatus } from '@prisma/client';
import { prisma } from '../src/database/prisma.js';

const total = await prisma.newsArticle.count({ where: { status: NewsPublicationStatus.PUBLISHED } });
const completed = await prisma.newsArticle.count({ where: { status: NewsPublicationStatus.PUBLISHED, titleTr: { not: null }, summaryTr: { not: null }, aiSummary: { is: { promptVersion: 'news-editorial-v3', generatedAt: { not: null }, inputHash: { not: null }, model: { not: null } } } } });
const review = await prisma.newsAiSummary.count({ where: { promptVersion: 'news-editorial-v3', needsReview: true } });
const failed = await prisma.newsArticle.count({ where: { status: NewsPublicationStatus.PUBLISHED, localizationError: { not: null } } });
const errorRows = await prisma.newsArticle.findMany({ where: { status: NewsPublicationStatus.PUBLISHED, localizationError: { not: null } }, select: { localizationError: true } });
const errors = Object.entries(errorRows.reduce<Record<string, number>>((counts, row) => { const key = row.localizationError?.slice(0, 180) ?? 'unknown'; counts[key] = (counts[key] ?? 0) + 1; return counts; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8);
const latest = await prisma.newsArticle.findFirst({ where: { status: NewsPublicationStatus.PUBLISHED }, orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }], select: { slug: true, title: true, titleTr: true, publishedAt: true, aiSummary: { select: { promptVersion: true } } } });
console.log(JSON.stringify({ total, completed, remaining: total - completed, review, failed, errors, latest }, null, 2));
await prisma.$disconnect();
