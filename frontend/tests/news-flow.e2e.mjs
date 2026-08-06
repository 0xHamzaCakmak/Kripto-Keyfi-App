import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Launcher } from 'chrome-launcher';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(here, '..');
const backendDir = path.resolve(frontendDir, '..', 'backend');

const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    server.close((error) => error ? reject(error) : resolve(port));
  });
});

async function waitForUrl(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* server is still starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not become ready: ${url}`);
}

function startNode(cwd, args, env) {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let errors = '';
  child.stderr.on('data', (chunk) => { errors = `${errors}${chunk}`.slice(-4_000); });
  return { child, errors: () => errors };
}

async function verifyViewport(browser, baseUrl, viewport, label) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const consoleErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto(`${baseUrl}/haberler`, { waitUntil: 'networkidle2' });
  await page.waitForSelector('h1');
  const articlePath = await page.evaluate(() => [...document.querySelectorAll('a[href^="/haberler/"]')]
    .map((link) => link.getAttribute('href'))
    .find((href) => href && /^\/haberler\/[^/]+$/.test(href)) ?? null);
  assert.ok(articlePath, `${label}: haber kartında dahili detay bağlantısı bulunamadı`);

  await page.evaluate((href) => {
    const link = [...document.querySelectorAll('a')].find((candidate) => candidate.getAttribute('href') === href);
    if (!(link instanceof HTMLElement)) throw new Error('Article card link is missing');
    link.click();
  }, articlePath);
  await page.waitForFunction((pathname) => location.pathname === pathname, {}, articlePath);
  await page.waitForSelector('h2');
  await page.waitForSelector('a[target="_blank"][rel*="noopener"][rel*="noreferrer"]');

  const result = await page.evaluate(() => {
    const summaryHeading = [...document.querySelectorAll('h2')].find((heading) => heading.textContent?.includes('Türkçe Haber Özeti'));
    const summary = summaryHeading?.closest('section');
    const sourceCta = [...document.querySelectorAll('a[target="_blank"]')].find((link) => link.textContent?.includes('Haberin devamını'));
    const backLink = [...document.querySelectorAll('a')].find((link) => link.textContent?.includes('Haber merkezine dön'));
    return {
      pathname: location.pathname,
      title: document.querySelector('h1')?.textContent?.trim() ?? '',
      summaryText: summary?.textContent?.trim() ?? '',
      sourceHref: sourceCta?.getAttribute('href') ?? '',
      sourceRel: sourceCta?.getAttribute('rel') ?? '',
      sourceAfterSummary: Boolean(summary && sourceCta && (summary.compareDocumentPosition(sourceCta) & Node.DOCUMENT_POSITION_FOLLOWING)),
      hasBackLink: Boolean(backLink),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });

  assert.equal(result.pathname, articlePath, `${label}: kart harici kaynağa yönlendirdi`);
  assert.ok(result.title.length > 10, `${label}: detay başlığı yüklenmedi`);
  assert.ok(result.summaryText.length > 80, `${label}: Türkçe özet yüklenmedi`);
  assert.match(result.sourceHref, /^https:\/\//, `${label}: kaynak CTA güvenli HTTPS değil`);
  assert.match(result.sourceRel, /nofollow/);
  assert.match(result.sourceRel, /noopener/);
  assert.match(result.sourceRel, /noreferrer/);
  assert.equal(result.sourceAfterSummary, true, `${label}: kaynak CTA özetten önce gösteriliyor`);
  assert.equal(result.hasBackLink, true, `${label}: Haber merkezine dön bağlantısı yok`);
  assert.ok(result.overflow <= 1, `${label}: ${result.overflow}px yatay taşma var`);
  assert.deepEqual(consoleErrors, [], `${label}: tarayıcı konsol hataları: ${consoleErrors.join(' | ')}`);
  await page.close();
  return { label, articlePath, overflow: result.overflow };
}

const backendPort = await freePort();
const frontendPort = await freePort();
const baseUrl = `http://127.0.0.1:${frontendPort}`;
const backend = startNode(backendDir, ['dist/server.js'], { PORT: String(backendPort), FRONTEND_URL: baseUrl, NEWS_SYNC_ENABLED: 'false', NEWS_AI_AUTO_PROCESS: 'false' });
const frontend = startNode(frontendDir, ['server.mjs'], { PORT: String(frontendPort), PUBLIC_SITE_URL: baseUrl, SEO_API_BASE_URL: `http://127.0.0.1:${backendPort}/api` });
let browser;

try {
  await waitForUrl(`http://127.0.0.1:${backendPort}/api/health`);
  await waitForUrl(`${baseUrl}/haberler`);
  const executablePath = Launcher.getInstallations()[0];
  assert.ok(executablePath, 'Chrome installation was not found');
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const results = [];
  results.push(await verifyViewport(browser, baseUrl, { width: 1440, height: 900, deviceScaleFactor: 1 }, 'desktop'));
  results.push(await verifyViewport(browser, baseUrl, { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 'mobile'));
  console.info(JSON.stringify({ success: true, results }, null, 2));
} catch (error) {
  const diagnostics = [backend.errors(), frontend.errors()].filter(Boolean).join('\n');
  if (diagnostics) console.error(diagnostics);
  throw error;
} finally {
  await browser?.close().catch(() => undefined);
  backend.child.kill();
  frontend.child.kill();
}
