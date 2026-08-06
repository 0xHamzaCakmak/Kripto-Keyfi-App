import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { articleSeoDescription, articleSeoTitle, createApiProxy, createSeoServer, renderArticlePage, safeJson } from '../seo/render.mjs';

const article = { slug: 'bitcoin-etf-haberi', title: 'Bitcoin ETF Girişleri Piyasada Yeni Beklenti Oluşturdu', excerpt: 'Spot Bitcoin ETF ürünlerine gelen yeni girişler piyasa katılımcılarının risk iştahındaki toparlanma beklentisini güçlendirdi ve kurumsal talebin seyrini yeniden gündeme taşıdı.', category: 'Bitcoin', source: { name: 'Test Kaynak' }, publishedAt: '2026-08-06T12:00:00.000Z', sourceUpdatedAt: null, authorName: 'Editör', coverImageUrl: null, originalUrl: 'https://example.com/news', aiSummary: { needsReview: false }, tags: [], archivedAt: null };
const template = '<!doctype html><html><head><meta name="description" content="old"><title>Old</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>';

test('SEO title and description stay within target bounds', () => {
  assert.ok(articleSeoTitle(article).length >= 50);
  assert.ok(articleSeoTitle(article).length <= 60);
  assert.ok(articleSeoDescription(article).length <= 160);
  assert.ok(articleSeoDescription(article).length >= 140);
});
test('server HTML contains canonical, article and breadcrumb schemas plus crawlable content', () => {
  const html = renderArticlePage(template, 'https://kriptokeyfi.com', { article, related: [{ ...article, slug: 'ilgili', title: 'İlgili haber' }] });
  assert.match(html, /rel="canonical" href="https:\/\/kriptokeyfi\.com\/haberler\/bitcoin-etf-haberi"/);
  assert.match(html, /"@type":"NewsArticle"/);
  assert.match(html, /"@type":"BreadcrumbList"/);
  assert.match(html, /<h1>Bitcoin ETF/);
  assert.match(html, /href="\/haberler\/ilgili"/);
});
test('JSON-LD serialization neutralizes script injection', () => {
  assert.equal(safeJson({ value: '</script><script>alert(1)</script>' }).includes('</script>'), false);
});
test('production API proxy forwards JSON requests and backend responses', async (context) => {
  const backendApp = express();
  backendApp.use(express.json());
  backendApp.post('/api/echo', (req, res) => res.status(201).cookie('session', 'test', { httpOnly: true }).json({ body: req.body }));
  const backend = backendApp.listen(0, '127.0.0.1');
  await new Promise((resolve) => backend.once('listening', resolve));
  context.after(() => new Promise((resolve) => backend.close(resolve)));
  const backendPort = backend.address().port;

  const frontendApp = express();
  frontendApp.use('/api', createApiProxy(`http://127.0.0.1:${backendPort}/api`));
  const frontend = frontendApp.listen(0, '127.0.0.1');
  await new Promise((resolve) => frontend.once('listening', resolve));
  context.after(() => new Promise((resolve) => frontend.close(resolve)));
  const frontendPort = frontend.address().port;

  const response = await fetch(`http://127.0.0.1:${frontendPort}/api/echo`, { method: 'POST', headers: { 'content-type': 'application/json', origin: `http://127.0.0.1:${frontendPort}` }, body: JSON.stringify({ ok: true }) });
  assert.equal(response.status, 201);
  assert.match(response.headers.get('set-cookie') ?? '', /session=test/);
  assert.deepEqual(await response.json(), { body: { ok: true } });
});

test('robots and sitemap endpoints expose only indexable published news', async (context) => {
  const indexable = [
    article,
    { ...article, slug: 'ikinci-bitcoin-haberi', title: 'Bitcoin piyasasında ikinci doğrulanmış gelişme' },
  ];
  const reviewRequired = { ...article, slug: 'inceleme-gereken-haber', title: 'İnceleme gereken haber', aiSummary: { needsReview: true } };
  const backendApp = express();
  backendApp.get('/api/news', (_req, res) => res.json({ success: true, data: { articles: [...indexable, reviewRequired], nextCursor: null } }));
  const backend = backendApp.listen(0, '127.0.0.1');
  await new Promise((resolve) => backend.once('listening', resolve));
  context.after(() => new Promise((resolve) => backend.close(resolve)));

  const distDir = await mkdtemp(path.join(tmpdir(), 'kriptokeyfi-seo-'));
  await writeFile(path.join(distDir, 'index.html'), template);
  context.after(() => rm(distDir, { recursive: true, force: true }));
  const backendPort = backend.address().port;
  const app = await createSeoServer({ distDir, siteUrl: 'https://kriptokeyfi.com', apiBaseUrl: `http://127.0.0.1:${backendPort}/api` });
  const frontend = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => frontend.once('listening', resolve));
  context.after(() => new Promise((resolve) => frontend.close(resolve)));
  const frontendPort = frontend.address().port;

  const robots = await (await fetch(`http://127.0.0.1:${frontendPort}/robots.txt`)).text();
  assert.match(robots, /Allow: \/haberler/);
  assert.match(robots, /Disallow: \/admin\//);
  assert.match(robots, /Disallow: \/api\//);

  const index = await (await fetch(`http://127.0.0.1:${frontendPort}/sitemap.xml`)).text();
  assert.match(index, /\/sitemaps\/news-1\.xml/);
  assert.match(index, /\/sitemaps\/taxonomy\.xml/);

  const newsMap = await (await fetch(`http://127.0.0.1:${frontendPort}/sitemaps/news-1.xml`)).text();
  assert.match(newsMap, /\/haberler\/bitcoin-etf-haberi/);
  assert.match(newsMap, /\/haberler\/ikinci-bitcoin-haberi/);
  assert.doesNotMatch(newsMap, /inceleme-gereken-haber/);

  const taxonomy = await (await fetch(`http://127.0.0.1:${frontendPort}/sitemaps/taxonomy.xml`)).text();
  assert.match(taxonomy, /\/haberler\/kategori\/bitcoin/);
});
