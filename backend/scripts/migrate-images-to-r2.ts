import { env } from '../src/config/env.js';
import { prisma } from '../src/database/prisma.js';
import { uploadImage } from '../src/storage/r2-image.js';

const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const dryRun = args.has('--dry-run');
const execute = args.has('--execute');
const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function parseLimit() {
  const limitArgs = rawArgs.filter((argument) => argument.startsWith('--limit='));
  if (limitArgs.length > 1) throw new Error('Pass --limit only once.');
  const rawLimit = limitArgs[0]?.slice('--limit='.length);
  if (rawLimit === undefined) return undefined;
  if (!/^\d+$/.test(rawLimit)) throw new Error('--limit must be a positive integer, for example --limit=20.');
  const limit = Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000) {
    throw new Error('--limit must be between 1 and 10000.');
  }
  return limit;
}

async function main() {
  if (dryRun === execute) {
    throw new Error('Choose exactly one mode: --dry-run to list records or --execute to migrate them.');
  }
  const unknownArgs = rawArgs.filter((argument) => !['--dry-run', '--execute'].includes(argument) && !argument.startsWith('--limit='));
  if (unknownArgs.length) throw new Error(`Unknown argument(s): ${unknownArgs.join(', ')}`);
  const limit = parseLimit();
  if (!env.R2_PUBLIC_URL) throw new Error('R2_PUBLIC_URL and the other R2_* environment variables must be configured.');

  const r2Prefix = `${env.R2_PUBLIC_URL.replace(/\/+$/, '')}/`;
  const articles = await prisma.newsArticle.findMany({
    where: {
      AND: [
        { coverImageUrl: { not: null } },
        { OR: [{ coverImageUrl: { startsWith: 'https://' } }, { coverImageUrl: { startsWith: 'http://' } }] },
        { NOT: { coverImageUrl: { startsWith: r2Prefix } } },
      ],
    },
    select: { id: true, slug: true, publishedAt: true, coverImageUrl: true },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    ...(limit ? { take: limit } : {}),
  });

  console.info(`${dryRun ? 'DRY RUN' : 'MIGRATION'}: ${articles.length} newest eligible news images selected${limit ? ` (limit=${limit})` : ''}.`);
  if (dryRun) {
    for (const article of articles) console.info(`[DRY-RUN] ${article.publishedAt.toISOString()} | ${article.id} | ${article.slug} | ${article.coverImageUrl}`);
    console.info(`Dry-run complete: ${articles.length} records listed, no files uploaded and no database rows changed.`);
    return;
  }

  let succeeded = 0;
  let failed = 0;
  for (const article of articles) {
    const sourceUrl = article.coverImageUrl;
    if (!sourceUrl) continue;
    try {
      const r2Url = await uploadImage(sourceUrl, `haberler/${article.slug}.webp`);
      const updated = await prisma.newsArticle.updateMany({
        where: { id: article.id, coverImageUrl: sourceUrl },
        data: { coverImageUrl: r2Url },
      });
      if (updated.count !== 1) throw new Error('Article image changed concurrently; database update was skipped.');
      succeeded += 1;
      console.info(`[OK] ${article.id} | ${article.slug} -> ${r2Url}`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ERROR] ${article.id} | ${article.slug} | ${message}`);
    }
    await wait(200 + Math.floor(Math.random() * 301));
  }

  console.info(`Migration complete: ${succeeded} succeeded, ${failed} failed, ${articles.length} total.`);
  if (failed > 0) process.exitCode = 1;
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
