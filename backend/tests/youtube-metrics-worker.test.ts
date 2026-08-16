import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  channelFindMany: vi.fn(),
  videoCount: vi.fn(),
  snapshotUpsert: vi.fn(),
  getChannelStatistics: vi.fn(),
  getRecentVideosStats: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  calculateScores: vi.fn(),
}));

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    youtubeChannel: { findMany: mocks.channelFindMany },
    video: { count: mocks.videoCount },
    youtubeChannelMetricSnapshot: { upsert: mocks.snapshotUpsert },
  },
}));
vi.mock('../src/services/youtubeApi.js', () => ({
  getChannelStatistics: mocks.getChannelStatistics,
  getRecentVideosStats: mocks.getRecentVideosStats,
}));
vi.mock('../src/utils/logger.js', () => ({ logger: { warn: mocks.warn, info: mocks.info, error: mocks.error } }));
vi.mock('../src/modules/videos/youtube-score.service.js', () => ({ calculateYoutubeChannelScores: mocks.calculateScores }));

import { collectYoutubeChannelMetrics, runYoutubeMetricsCollection, utcDateOnly } from '../src/modules/videos/youtube-metrics.worker.js';

describe('YouTube metrics worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getChannelStatistics.mockResolvedValue({ subscriberCount: 12_500, totalViewCount: 9_876_543_210n, videoCount: 84 });
    mocks.getRecentVideosStats.mockResolvedValue({ avgViews: 2_000, avgLikes: 200, avgComments: 30, sampleSize: 20 });
    mocks.videoCount.mockResolvedValue(7);
    mocks.snapshotUpsert.mockImplementation(async ({ create }: { create: unknown }) => create);
    mocks.calculateScores.mockResolvedValue({ eligible: false, activeChannels: 2, calculated: 2, scores: [] });
  });

  it('upserts one UTC calendar-day snapshot with API and database metrics', async () => {
    const channel = { id: 4, channelId: 'UC_CREATOR', uploadsPlaylistId: 'UU_CREATOR' };
    const collectedAt = new Date('2026-08-16T23:45:00.000Z');

    await collectYoutubeChannelMetrics(channel, collectedAt);

    expect(mocks.getChannelStatistics).toHaveBeenCalledWith('UC_CREATOR');
    expect(mocks.getRecentVideosStats).toHaveBeenCalledWith('UU_CREATOR', 20);
    expect(mocks.videoCount).toHaveBeenCalledWith({ where: { channelId: 4, publishedAt: { gte: new Date('2026-05-18T23:45:00.000Z') } } });
    expect(mocks.snapshotUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { channelId_snapshotDate: { channelId: 4, snapshotDate: new Date('2026-08-16T00:00:00.000Z') } },
      create: expect.objectContaining({ subscriberCount: 12_500, totalViewCount: 9_876_543_210n, avgViewsRecent: 2_000, uploadsLast90Days: 7 }),
      update: expect.objectContaining({ subscriberCount: 12_500, avgLikesRecent: 200 }),
    }));
  });

  it('continues collecting other active channels after a channel failure', async () => {
    mocks.channelFindMany.mockResolvedValue([
      { id: 1, channelId: 'UC_FAILED', uploadsPlaylistId: 'UU_FAILED' },
      { id: 2, channelId: 'UC_HEALTHY', uploadsPlaylistId: 'UU_HEALTHY' },
    ]);
    mocks.getChannelStatistics.mockRejectedValueOnce(new Error('quota'));

    const result = await runYoutubeMetricsCollection(new Date('2026-08-16T10:00:00.000Z'));

    expect(result).toEqual({
      activeChannels: 2,
      collected: 1,
      failed: 1,
      scoring: { eligible: false, activeChannels: 2, calculated: 2, scores: [] },
    });
    expect(mocks.snapshotUpsert).toHaveBeenCalledOnce();
    expect(mocks.warn).toHaveBeenCalledOnce();
    expect(mocks.calculateScores).toHaveBeenCalledWith(new Date('2026-08-16T10:00:00.000Z'));
  });

  it('normalizes timestamps to a UTC date', () => {
    expect(utcDateOnly(new Date('2026-08-16T23:59:59.999Z'))).toEqual(new Date('2026-08-16T00:00:00.000Z'));
  });
});
