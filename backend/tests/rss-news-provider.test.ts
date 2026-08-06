import type { NewsSource } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RssNewsProvider } from '../src/modules/news/sources/rss-news-provider.js';

afterEach(() => vi.unstubAllGlobals());

describe('RssNewsProvider images', () => {
  it('extracts an encoded article image from permitted RSS content', async () => {
    const xml = `<?xml version="1.0"?><rss><channel><item>
      <title>Test haberi</title><link>https://example.com/haber</link><pubDate>Thu, 06 Aug 2026 12:00:00 GMT</pubDate>
      <description>&lt;p&gt;Kısa özet&lt;/p&gt;&lt;img data-src="http://cdn.example.com/news.jpg" /&gt;</description>
    </item></channel></rss>`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(xml, { status: 200 })));
    const source = { feedUrl: 'https://example.com/feed', websiteUrl: 'https://example.com', language: 'tr', category: 'kripto', apiConfig: null } as NewsSource;

    const [article] = await new RssNewsProvider().fetch(source);

    expect(article?.coverImageUrl).toBe('https://cdn.example.com/news.jpg');
  });
});
