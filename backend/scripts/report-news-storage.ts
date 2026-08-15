import { GetBucketLifecycleConfigurationCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { NewsPublicationStatus } from '@prisma/client';
import { env } from '../src/config/env.js';
import { prisma } from '../src/database/prisma.js';

async function listR2NewsObjects(client: S3Client) {
  let continuationToken: string | undefined;
  let objects = 0;
  let bytes = 0;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET_NAME, Prefix: 'haberler/', ContinuationToken: continuationToken }));
    objects += page.Contents?.length ?? 0;
    bytes += page.Contents?.reduce((sum, item) => sum + (item.Size ?? 0), 0) ?? 0;
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return { objects, bytes };
}

async function main() {
  const r2Prefix = `${env.R2_PUBLIC_URL.replace(/\/+$/, '')}/`;
  const [total, published, pending, archived, rejected, withImage, r2Images, remoteImages, missingImages, retryableImages, aiStatuses, sources] = await Promise.all([
    prisma.newsArticle.count(),
    prisma.newsArticle.count({ where: { status: NewsPublicationStatus.PUBLISHED } }),
    prisma.newsArticle.count({ where: { status: NewsPublicationStatus.PENDING } }),
    prisma.newsArticle.count({ where: { status: NewsPublicationStatus.ARCHIVED } }),
    prisma.newsArticle.count({ where: { status: NewsPublicationStatus.REJECTED } }),
    prisma.newsArticle.count({ where: { coverImageUrl: { not: null } } }),
    prisma.newsArticle.count({ where: { coverImageUrl: { startsWith: r2Prefix } } }),
    prisma.newsArticle.count({ where: { coverImageUrl: { not: null }, NOT: { coverImageUrl: { startsWith: r2Prefix } } } }),
    prisma.newsArticle.count({ where: { coverImageUrl: null } }),
    prisma.newsArticle.count({ where: { sourceImageUrl: { not: null }, OR: [{ coverImageUrl: null }, { NOT: { coverImageUrl: { startsWith: r2Prefix } } }] } }),
    prisma.newsArticle.groupBy({ by: ['aiStatus'], _count: { _all: true } }),
    prisma.newsSource.findMany({ select: { name: true, isActive: true, autoPublish: true, aiEnabled: true, imageUseAllowed: true } }),
  ]);

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });
  const r2 = await listR2NewsObjects(client);
  let lifecycleRules: unknown[] = [];
  try {
    const lifecycle = await client.send(new GetBucketLifecycleConfigurationCommand({ Bucket: env.R2_BUCKET_NAME }));
    lifecycleRules = lifecycle.Rules?.map((rule) => ({ id: rule.ID ?? null, status: rule.Status, expiration: rule.Expiration ?? null, filter: rule.Filter ?? null })) ?? [];
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (!/NoSuchLifecycleConfiguration/i.test(name)) throw error;
  }

  console.log(JSON.stringify({
    database: { total, published, pending, archived, rejected, withImage, r2Images, remoteImages, missingImages, retryableImages, aiStatuses, sources },
    r2: { prefix: 'haberler/', objects: r2.objects, bytes: r2.bytes, mebibytes: Number((r2.bytes / 1024 / 1024).toFixed(2)), lifecycleRules },
  }, null, 2));
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
