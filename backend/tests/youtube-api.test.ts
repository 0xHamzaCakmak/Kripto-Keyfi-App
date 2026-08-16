import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/utils/api-error.js';
import { classifyYoutubeContent, formatYoutubeDuration, getChannelInfo, getChannelStatistics, getRecentVideosStats, getUploadsFromPlaylist, getVideoDetails, parseYoutubeVideoId, youtubeDurationToSeconds } from '../src/services/youtubeApi.js';

describe('YouTube video integration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=15', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('parses %s', (url, expected) => {
    expect(parseYoutubeVideoId(url)).toBe(expected);
  });

  it('rejects non-YouTube and malformed URLs', () => {
    expect(() => parseYoutubeVideoId('https://example.com/watch?v=dQw4w9WgXcQ')).toThrow(ApiError);
    expect(() => parseYoutubeVideoId('not-a-video')).toThrow(ApiError);
  });

  it.each([
    ['PT58S', '0:58'],
    ['PT18M42S', '18:42'],
    ['PT1H2M3S', '1:02:03'],
  ])('formats duration %s', (duration, expected) => {
    expect(formatYoutubeDuration(duration)).toBe(expected);
  });

  it.each([
    ['PT58S', new Date('2024-01-01T00:00:00Z'), 58, 'short'],
    ['PT2M30S', new Date('2025-01-01T00:00:00Z'), 150, 'short'],
    ['PT2M30S', new Date('2024-01-01T00:00:00Z'), 150, 'long'],
    ['PT18M42S', new Date('2026-01-01T00:00:00Z'), 1122, 'long'],
  ])('classifies %s published at %s', (duration, publishedAt, seconds, expected) => {
    expect(youtubeDurationToSeconds(duration)).toBe(seconds);
    expect(classifyYoutubeContent(seconds, publishedAt)).toBe(expected);
  });

  it('maps public video details without downloading video content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{
        id: 'dQw4w9WgXcQ',
        snippet: {
          title: 'Test video', description: 'Açıklama', channelId: 'UC_TEST', channelTitle: 'Test Kanalı',
          publishedAt: '2026-08-16T09:00:00Z', thumbnails: { high: { url: 'https://i.ytimg.com/test.jpg' } },
        },
        contentDetails: { duration: 'PT18M42S' },
      }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getVideoDetails('dQw4w9WgXcQ', 'test-api-key');
    expect(result).toMatchObject({ title: 'Test video', channelName: 'Test Kanalı', duration: '18:42', durationSeconds: 1122, contentType: 'long' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]![0])).toContain('part=snippet%2CcontentDetails');
  });

  it('resolves a channel handle with channels.list and stores its uploads playlist', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [{
      id: 'UC1234567890123456789012',
      snippet: { title: 'Creator Kanalı', customUrl: '@creator', thumbnails: { high: { url: 'https://yt.example/avatar.jpg' } } },
      contentDetails: { relatedPlaylists: { uploads: 'UU1234567890123456789012' } },
    }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const channel = await getChannelInfo('https://www.youtube.com/@creator', 'test-api-key');
    expect(channel).toMatchObject({ channelId: 'UC1234567890123456789012', uploadsPlaylistId: 'UU1234567890123456789012', channelName: 'Creator Kanalı' });
    expect(String(fetchMock.mock.calls[0]![0])).toContain('forHandle=creator');
  });

  it('uses the uploads playlist and batches video metadata requests', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [
        { contentDetails: { videoId: 'dQw4w9WgXcQ', videoPublishedAt: '2026-08-16T10:00:00Z' } },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{
        id: 'dQw4w9WgXcQ', snippet: { title: 'Yeni video', description: '', channelId: 'UC_CREATOR', channelTitle: 'Creator', publishedAt: '2026-08-16T10:00:00Z', thumbnails: {} }, contentDetails: { duration: 'PT5M4S' },
      }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const videos = await getUploadsFromPlaylist('UU123', new Date('2026-08-16T09:00:00Z'), 20, 'test-api-key');
    expect(videos).toHaveLength(1);
    expect(videos[0]).toMatchObject({ youtubeVideoId: 'dQw4w9WgXcQ', duration: '5:04' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('playlistItems');
    expect(String(fetchMock.mock.calls[1]![0])).toContain('videos');
  });

  it('reads channel totals from channels.list statistics', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [{
      id: 'UC_CREATOR', statistics: { subscriberCount: '12500', viewCount: '9876543210', videoCount: '84' },
    }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getChannelStatistics('UC_CREATOR', 'test-api-key');

    expect(result).toEqual({ subscriberCount: 12_500, totalViewCount: 9_876_543_210n, videoCount: 84 });
    expect(String(fetchMock.mock.calls[0]![0])).toContain('part=statistics');
    expect(String(fetchMock.mock.calls[0]![0])).toContain('id=UC_CREATOR');
  });

  it('loads recent video statistics in one batched videos.list request', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [
        { contentDetails: { videoId: 'video000001' } },
        { contentDetails: { videoId: 'video000002' } },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [
        { id: 'video000001', statistics: { viewCount: '1000', likeCount: '100', commentCount: '20' } },
        { id: 'video000002', statistics: { viewCount: '3000', likeCount: '300', commentCount: '40' } },
      ] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getRecentVideosStats('UU_CREATOR', 20, 'test-api-key');

    expect(result).toEqual({ avgViews: 2_000, avgLikes: 200, avgComments: 30, sampleSize: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]![0])).toContain('id=video000001%2Cvideo000002');
  });
});
