import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../src/utils/api-error.js';
import { fetchXProfile, parseXProfileUrl } from '../src/modules/kol/providers/x-profile.provider.js';

afterEach(() => vi.unstubAllGlobals());

describe('X profile provider', () => {
  it('extracts a username and canonicalizes twitter.com profile URLs', () => {
    expect(parseXProfileUrl('https://twitter.com/Selcoin/')).toEqual({ username: 'Selcoin', profileUrl: 'https://x.com/Selcoin' });
  });

  it('rejects non-profile and non-X URLs', () => {
    expect(() => parseXProfileUrl('https://example.com/Selcoin')).toThrow(ApiError);
    expect(() => parseXProfileUrl('https://x.com/settings')).toThrow(ApiError);
  });

  it('normalizes the official X user lookup response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
      id: '123', name: 'Selcoin', username: 'Selcoin', description: 'Kripto içerikleri', location: 'Türkiye',
      profile_image_url: 'https://pbs.twimg.com/profile_images/example.jpg', created_at: '2010-05-10T10:00:00.000Z', verified: true, protected: false,
      public_metrics: { followers_count: 250000, following_count: 450, tweet_count: 12000, listed_count: 780 },
    } }), { status: 200, headers: { 'Content-Type': 'application/json' } })));

    const result = await fetchXProfile('x.com/Selcoin', { bearerToken: 'test-token', baseUrl: 'https://api.x.com/2' });
    expect(result).toMatchObject({ platformUserId: '123', username: 'Selcoin', followersCount: 250000, followingCount: 450, contentCount: 12000, verified: true });
    expect(fetch).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/2/users/by/username/Selcoin' }), expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-token' }) }));
  });
});
