import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySeo } from '../seo/verify.mjs';

const site = 'https://kriptokeyfi.com';
const pages = {
  '/haberler': `<h1>Haberler</h1><link rel="canonical" href="${site}/haberler">CollectionPage`,
  '/robots.txt': `Sitemap: ${site}/sitemap.xml`,
  '/sitemap.xml': '<sitemapindex></sitemapindex>',
  '/sitemaps/news-1.xml': `<urlset><url><loc>${site}/haberler/test</loc></url></urlset>`,
  '/haberler/test': `<h1>Test</h1><link rel="canonical" href="${site}/haberler/test">NewsArticle`,
};
const request = (overrides = {}, marker = 'seo') => async url => new Response(overrides[url.pathname] ?? pages[url.pathname], { headers: { 'x-kriptokeyfi-renderer': marker } });

test('checks both listing and a sitemap article via the supplied origin', async () => {
  assert.deepEqual(await verifySeo('http://127.0.0.1:4173', site, request()), { articleChecked: true });
});
test('rejects a static SPA fallback even when HTTP is 200', async () => {
  await assert.rejects(verifySeo(site, site, request({}, '')), /renderer missing/);
  await assert.rejects(verifySeo(site, site, request({ '/haberler': '<div id="root"></div>' })), /lacks canonical/);
});
test('rejects missing article markup and mismatched canonical origin', async () => {
  await assert.rejects(verifySeo(site, site, request({ '/haberler/test': '<h1>Test</h1>' })), /Article HTML/);
  await assert.rejects(verifySeo(site, site, request({ '/robots.txt': 'Sitemap: http://localhost/sitemap.xml' })), /origin mismatch/);
});
test('allows a genuinely empty sitemap and reports that no article was checked', async () => {
  assert.deepEqual(await verifySeo(site, site, request({ '/sitemaps/news-1.xml': '<urlset></urlset>' })), { articleChecked: false });
});
