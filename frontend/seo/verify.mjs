import { pathToFileURL } from 'node:url';

export async function verifySeo(baseUrl, siteUrl, request = fetch) {
  const base = new URL(baseUrl);
  const canonical = new URL('/haberler', siteUrl).href;
  async function read(path) {
    const response = await request(new URL(path, base), { signal: AbortSignal.timeout(15_000), headers: { 'Cache-Control': 'no-cache' } });
    if (!response.ok) throw new Error(`SEO HTTP ${response.status}: ${path}`);
    if (response.headers.get('x-kriptokeyfi-renderer') !== 'seo') throw new Error(`SEO renderer missing: ${path}. Check Nginx location / -> 127.0.0.1:4173.`);
    return response.text();
  }
  const html = await read('/haberler');
  if (!html.includes(`rel="canonical" href="${canonical}"`) || !/<h1[\s>]/i.test(html) || !html.includes('CollectionPage')) {
    throw new Error('News HTML lacks canonical, heading or collection schema.');
  }
  const robots = await read('/robots.txt');
  if (!robots.includes(new URL('/sitemap.xml', siteUrl).href)) throw new Error('robots.txt sitemap origin mismatch');
  const index = await read('/sitemap.xml');
  if (!index.includes('<sitemapindex')) throw new Error('Invalid sitemap index');
  const news = await read('/sitemaps/news-1.xml');
  if (!news.includes('<urlset')) throw new Error('Invalid news sitemap');
  const articleUrl = news.match(/<loc>([^<]+)<\/loc>/)?.[1];
  if (articleUrl) {
    const url = new URL(articleUrl.replaceAll('&amp;', '&'));
    if (url.origin !== new URL(siteUrl).origin) throw new Error('Article sitemap origin mismatch');
    const article = await read(url.pathname);
    if (!article.includes('NewsArticle') || !/<h1[\s>]/i.test(article) || !article.includes(`rel="canonical" href="${url.href}"`)) throw new Error('Article HTML lacks heading, canonical or NewsArticle');
  }
  return { articleChecked: Boolean(articleUrl) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifySeo(process.argv[2], process.argv[3]).then(result => {
    console.log(`SEO HTML verified: ${process.argv[2]}; article checked: ${result.articleChecked}`);
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
