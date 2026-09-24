import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ database: vi.fn(), image: vi.fn(), schedule: vi.fn() }));
vi.mock('../src/database/prisma.js', () => ({ prisma: new Proxy({}, { get() { mocks.database(); throw new Error('Age retention must not access news storage'); } }) }));
vi.mock('../src/storage/r2-image.js', () => ({ deleteImageByPublicUrl: mocks.image }));
vi.mock('../src/utils/daily-maintenance.js', () => ({ scheduleDailyMaintenance: mocks.schedule }));
import { deleteExpiredNews, scheduleNewsRetention } from '../src/modules/news/news-retention.service.js';
describe('permanent news archive', () => {
  it('legacy apply calls cannot delete articles, analytics or images', async () => {
    const result = await deleteExpiredNews(new Date('2026-09-24T00:00:00Z'));
    expect(result).toMatchObject({ deletedArticles: 0, deletedImages: 0, deletedOrphanTags: 0, policy: 'PRESERVE_NEWS_ARCHIVE' });
    expect(mocks.database).not.toHaveBeenCalled();
    expect(mocks.image).not.toHaveBeenCalled();
  });
  it('does not schedule destructive age maintenance', () => {
    const stop = scheduleNewsRetention(); stop();
    expect(mocks.schedule).not.toHaveBeenCalled();
  });
});
