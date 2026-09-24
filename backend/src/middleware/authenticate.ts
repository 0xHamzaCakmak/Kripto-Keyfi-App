import type { RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { verifyAccessToken, type AccessClaims } from '../security/tokens.js';
import { ApiError } from '../utils/api-error.js';

export const authenticate: RequestHandler = async (req, _res, next) => {
  const authorization = req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) return next(new ApiError(401, 'Authentication required', 'UNAUTHORIZED'));
  let claims: AccessClaims;
  try {
    claims = await verifyAccessToken(authorization.slice(7));
  } catch {
    return next(new ApiError(401, 'Invalid or expired access token', 'UNAUTHORIZED'));
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: claims.sub }, select: { id: true, role: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
    req.user = { id: user.id, role: user.role, sessionId: claims.sid };
    next();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2024') {
      req.log?.error({ err: { code: error.code, message: error.message } }, 'authentication database pool exhausted');
      return next(new ApiError(503, 'Veritabanı bağlantıları meşgul. Lütfen kısa süre sonra tekrar deneyin.', 'DATABASE_BUSY'));
    }
    next(error);
  }
};

export const optionalAuthenticate: RequestHandler = (req, res, next) => {
  if (!req.header('authorization')) return next();
  return authenticate(req, res, next);
};
