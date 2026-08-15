import { NewsPublicationStatus } from '@prisma/client';
import { prisma } from '../src/database/prisma.js';

const rawArgs = process.argv.slice(2);
const execute = rawArgs.includes('--execute');
const limitArg = rawArgs.find((argument) => argument.startsWith('--limit='));
const limit = Math.min(1_000, Math.max(1, Number(limitArg?.slice(8) ?? 100)));
if (!Number.isInteger(limit)) throw new Error('--limit pozitif bir tam sayı olmalıdır');

function metaImage(html: string, pageUrl: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map((match) => [match[1]!.toLocaleLowerCase(), match[2]!]));
    const key = (attributes.property ?? attributes.name ?? '').toLocaleLowerCase();
    if (!['og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'].includes(key) || !attributes.content) continue;
    try {
      const url = new URL(attributes.content, pageUrl);
      if (['http:', 'https:'].includes(url.protocol)) return url.toString();
    } catch { /* malformed metadata is ignored */ }
  }
  return null;
}

async function discover(originalUrl: string) {
  const response = await fetch(originalUrl, { headers: { accept: 'text/html,application/xhtml+xml' }, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Kaynak sayfa HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) throw new Error(`Beklenmeyen içerik tipi: ${contentType || 'yok'}`);
  const html = (await response.text()).slice(0, 1_500_000);
  return metaImage(html, response.url);
}

const articles = await prisma.newsArticle.findMany({
  where: { coverImageUrl: null, sourceImageUrl: null, status: { notIn: [NewsPublicationStatus.REJECTED, NewsPublicationStatus.ARCHIVED] }, source: { is: { imageUseAllowed: true } } },
  select: { id: true, slug: true, originalUrl: true },
  orderBy: { publishedAt: 'desc' },
  take: limit,
});

if (!execute) {
  console.log(JSON.stringify({ mode: 'dry-run', eligible: articles.length, limit, instruction: 'Gerçek keşif için --execute ekleyin.' }, null, 2));
  await prisma.$disconnect();
  process.exit(0);
}

let discovered = 0;
let missing = 0;
let failed = 0;
for (const article of articles) {
  try {
    const sourceImageUrl = await discover(article.originalUrl);
    if (!sourceImageUrl) {
      missing += 1;
      await prisma.newsArticle.update({ where: { id: article.id }, data: { imageSyncError: 'Kaynak sayfada og:image veya twitter:image bulunamadı' } });
      continue;
    }
    await prisma.newsArticle.update({ where: { id: article.id }, data: { sourceImageUrl, imageSyncError: null, imageSyncNextAttemptAt: new Date() } });
    discovered += 1;
  } catch (error) {
    failed += 1;
    await prisma.newsArticle.update({ where: { id: article.id }, data: { imageSyncError: error instanceof Error ? error.message.slice(0, 500) : 'Görsel kaynağı keşfedilemedi' } });
  }
}

console.log(JSON.stringify({ mode: 'execute', scanned: articles.length, discovered, missing, failed }, null, 2));
await prisma.$disconnect();
