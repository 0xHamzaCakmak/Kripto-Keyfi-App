import type { UserRole } from '@prisma/client';
import type { RequestHandler } from 'express';
import { ApiError } from '../utils/api-error.js';

export const authorize = (...roles: UserRole[]): RequestHandler => (req, _res, next) => {
  if (!req.user) return next(new ApiError(401, 'Authentication required', 'UNAUTHORIZED'));
  if (!roles.includes(req.user.role)) return next(new ApiError(403, 'You do not have permission to access this resource', 'FORBIDDEN'));
  next();
};

