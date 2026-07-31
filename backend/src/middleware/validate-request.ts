import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';
import { ApiError } from '../utils/api-error.js';

type RequestSchemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny };

export const validateRequest = (schemas: RequestSchemas): RequestHandler => (req, _res, next) => {
  for (const key of ['body', 'query', 'params'] as const) {
    const schema = schemas[key];
    if (!schema) continue;
    const result = schema.safeParse(req[key]);
    if (!result.success) {
      return next(new ApiError(400, 'Request validation failed', 'VALIDATION_ERROR', result.error.flatten()));
    }
    Object.assign(req[key], result.data);
  }
  next();
};

