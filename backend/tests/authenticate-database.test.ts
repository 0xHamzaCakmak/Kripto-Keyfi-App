import { Prisma } from '@prisma/client';
import type { Request, Response, NextFunction } from 'express';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ verify: vi.fn(), find: vi.fn() }));
vi.mock('../src/database/prisma.js', () => ({ prisma: { user: { findUnique: mocks.find } } }));
vi.mock('../src/security/tokens.js', () => ({ verifyAccessToken: mocks.verify }));
import { authenticate } from '../src/middleware/authenticate.js';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.verify.mockResolvedValue({ sub: 'user', sid: 'session', role: 'ADMIN' });
  mocks.find.mockResolvedValue({ id: 'user', role: 'ADMIN', status: 'ACTIVE' });
});

async function run() {
  const req = { header: () => 'Bearer token', log: { error: vi.fn() } } as unknown as Request;
  const next = vi.fn();
  await authenticate(req, {} as Response, next as NextFunction);
  return { req, next };
}

it('returns 503 instead of triggering token refresh when the database pool is exhausted', async () => {
  mocks.find.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Pool timeout', { code: 'P2024', clientVersion: '6' }));
  const { req, next } = await run();
  expect(next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 503, code: 'DATABASE_BUSY' });
  expect(req.user).toBeUndefined();
});

it('preserves unexpected database errors for the server error handler', async () => {
  const error = new Error('Database unavailable');
  mocks.find.mockRejectedValue(error);
  const { next } = await run();
  expect(next).toHaveBeenCalledWith(error);
});

it('rejects invalid tokens before accessing the database', async () => {
  mocks.verify.mockRejectedValue(new Error('Expired token'));
  const { next } = await run();
  expect(next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 401 });
  expect(mocks.find).not.toHaveBeenCalled();
});

it('rejects inactive users and authenticates active users', async () => {
  mocks.find.mockResolvedValueOnce({ id: 'user', status: 'SUSPENDED' });
  expect((await run()).next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 401 });
  const { req, next } = await run();
  expect(req.user).toEqual({ id: 'user', role: 'ADMIN', sessionId: 'session' });
  expect(next).toHaveBeenCalledWith();
});
