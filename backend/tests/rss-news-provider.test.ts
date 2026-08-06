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

  it('decodes Turkish Windows-1254 feeds without replacement characters', async () => {
    const xml = '<?xml version="1.0" encoding="windows-1254"?><rss><channel><item><title>İçerik çözüldü</title><link>https://example.com/turkce</link><description>Türkçe özet doğru görünüyor.</description></item></channel></rss>';
    const windows1254: Record<string, number> = { 'İ': 0xdd, 'ı': 0xfd, 'ç': 0xe7, 'ö': 0xf6, 'ü': 0xfc, 'ğ': 0xf0, 'ş': 0xfe };
    const bytes = Buffer.from(Array.from(xml, (character) => windows1254[character] ?? character.charCodeAt(0)));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes, { status: 200, headers: { 'content-type': 'application/rss+xml; charset=windows-1254' } })));
    const source = { feedUrl: 'https://example.com/feed', websiteUrl: 'https://example.com', language: 'tr', category: 'kripto', apiConfig: null } as NewsSource;

    const [article] = await new RssNewsProvider().fetch(source);

    expect(article?.title).toBe('İçerik çözüldü');
    expect(article?.excerpt).toBe('Türkçe özet doğru görünüyor.');
    expect(`${article?.title} ${article?.excerpt}`).not.toContain('�');
  });
});
