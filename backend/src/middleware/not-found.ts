import type { RequestHandler } from 'express';
import { ApiError } from '../utils/api-error.js';

export const notFound: RequestHandler = (req, _res, next) =>
  next(new ApiError(404, `Route ${req.method} ${req.path} not found`, 'NOT_FOUND'));

