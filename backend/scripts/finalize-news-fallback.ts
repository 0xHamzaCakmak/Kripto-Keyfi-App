import { createHash } from 'node:crypto';
import { NewsPublicationStatus } from '@prisma/client';
import { prisma } from '../src/database/prisma.js';

const articles = await prisma.newsArticle.findMany({
  where: { status: NewsPublicationStatus.PUBLISHED, OR: [{ titleTr: null }, { summaryTr: null }, { aiSummary: null }, { aiSummary: { is: { provider: 'local-fallback' } } }] },
  orderBy: { publishedAt: 'desc' },
  select: { id: true, slug: true, title: true, excerpt: true, titleTr: true, summaryTr: true, category: true, source: { select: { name: true } }, aiSummary: { select: { generatedAt: true, inputHash: true, model: true, promptVersion: true, provider: true } } },
});

let finalized = 0;
for (const article of articles) {
  if (article.aiSummary?.provider !== 'local-fallback' && article.aiSummary?.promptVersion === 'news-editorial-v3' && article.aiSummary.generatedAt && article.aiSummary.inputHash && article.aiSummary.model && article.titleTr && article.summaryTr) continue;
  const category = article.category ?? 'kripto ekosistemi';
  const source = article.source?.name ?? 'orijinal kaynak';
  const rawSummary = article.summaryTr ?? article.excerpt ?? article.title;
  const summary = rawSummary
    .replace(/\s*(?:Devamını|DevamÄ±nÄ±)\s+Oku\s*:.*$/isu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const whyItMatters = `Bu gelişme, ${category} gündemini takip eden kullanıcılar açısından yeni riskleri ve fırsatları değerlendirmek için önem taşıyor. Kaynak tarafından sağlanan ayrıntılar sınırlı olduğundan kesin sonuç çıkarmak yerine resmî açıklamalar ve sonraki gelişmeler birlikte izlenmelidir.`;
  const marketImpact = `Haberin piyasa üzerindeki etkisi, yeni veriler ve yatırımcı tepkisiyle netleşebilir. Tek bir açıklama kalıcı fiyat veya talep eğilimi anlamına gelmez; olası etkiler koşullu değerlendirilmelidir.`;
  const watchOuts = `${source} tarafından yayımlanacak güncellemeler, doğrulanmış teknik ayrıntılar ve ilgili varlıklardaki piyasa tepkisi takip edilmelidir.`;
  const inputHash = createHash('sha256').update(`${article.id}:local-fallback-v1`).digest('hex');
  const wordCount = `${summary} ${whyItMatters} ${marketImpact} ${watchOuts}`.split(/\s+/).filter(Boolean).length;
  await prisma.$transaction([
    prisma.newsArticle.update({ where: { id: article.id }, data: { titleTr: article.titleTr ?? article.title, summaryTr: summary.slice(0, 2_000), localizedAt: new Date(), localizationError: null } }),
    prisma.newsAiSummary.upsert({ where: { articleId: article.id }, create: { articleId: article.id, whyItMatters, marketImpact, watchOuts, confidence: 0.4, needsReview: true, wordCount, qualityFlags: ['AI_PROVIDER_UNAVAILABLE', 'MANUAL_REVIEW_REQUIRED'], provider: 'local-fallback', model: 'deterministic-v1', promptVersion: 'news-editorial-v3', inputHash, generatedAt: new Date() }, update: { whyItMatters, marketImpact, watchOuts, confidence: 0.4, needsReview: true, wordCount, qualityFlags: ['AI_PROVIDER_UNAVAILABLE', 'MANUAL_REVIEW_REQUIRED'], provider: 'local-fallback', model: 'deterministic-v1', promptVersion: 'news-editorial-v3', inputHash, generatedAt: new Date() } }),
  ]);
  finalized += 1;
  console.info(`fallback ${article.slug}`);
}

console.info(JSON.stringify({ finalized }, null, 2));
await prisma.$disconnect();
