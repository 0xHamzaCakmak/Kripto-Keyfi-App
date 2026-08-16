import { VideoContentType, VideoStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), count: vi.fn(), transaction: vi.fn(), getVideoDetails: vi.fn(),
}));

vi.mock('../src/database/prisma.js', () => ({ prisma: {
  video: { findUnique: mocks.findUnique, update: mocks.update, findMany: mocks.findMany, count: mocks.count },
  youtubeChannel: { findMany: vi.fn() },
  $transaction: mocks.transaction,
} }));
vi.mock('../src/services/youtubeApi.js', () => ({
  getChannelInfo: vi.fn(), getUploadsFromPlaylist: vi.fn(), parseYoutubeVideoId: vi.fn(), getVideoDetails: mocks.getVideoDetails,
}));
vi.mock('../src/modules/videos/youtube-channel-assets.js', () => ({ cacheYoutubeChannelAvatar: vi.fn() }));

import { listPublishedVideos, refreshVideoMetadata, restoreVideo, softDeleteVideo, updateVideoStatus } from '../src/modules/videos/video.service.js';

describe('YouTube video moderation', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.transaction.mockImplementation((operations: Array<Promise<unknown>>) => Promise.all(operations)); });

  it('always excludes hidden and soft-deleted videos from the public query', async () => {
    mocks.findMany.mockResolvedValue([]); mocks.count.mockResolvedValue(0);
    await listPublishedVideos();
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: VideoStatus.PUBLISHED, deletedAt: null }) }));
  });

  it('soft deletes with the acting admin and can restore the same row', async () => {
    mocks.findUnique.mockResolvedValue({ id: 9, youtubeVideoId: 'dQw4w9WgXcQ' });
    mocks.update.mockResolvedValue({ id: 9 });
    await softDeleteVideo(9, 'admin-1');
    expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ where: { id: 9 }, data: expect.objectContaining({ deletedAt: expect.any(Date), deletedById: 'admin-1', moderatedById: 'admin-1' }) }));
    await restoreVideo(9, 'admin-2');
    expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ deletedAt: null, deletedById: null, moderatedById: 'admin-2' }) }));
  });

  it('toggles visibility and records the acting admin', async () => {
    mocks.findUnique.mockResolvedValue({ id: 9 }); mocks.update.mockResolvedValue({ id: 9 });
    await updateVideoStatus(9, 'hidden', 'admin-1');
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: VideoStatus.HIDDEN, moderatedById: 'admin-1' }) }));
  });

  it('refreshes original YouTube metadata without touching overrides', async () => {
    mocks.findUnique.mockResolvedValue({ id: 9, youtubeVideoId: 'dQw4w9WgXcQ', titleOverride: 'Platform başlığı' });
    mocks.getVideoDetails.mockResolvedValue({ youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ', channelName: 'Kanal', title: 'Yeni başlık', description: 'Yeni açıklama', thumbnailUrl: 'https://example.com/x.jpg', duration: '0:30', durationSeconds: 30, contentType: 'short', publishedAt: new Date() });
    mocks.update.mockResolvedValue({ id: 9 });
    await refreshVideoMetadata(9, 'admin-1');
    const data = mocks.update.mock.calls[0]![0].data;
    expect(data).toMatchObject({ title: 'Yeni başlık', contentType: VideoContentType.SHORT, moderatedById: 'admin-1' });
    expect(data).not.toHaveProperty('titleOverride');
    expect(data).not.toHaveProperty('descriptionOverride');
  });
});
