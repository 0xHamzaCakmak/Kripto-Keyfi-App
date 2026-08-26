import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  deleteArticles: vi.fn(),
  deleteAnalytics: vi.fn(),
  deleteTags: vi.fn(),
  deleteImage: vi.fn(),
}));

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    newsArticle: { findMany: mocks.findMany },
    newsTag: { deleteMany: mocks.deleteTags },
    $transaction: vi.fn(async (callback: (transaction: unknown) => unknown) => callback({
      newsAnalyticsEvent: { deleteMany: mocks.deleteAnalytics },
      newsArticle: { deleteMany: mocks.deleteArticles },
    })),
  },
}));
vi.mock('../src/storage/r2-image.js', () => ({ deleteImageByPublicUrl: mocks.deleteImage }));

import { deleteExpiredNews } from '../src/modules/news/news-retention.service.js';

describe('news retention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValueOnce([
      { id: 'old-1', coverImageUrl: 'https://media.example.com/haberler/old-1.webp' },
      { id: 'old-2', coverImageUrl: null },
    ]).mockResolvedValueOnce([]);
    mocks.deleteImage.mockResolvedValue(true);
    mocks.deleteAnalytics.mockResolvedValue({ count: 2 });
    mocks.deleteArticles.mockResolvedValue({ count: 2 });
    mocks.deleteTags.mockResolvedValue({ count: 3 });
  });

  it('physically deletes news older than seven days and leaves YouTube untouched', async () => {
    const now = new Date('2026-08-26T12:00:00.000Z');
    const result = await deleteExpiredNews(now);

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { publishedAt: { lt: new Date('2026-08-19T12:00:00.000Z') } },
      take: 250,
    }));
    expect(mocks.deleteAnalytics).toHaveBeenCalledWith({ where: { articleId: { in: ['old-1', 'old-2'] } } });
    expect(mocks.deleteArticles).toHaveBeenCalledWith({ where: { id: { in: ['old-1', 'old-2'] }, publishedAt: { lt: new Date('2026-08-19T12:00:00.000Z') } } });
    expect(mocks.deleteImage).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ deletedArticles: 2, deletedImages: 1, deletedOrphanTags: 3 });
  });
});
