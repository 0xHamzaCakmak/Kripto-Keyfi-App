import type { RequestHandler } from 'express';
import { prisma } from '../database/prisma.js';
import { verifyAccessToken } from '../security/tokens.js';
import { ApiError } from '../utils/api-error.js';

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const authorization = req.header('authorization');
    if (!authorization?.startsWith('Bearer ')) throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
    const claims = await verifyAccessToken(authorization.slice(7));
    const user = await prisma.user.findUnique({
      where: { id: claims.sub }, select: { id: true, role: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
    req.user = { id: user.id, role: user.role, sessionId: claims.sid };
    next();
  } catch (error) {
    next(error instanceof ApiError ? error : new ApiError(401, 'Invalid or expired access token', 'UNAUTHORIZED'));
  }
};

export const optionalAuthenticate: RequestHandler = (req, res, next) => {
  if (!req.header('authorization')) return next();
  return authenticate(req, res, next);
};
