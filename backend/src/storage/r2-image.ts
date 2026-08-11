import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { env } from '../config/env.js';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_IMAGE_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class R2ImageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'R2ImageError';
  }
}

let client: S3Client | undefined;

function r2Client() {
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET_NAME || !env.R2_PUBLIC_URL) {
    throw new R2ImageError('Cloudflare R2 configuration is incomplete. Check the R2_* environment variables.');
  }
  client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

function objectKey(path: string) {
  const key = path.trim().replaceAll('\\', '/').replace(/^\/+/, '');
  const segments = key.split('/');
  if (!key || segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new R2ImageError(`Invalid R2 image path: ${path}`);
  }
  if (!key.toLocaleLowerCase().endsWith('.webp')) {
    throw new R2ImageError(`R2 image path must end with .webp: ${path}`);
  }
  return key;
}

async function downloadImage(urlValue: string) {
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch (error) {
    throw new R2ImageError(`Invalid image URL: ${urlValue}`, { cause: error });
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new R2ImageError(`Unsupported image URL protocol: ${url.protocol}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { accept: 'image/jpeg,image/png,image/webp' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    throw new R2ImageError(`Image download failed for ${url.toString()}`, { cause: error });
  }
  if (!response.ok) {
    throw new R2ImageError(`Image download failed for ${url.toString()}: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLocaleLowerCase() ?? '';
  if (!ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) {
    throw new R2ImageError(`Unsupported image content-type for ${url.toString()}: ${contentType || 'missing'}`);
  }
  const declaredSize = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_IMAGE_BYTES) {
    throw new R2ImageError(`Image exceeds the 10 MB limit: ${url.toString()}`);
  }
  if (!response.body) throw new R2ImageError(`Image response has no body: ${url.toString()}`);

  const chunks: Uint8Array[] = [];
  const reader = response.body.getReader();
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new R2ImageError(`Image exceeds the 10 MB limit: ${url.toString()}`);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof R2ImageError) throw error;
    throw new R2ImageError(`Image download stream failed for ${url.toString()}`, { cause: error });
  }
  return Buffer.concat(chunks, received);
}

/** Converts a remote image or in-memory image buffer to WebP and uploads it to R2. */
export async function uploadImage(input: string | Buffer, path: string) {
  const key = objectKey(path);
  const source = typeof input === 'string' ? await downloadImage(input) : input;
  if (source.byteLength > MAX_IMAGE_BYTES) throw new R2ImageError('Image buffer exceeds the 10 MB limit.');
  if (source.byteLength === 0) throw new R2ImageError('Image buffer is empty.');

  let webp: Buffer;
  try {
    webp = await sharp(source, { failOn: 'error' }).rotate().webp({ quality: 88 }).toBuffer();
  } catch (error) {
    throw new R2ImageError(`Image conversion to WebP failed for ${key}`, { cause: error });
  }

  try {
    await r2Client().send(new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: webp,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
    }));
  } catch (error) {
    if (error instanceof R2ImageError) throw error;
    throw new R2ImageError(`R2 upload failed for ${key}`, { cause: error });
  }

  return `${env.R2_PUBLIC_URL.replace(/\/+$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
