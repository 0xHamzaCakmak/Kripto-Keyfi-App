import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const aws = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = aws.send;
  },
  PutObjectCommand: class {
    constructor(public readonly input: Record<string, unknown>) {}
  },
}));

vi.mock('../src/config/env.js', () => ({
  env: {
    R2_ACCOUNT_ID: 'account-id',
    R2_ACCESS_KEY_ID: 'access-key',
    R2_SECRET_ACCESS_KEY: 'secret-key',
    R2_BUCKET_NAME: 'images',
    R2_PUBLIC_URL: 'https://media.example.com/',
  },
}));

import { MAX_IMAGE_BYTES, R2ImageError, uploadImage } from '../src/storage/r2-image.js';

describe('R2 image upload', () => {
  beforeEach(() => aws.send.mockResolvedValue({}));
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the original dimensions, converts to WebP, and uploads from a buffer', async () => {
    const input = await sharp({ create: { width: 37, height: 23, channels: 3, background: '#ff9900' } }).png().toBuffer();

    const result = await uploadImage(input, 'haberler/test-news.webp');

    expect(result).toBe('https://media.example.com/haberler/test-news.webp');
    expect(aws.send).toHaveBeenCalledOnce();
    const command = aws.send.mock.calls[0]?.[0] as { input: { Body: Buffer; ContentType: string; Key: string } };
    expect(command.input.Key).toBe('haberler/test-news.webp');
    expect(command.input.ContentType).toBe('image/webp');
    expect(await sharp(command.input.Body).metadata()).toMatchObject({ format: 'webp', width: 37, height: 23 });
  });

  it('rejects a remote response with an unsupported content-type', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } })));

    await expect(uploadImage('https://source.example/image.svg', 'haberler/image.webp'))
      .rejects.toThrow('Unsupported image content-type');
    expect(aws.send).not.toHaveBeenCalled();
  });

  it('rejects a remote response declared larger than 10 MB', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x', { headers: {
      'content-type': 'image/jpeg',
      'content-length': String(MAX_IMAGE_BYTES + 1),
    } })));

    await expect(uploadImage('https://source.example/large.jpg', 'haberler/large.webp'))
      .rejects.toThrow('exceeds the 10 MB limit');
    expect(aws.send).not.toHaveBeenCalled();
  });

  it('stops a download stream that exceeds 10 MB without a content-length header', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_IMAGE_BYTES));
        controller.enqueue(new Uint8Array(1));
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'image/webp' } })));

    await expect(uploadImage('https://source.example/stream.webp', 'haberler/stream.webp'))
      .rejects.toThrow('exceeds the 10 MB limit');
    expect(aws.send).not.toHaveBeenCalled();
  });

  it('rejects unsafe or non-WebP object paths', async () => {
    await expect(uploadImage(Buffer.from('x'), '../image.webp')).rejects.toBeInstanceOf(R2ImageError);
    await expect(uploadImage(Buffer.from('x'), 'haberler/image.jpg')).rejects.toThrow('must end with .webp');
  });
});
