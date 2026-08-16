import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/utils/api-error.js';
import { formatYoutubeDuration, getVideoDetails, parseYoutubeVideoId } from '../src/services/youtubeApi.js';

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

  it('maps public video details without downloading video content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      items: [{
        id: 'dQw4w9WgXcQ',
        snippet: {
          title: 'Test video', description: 'Açıklama', channelTitle: 'Test Kanalı',
          publishedAt: '2026-08-16T09:00:00Z', thumbnails: { high: { url: 'https://i.ytimg.com/test.jpg' } },
        },
        contentDetails: { duration: 'PT18M42S' },
      }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getVideoDetails('dQw4w9WgXcQ', 'test-api-key');
    expect(result).toMatchObject({ title: 'Test video', channelName: 'Test Kanalı', duration: '18:42' });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toContain('part=snippet%2CcontentDetails');
  });
});
