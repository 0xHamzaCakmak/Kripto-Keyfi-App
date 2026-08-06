import { NewsAiStatus, NewsPublicationStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const transaction = {
  newsArticle: {
    update: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  newsAiSummary: {
    updateMany: vi.fn(),
  },
};

const prismaMock = {
  newsArticle: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(async (callback: (client: typeof transaction) => unknown) => callback(transaction)),
};
const providerLocalize = vi.fn();

vi.mock('../src/database/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../src/modules/news/news-localization.service.js', () => ({ localizeNewsArticle: vi.fn(), cleanFeedText: (value: string | null) => value }));
vi.mock('../src/modules/news/localization/news-localization-provider.factory.js', () => ({ createNewsLocalizationProvider: () => ({ configured: true, localize: providerLocalize }) }));

const { createArticleAiDraft, listAdminArticles, updateArticleStatus } = await import('../src/modules/news/news.service.js');

function articleFixture() {
  return {
    id: 'article-1',
    slug: 'test-haberi',
    title: 'Test news',
    titleTr: 'Test haberi',
    excerpt: 'Original excerpt',
    summaryTr: 'Türkçe haber özeti.',
    aiStatus: NewsAiStatus.READY,
    localizationError: null,
    localizationAttempts: 1,
    manualEditedAt: null,
    coverImageUrl: null,
    coverImageAlt: null,
    category: 'bitcoin',
    authorName: null,
    language: 'en',
    publishedAt: new Date('2026-08-07T10:00:00.000Z'),
    sourceUpdatedAt: null,
    status: NewsPublicationStatus.PUBLISHED,
    isBreaking: false,
    isFeatured: false,
    isEditorPick: false,
    archivedAt: null,
    readingTimeMinutes: 1,
    viewCount: 0,
    source: null,
    tags: [],
    coins: [],
    aiSummary: {
      whyItMatters: null,
      marketImpact: null,
      watchOuts: null,
      confidence: null,
      needsReview: false,
      wordCount: 30,
      generatedAt: new Date('2026-08-07T10:00:00.000Z'),
      qualityFlags: [],
      provider: 'groq',
      model: 'test-model',
    },
    originalUrl: 'https://example.com/test',
    editorialReviewedAt: new Date('2026-08-07T10:01:00.000Z'),
  };
}

describe('admin news editorial actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('turns Publish into an editorial approval and clears the review flag', async () => {
    prismaMock.newsArticle.findUnique.mockResolvedValue({
      id: 'article-1',
      titleTr: 'Test haberi',
      summaryTr: 'Türkçe haber özeti.',
      aiSummary: { articleId: 'article-1' },
    });
    transaction.newsArticle.findUniqueOrThrow.mockResolvedValue(articleFixture());

    const result = await updateArticleStatus('article-1', { status: NewsPublicationStatus.PUBLISHED });

    expect(transaction.newsArticle.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'article-1' },
      data: expect.objectContaining({ status: NewsPublicationStatus.PUBLISHED, aiStatus: NewsAiStatus.READY }),
    }));
    expect(transaction.newsAiSummary.updateMany).toHaveBeenCalledWith({
      where: { articleId: 'article-1' },
      data: { needsReview: false },
    });
    expect(result.aiStatus).toBe(NewsAiStatus.READY);
    expect(result.aiSummary?.needsReview).toBe(false);
  });

  it('hides rejected and archived records from the default operation queue', async () => {
    prismaMock.newsArticle.findMany.mockResolvedValue([]);

    await listAdminArticles({ limit: 50 });

    expect(prismaMock.newsArticle.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { notIn: [NewsPublicationStatus.REJECTED, NewsPublicationStatus.ARCHIVED] } },
    }));
  });

  it('creates an AI edit draft without mutating the article', async () => {
    prismaMock.newsArticle.findUnique.mockResolvedValue({
      title: 'Original title', excerpt: 'Original excerpt', language: 'en', category: 'web3',
      publishedAt: new Date('2026-08-07T10:00:00.000Z'), source: { name: 'Example' }, tags: [],
    });
    providerLocalize.mockResolvedValue({
      titleTr: 'Düzeltilmiş Türkçe başlık', summaryTr: 'Düzeltilmiş ve okunabilir Türkçe haber özeti burada yer alıyor.',
      whyItMatters: 'Bu gelişme ekosistemdeki kullanıcılar ve geliştiriciler açısından yeni seçenekler oluşturabileceği için önem taşıyor. Sonuçların doğrulanması için resmî açıklamalar izlenmelidir.',
      marketImpact: 'Haber, ilgili projelere yönelik ilgiyi kısa vadede etkileyebilir ancak kalıcı sonuçlar için yeni veriler gerekir.',
      watchOuts: 'Ürün takvimi, kullanım verileri ve resmî duyurular takip edilmelidir.', confidence: 0.9,
      needsReview: false, tags: ['Web3'], relatedCoins: [], provider: 'groq', model: 'test-model',
    });

    const draft = await createArticleAiDraft('article-1');

    expect(draft.titleTr).toBe('Düzeltilmiş Türkçe başlık');
    expect(transaction.newsArticle.update).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
