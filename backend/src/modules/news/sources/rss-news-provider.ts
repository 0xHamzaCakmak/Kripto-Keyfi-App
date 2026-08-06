import type { NewsSource } from '@prisma/client';
import { ApiError } from '../../../utils/api-error.js';
import type { NewsProvider, NormalizedNewsItem } from './news-provider.js';

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const encodingArtifactScore = (value: string) =>
  (value.match(/\uFFFD/g)?.length ?? 0) * 20
  + (value.match(/(?:Ã.|Â.|â(?:€|™|œ|ž)|Ä.|Å.)/g)?.length ?? 0) * 5;

function decodeXmlBytes(bytes: Uint8Array, charset: string) {
  try {
    return new TextDecoder(charset, { fatal: false }).decode(bytes);
  } catch {
    return null;
  }
}

export async function decodeFeedResponse(response: Response) {
  const bytes = new Uint8Array(await response.arrayBuffer());
  const headerCharset = response.headers.get('content-type')?.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1];
  const prefix = new TextDecoder('latin1').decode(bytes.slice(0, 256));
  const xmlCharset = prefix.match(/<\?xml[^>]+encoding\s*=\s*["']([^"']+)["']/i)?.[1];
  const candidates = [...new Set([headerCharset, xmlCharset, 'utf-8', 'windows-1254', 'iso-8859-9'].filter((value): value is string => Boolean(value)))];
  const decoded = candidates
    .map((charset, priority) => ({ value: decodeXmlBytes(bytes, charset), priority }))
    .filter((item): item is { value: string; priority: number } => item.value !== null)
    .sort((left, right) => encodingArtifactScore(left.value) - encodingArtifactScore(right.value) || left.priority - right.priority);
  return decoded[0]?.value ?? new TextDecoder().decode(bytes);
}

export const decodeFeedText = (value: string) => value
  .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&apos;|&#39;|&rsquo;/gi, "'")
  .replace(/&ldquo;|&rdquo;/gi, '"').replace(/&hellip;/gi, '…').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
const text = (xml: string, tag: string) => { const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i')); return match?.[1] ? decodeFeedText(stripHtml(match[1].replace(/^<!\[CDATA\[|\]\]>$/g, ''))) : undefined; };
const attr = (xml: string, tag: string, name: string) => xml.match(new RegExp(`<${tag}[^>]*\\s${name}=["']([^"']+)["'][^>]*>`, 'i'))?.[1];
const rawTag = (xml: string, tag: string) => {
  const value = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'))?.[1];
  return value ? decodeFeedText(value.replace(/^<!\[CDATA\[|\]\]>$/g, '')) : undefined;
};
const normalizeImageUrl = (value: string | undefined, websiteUrl: string) => {
  if (!value) return undefined;
  try {
    const url = new URL(decodeFeedText(value), websiteUrl);
    if (url.protocol === 'http:') url.protocol = 'https:';
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

export class RssNewsProvider implements NewsProvider {
  async fetch(source: NewsSource): Promise<NormalizedNewsItem[]> {
    if (!source.feedUrl) throw new ApiError(400, 'RSS source has no feed URL', 'NEWS_SOURCE_INVALID');
    const response = await fetch(source.feedUrl, { headers: { accept: 'application/rss+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new ApiError(502, `Source returned HTTP ${response.status}`, 'NEWS_SOURCE_FETCH_FAILED');
    const xml = await decodeFeedResponse(response);
    const entries = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>|<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) ?? [];
    const items: NormalizedNewsItem[] = [];
    for (const entry of entries) {
      const originalUrl = text(entry, 'link') ?? attr(entry, 'link', 'href');
      const title = text(entry, 'title');
      if (!originalUrl || !title) continue;
      const date = text(entry, 'pubDate') ?? text(entry, 'published') ?? text(entry, 'updated');
      const publishedAt = date ? new Date(date) : new Date();
      const item: NormalizedNewsItem = { originalUrl, title, language: source.language, publishedAt: Number.isNaN(publishedAt.valueOf()) ? new Date() : publishedAt };
      const rawDescription = text(entry, 'description') ?? text(entry, 'summary') ?? text(entry, 'content');
      const rawHtml = rawTag(entry, 'content:encoded') ?? rawTag(entry, 'description') ?? rawTag(entry, 'content') ?? rawTag(entry, 'summary');
      const embeddedImage = rawHtml?.match(/<img[^>]+(?:data-src|data-lazy-src|src)=["']([^"']+)["']/i)?.[1]
        ?? rawHtml?.match(/<img[^>]+srcset=["']([^"',\s]+)/i)?.[1];
      const providerNewsId = text(entry, 'guid') ?? text(entry, 'id'); const excerpt = rawDescription; const coverImageUrl = normalizeImageUrl(attr(entry, 'media:content', 'url') ?? attr(entry, 'media:thumbnail', 'url') ?? attr(entry, 'enclosure', 'url') ?? embeddedImage, source.websiteUrl); const category = text(entry, 'category') ?? source.category ?? undefined; const authorName = text(entry, 'author') ?? text(entry, 'dc:creator');
      if (providerNewsId) item.providerNewsId = providerNewsId; if (excerpt) item.excerpt = excerpt; if (coverImageUrl) item.coverImageUrl = coverImageUrl; if (category) item.category = category; if (authorName) item.authorName = authorName;
      items.push(item);
    }
    const config = (source.apiConfig ?? {}) as { includeKeywords?: string[] };
    if (!config.includeKeywords?.length) return items;
    const keywords = config.includeKeywords.map((keyword) => keyword.toLocaleLowerCase('en-US'));
    return items.filter((item) => {
      const haystack = `${item.title} ${item.excerpt ?? ''}`.toLocaleLowerCase('en-US');
      return keywords.some((keyword) => haystack.includes(keyword));
    });
  }
}
