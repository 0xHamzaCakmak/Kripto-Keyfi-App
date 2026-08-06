import express from 'express';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';

const CACHE_MS = 5 * 60 * 1000;
const SITEMAP_PAGE_SIZE = 45_000;
const HOP_BY_HOP_HEADERS = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);

export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
export const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const plainText = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const trimAtWord = (value, max) => {
  if (value.length <= max) return value;
  const sliced = value.slice(0, max + 1);
  const boundary = sliced.lastIndexOf(' ');
  return `${sliced.slice(0, boundary > max * 0.65 ? boundary : max).replace(/[\s,;:.!?-]+$/g, '')}…`;
};
export function articleSeoTitle(article) {
  const title = plainText(article.title);
  const category = plainText(article.category || 'Kripto');
  const candidates = [
    `${title} | ${category} | KriptoKeyfi`,
    `${title} | Güncel Kripto Haberi`,
    `${title} | KriptoKeyfi`,
    `${title} | Kripto`,
    `${title} | Haber`,
  ].filter((candidate) => candidate.length <= 60);
  if (candidates.length) return candidates.sort((left, right) => Math.abs(58 - left.length) - Math.abs(58 - right.length))[0];
  return trimAtWord(title, 59);
}
export function articleSeoDescription(article) {
  const source = article.source?.name ?? 'orijinal kaynak';
  const summary = plainText(article.excerpt || article.title);
  return trimAtWord(`KriptoKeyfi'nin ${source} kaynaklı haber özeti: ${summary} Gelişmenin kripto ve Web3 ekosistemine etkisini, temel ayrıntıları ve kaynak bağlantısını inceleyin.`, 158);
}
const slugify = (value = '') => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const categorySlug = (value) => {
  const text = slugify(value);
  if (/bitcoin|btc/.test(text)) return 'bitcoin';
  if (/ethereum|eth/.test(text)) return 'ethereum';
  if (/defi/.test(text)) return 'defi';
  if (/web3|blockchain/.test(text)) return 'web3';
  if (/borsa|exchange|binance|coinbase/.test(text)) return 'borsa-haberleri';
  if (/regulasyon|sec|cftc/.test(text)) return 'regulasyon';
  if (/guvenlik|hack|security/.test(text)) return 'guvenlik';
  if (/nft/.test(text)) return 'nft';
  if (/yapay-zeka|artificial-intelligence|ai/.test(text)) return 'yapay-zeka';
  return 'altcoin';
};
const absoluteUrl = (siteUrl, value) => value ? new URL(value, siteUrl).toString() : `${siteUrl}/pwa/icon-512.png`;
const xmlEscape = escapeHtml;

function metaTags({ title, description, canonical, image, type = 'website', robots = 'index,follow,max-image-preview:large', jsonLd = [] }) {
  return `<meta name="description" content="${escapeHtml(description)}" />
<meta name="robots" content="${escapeHtml(robots)}" />
<link rel="canonical" href="${escapeHtml(canonical)}" />
<meta property="og:locale" content="tr_TR" />
<meta property="og:site_name" content="KriptoKeyfi" />
<meta property="og:type" content="${type}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${escapeHtml(canonical)}" />
<meta property="og:image" content="${escapeHtml(image)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${escapeHtml(image)}" />
${jsonLd.map((value) => `<script${value['@type'] === 'NewsArticle' ? ' id="news-article-schema"' : value['@type'] === 'BreadcrumbList' ? ' id="news-breadcrumb-schema"' : ''} type="application/ld+json">${safeJson(value)}</script>`).join('\n')}`;
}

export function injectSeoHtml(template, { title, head, body }) {
  return template
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta\s+name="description"[^>]*>/i, '')
    .replace('</head>', `${head}\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}

function breadcrumbJson(siteUrl, article) {
  const category = categorySlug(article.category);
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Anasayfa', item: `${siteUrl}/` },
    { '@type': 'ListItem', position: 2, name: 'Haberler', item: `${siteUrl}/haberler` },
    { '@type': 'ListItem', position: 3, name: article.category ?? 'Kripto', item: `${siteUrl}/haberler/kategori/${category}` },
    { '@type': 'ListItem', position: 4, name: article.title, item: `${siteUrl}/haberler/${article.slug}` },
  ] };
}

export function renderArticlePage(template, siteUrl, detail) {
  const { article, related = [] } = detail;
  const canonical = `${siteUrl}/haberler/${encodeURIComponent(article.slug)}`;
  const title = articleSeoTitle(article);
  const description = articleSeoDescription(article);
  const image = absoluteUrl(siteUrl, article.coverImageUrl);
  const newsArticle = {
    '@context': 'https://schema.org', '@type': 'NewsArticle', headline: article.title, image: [image], datePublished: article.publishedAt,
    ...(article.sourceUpdatedAt ? { dateModified: article.sourceUpdatedAt } : {}),
    author: { '@type': article.authorName ? 'Person' : 'Organization', name: article.authorName ?? article.source?.name ?? 'KriptoKeyfi' },
    publisher: { '@type': 'Organization', name: 'KriptoKeyfi', logo: { '@type': 'ImageObject', url: `${siteUrl}/pwa/icon-512.png` } },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical }, isBasedOn: article.originalUrl,
  };
  const robots = article.aiSummary?.needsReview || article.archivedAt ? 'noindex,follow' : 'index,follow,max-image-preview:large';
  const body = `<main data-seo-render="article" class="mx-auto max-w-5xl p-6"><nav><a href="/">Anasayfa</a> › <a href="/haberler">Haberler</a> › <a href="/haberler/kategori/${categorySlug(article.category)}">${escapeHtml(article.category ?? 'Kripto')}</a></nav><article><img src="${escapeHtml(image)}" alt="${escapeHtml(article.coverImageAlt ?? article.title)}" width="1200" height="675" fetchpriority="high" decoding="async" /><h1>${escapeHtml(article.title)}</h1><p>${escapeHtml(article.excerpt ?? '')}</p><p>Kaynak: ${escapeHtml(article.source?.name ?? 'Orijinal kaynak')} · <time datetime="${escapeHtml(article.publishedAt)}">${escapeHtml(article.publishedAt)}</time></p></article>${related.length ? `<section><h2>İlgili haberler</h2><ul>${related.slice(0,4).map((item) => `<li><a href="/haberler/${encodeURIComponent(item.slug)}">${escapeHtml(item.title)}</a></li>`).join('')}</ul></section>` : ''}</main>`;
  return injectSeoHtml(template, { title, head: `${metaTags({ title, description, canonical, image, type: 'article', robots, jsonLd: [newsArticle, breadcrumbJson(siteUrl, article)] })}\n<link rel="preload" as="image" href="${escapeHtml(image)}" fetchpriority="high" />`, body });
}

function listingName(kind, slug) {
  if (!slug) return 'KriptoKeyfi Haber Merkezi';
  const label = slug.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toLocaleUpperCase('tr-TR'));
  return kind === 'tag' ? `#${label} Haberleri` : kind === 'topic' ? `${label} Konu Merkezi` : `${label} Haberleri`;
}
export function renderListingPage(template, siteUrl, { kind, slug, articles }) {
  const route = kind === 'root' ? '/haberler' : `/haberler/${kind === 'category' ? 'kategori' : kind === 'tag' ? 'etiket' : 'konu'}/${encodeURIComponent(slug)}`;
  const canonical = `${siteUrl}${route}`;
  const heading = listingName(kind, slug);
  const title = trimAtWord(`${heading} | KriptoKeyfi`, 60);
  const description = trimAtWord(`${heading}: güncel gelişmeler, kaynak gösterilen Türkçe özetler, piyasa bağlamı ve ilgili Web3 içerikleri KriptoKeyfi'nde.`, 158);
  const robots = articles.length >= 2 || kind === 'root' ? 'index,follow,max-image-preview:large' : 'noindex,follow';
  const heroImage = articles[0]?.coverImageUrl ? absoluteUrl(siteUrl, articles[0].coverImageUrl) : null;
  const body = `<main data-seo-render="listing" class="mx-auto max-w-6xl p-6"><nav><a href="/">Anasayfa</a> › <a href="/haberler">Haberler</a>${slug ? ` › ${escapeHtml(heading)}` : ''}</nav><h1>${escapeHtml(heading)}</h1><p>${escapeHtml(description)}</p>${heroImage ? `<img src="${escapeHtml(heroImage)}" alt="${escapeHtml(articles[0].coverImageAlt ?? articles[0].title)}" width="1200" height="675" fetchpriority="high" decoding="async" />` : ''}<section><h2>Güncel Haberler</h2>${articles.length ? `<ul>${articles.map((item) => `<li><article><h3><a href="/haberler/${encodeURIComponent(item.slug)}">${escapeHtml(item.title)}</a></h3><p>${escapeHtml(trimAtWord(plainText(item.excerpt ?? ''), 220))}</p></article></li>`).join('')}</ul>` : '<p>Bu başlıkta henüz yeterli yayımlanmış haber bulunmuyor.</p>'}</section></main>`;
  const collection = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: heading, url: canonical, mainEntity: articles.map((item, index) => ({ '@type': 'ListItem', position: index + 1, url: `${siteUrl}/haberler/${item.slug}`, name: item.title })) };
  return { html: injectSeoHtml(template, { title, head: `${metaTags({ title, description, canonical, image: `${siteUrl}/pwa/icon-512.png`, robots, jsonLd: [collection] })}${heroImage ? `\n<link rel="preload" as="image" href="${escapeHtml(heroImage)}" fetchpriority="high" />` : ''}`, body }), status: articles.length || kind === 'root' ? 200 : 404 };
}

async function fetchApi(apiBaseUrl, pathname, params = {}) {
  const url = new URL(`${apiBaseUrl.replace(/\/$/, '')}/${pathname.replace(/^\//, '')}`);
  Object.entries(params).forEach(([key, value]) => value != null && url.searchParams.set(key, String(value)));
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw Object.assign(new Error(`API ${response.status}`), { status: response.status });
  const payload = await response.json();
  return payload.data;
}

let newsCache = { expiresAt: 0, articles: [] };
async function fetchAllNews(apiBaseUrl) {
  if (newsCache.expiresAt > Date.now()) return newsCache.articles;
  const articles = [];
  let cursor;
  do {
    const data = await fetchApi(apiBaseUrl, 'news', { limit: 48, cursor });
    articles.push(...data.articles);
    cursor = data.nextCursor ?? undefined;
  } while (cursor && articles.length < 10_000);
  newsCache = { expiresAt: Date.now() + CACHE_MS, articles };
  return articles;
}

function sitemapUrlSet(urls) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(({ loc, lastmod }) => `<url><loc>${xmlEscape(loc)}</loc>${lastmod ? `<lastmod>${xmlEscape(lastmod)}</lastmod>` : ''}</url>`).join('')}</urlset>`;
}

export function createApiProxy(apiBaseUrl) {
  const backend = new URL(apiBaseUrl);
  const transport = backend.protocol === 'https:' ? https : http;
  return (req, res) => {
    const requestOrigin = req.headers.origin;
    if (requestOrigin) {
      try {
        if (new URL(requestOrigin).host !== req.get('host')) return res.status(403).json({ success: false, error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origin is not allowed' } });
      } catch { return res.status(403).json({ success: false, error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Origin is not allowed' } }); }
    }
    const headers = Object.fromEntries(Object.entries(req.headers).filter(([name, value]) => value !== undefined && !HOP_BY_HOP_HEADERS.has(name.toLowerCase()) && name.toLowerCase() !== 'origin'));
    headers.host = backend.host;
    headers['x-forwarded-host'] = req.get('host') ?? '';
    headers['x-forwarded-proto'] = req.protocol;
    headers['x-forwarded-for'] = [req.headers['x-forwarded-for'], req.socket.remoteAddress].filter(Boolean).join(', ');
    const target = new URL(req.originalUrl, backend.origin);
    const proxyRequest = transport.request(target, { method: req.method, headers }, (proxyResponse) => {
      const responseHeaders = Object.fromEntries(Object.entries(proxyResponse.headers).filter(([name, value]) => value !== undefined && !HOP_BY_HOP_HEADERS.has(name.toLowerCase())));
      res.writeHead(proxyResponse.statusCode ?? 502, responseHeaders);
      proxyResponse.pipe(res);
    });
    proxyRequest.on('error', (error) => {
      console.error('[api-proxy]', error.message);
      if (!res.headersSent) res.status(502).json({ success: false, error: { code: 'API_UNAVAILABLE', message: 'Oturum servisine erişilemedi.' } });
      else res.destroy(error);
    });
    req.on('aborted', () => proxyRequest.destroy());
    req.pipe(proxyRequest);
  };
}

export async function createSeoServer({ distDir, siteUrl = process.env.PUBLIC_SITE_URL || 'http://localhost:4173', apiBaseUrl = process.env.SEO_API_BASE_URL || 'http://127.0.0.1:4000/api' } = {}) {
  const normalizedSite = siteUrl.replace(/\/$/, '');
  const resolvedDist = distDir ?? path.resolve('dist');
  const template = await readFile(path.join(resolvedDist, 'index.html'), 'utf8');
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use('/api', createApiProxy(apiBaseUrl));

  app.get(['/blog', '/insights'], (_req, res) => res.redirect(301, '/haberler'));
  app.get('/blog/category/:slug', (req, res) => res.redirect(301, `/haberler/kategori/${encodeURIComponent(req.params.slug)}`));
  app.get('/blog/tag/:slug', (req, res) => res.redirect(301, `/haberler/etiket/${encodeURIComponent(req.params.slug)}`));
  app.get(['/blog/:slug', '/insights/:slug'], (req, res) => res.redirect(301, `/haberler/${encodeURIComponent(req.params.slug)}`));

  app.get('/robots.txt', (_req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\nAllow: /haberler\nDisallow: /api/\nDisallow: /admin/\nDisallow: /login\nDisallow: /register\nDisallow: /forgot-password\nDisallow: /onboarding\nDisallow: /connect-wallet\nDisallow: /profile\nDisallow: /identity\nDisallow: /settings/\nSitemap: ${normalizedSite}/sitemap.xml\n`));
  app.get('/sitemap.xml', async (_req, res, next) => { try { const articles = (await fetchAllNews(apiBaseUrl)).filter((item) => !item.archivedAt && !item.aiSummary?.needsReview); const pages = Math.max(1, Math.ceil(articles.length / SITEMAP_PAGE_SIZE)); const maps = Array.from({ length: pages }, (_, index) => `${normalizedSite}/sitemaps/news-${index + 1}.xml`).concat(`${normalizedSite}/sitemaps/taxonomy.xml`); res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${maps.map((loc) => `<sitemap><loc>${xmlEscape(loc)}</loc></sitemap>`).join('')}</sitemapindex>`); } catch (error) { next(error); } });
  app.get('/sitemaps/news-:page.xml', async (req, res, next) => { try { const page = Math.max(1, Number(req.params.page) || 1); const articles = (await fetchAllNews(apiBaseUrl)).filter((item) => !item.archivedAt && !item.aiSummary?.needsReview).slice((page - 1) * SITEMAP_PAGE_SIZE, page * SITEMAP_PAGE_SIZE); res.type('application/xml').send(sitemapUrlSet(articles.map((item) => ({ loc: `${normalizedSite}/haberler/${item.slug}`, lastmod: item.sourceUpdatedAt ?? item.publishedAt })))); } catch (error) { next(error); } });
  app.get('/sitemaps/taxonomy.xml', async (_req, res, next) => { try { const articles = (await fetchAllNews(apiBaseUrl)).filter((item) => !item.archivedAt && !item.aiSummary?.needsReview); const categoryCounts = new Map(); const tagCounts = new Map(); articles.forEach((item) => { const category = categorySlug(item.category); categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1); item.tags.forEach((tag) => tagCounts.set(tag.slug, (tagCounts.get(tag.slug) ?? 0) + 1)); }); const denseCategories = [...categoryCounts].filter(([,count]) => count >= 2).map(([slug]) => slug); const denseTags = [...tagCounts].filter(([,count]) => count >= 2).map(([slug]) => slug); const urls = [{ loc: `${normalizedSite}/haberler` }, ...denseCategories.map((slug) => ({ loc: `${normalizedSite}/haberler/kategori/${slug}` })), ...denseTags.flatMap((slug) => [{ loc: `${normalizedSite}/haberler/etiket/${slug}` }, { loc: `${normalizedSite}/haberler/konu/${slug}` }])]; res.type('application/xml').send(sitemapUrlSet(urls)); } catch (error) { next(error); } });

  const listingHandler = (kind) => async (req, res, next) => { try { const slug = req.params.slug; const params = kind === 'category' ? { category: slug } : kind === 'tag' ? { tag: slug } : kind === 'topic' ? { topic: slug } : {}; const data = await fetchApi(apiBaseUrl, 'news', { limit: 24, ...params }); const rendered = renderListingPage(template, normalizedSite, { kind, slug, articles: data.articles }); res.status(rendered.status).type('html').send(rendered.html); } catch (error) { next(error); } };
  app.get('/haberler', listingHandler('root'));
  app.get('/haberler/kategori/:slug', listingHandler('category'));
  app.get('/haberler/etiket/:slug', listingHandler('tag'));
  app.get('/haberler/konu/:slug', listingHandler('topic'));
  app.get('/haberler/:slug', async (req, res, next) => { try { const detail = await fetchApi(apiBaseUrl, `news/${encodeURIComponent(req.params.slug)}`, { trackView: false }); res.type('html').send(renderArticlePage(template, normalizedSite, detail)); } catch (error) { if (error.status === 404) return res.status(404).type('html').send(injectSeoHtml(template, { title: 'Haber bulunamadı | KriptoKeyfi', head: '<meta name="robots" content="noindex,follow" />', body: '<main><h1>Haber bulunamadı</h1><a href="/haberler">Haber merkezine dön</a></main>' })); next(error); } });

  app.use('/assets', express.static(path.join(resolvedDist, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(resolvedDist, { index: false, maxAge: '1h', setHeaders: (res, filePath) => { if (['sw.js', 'manifest.webmanifest'].includes(path.basename(filePath))) res.setHeader('Cache-Control', 'no-cache'); } }));
  app.get('*', (_req, res) => res.type('html').send(template));
  app.use((error, _req, res, _next) => { console.error('[seo-render]', error); res.status(502).type('text/plain').send('İçerik geçici olarak hazırlanamadı.'); });
  return app;
}
