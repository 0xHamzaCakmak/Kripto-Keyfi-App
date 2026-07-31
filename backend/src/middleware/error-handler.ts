import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  void _next;
  let normalized: ApiError;
  if (error instanceof ApiError) normalized = error;
  else if (error instanceof ZodError) normalized = new ApiError(400, 'Validation failed', 'VALIDATION_ERROR', error.flatten());
  else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    normalized = new ApiError(409, 'A record with this value already exists', 'CONFLICT');
  } else {
    normalized = new ApiError(500, 'An unexpected error occurred', 'INTERNAL_ERROR');
  }

  req.log?.error({ err: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error }, 'request failed');
  res.status(normalized.statusCode).json({
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details === undefined ? {} : { details: normalized.details }),
      ...(env.NODE_ENV !== 'production' && error instanceof Error ? { stack: error.stack } : {}),
    },
  });
};
