import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/authenticate.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './auth.controller.js';
import { googleBodySchema, loginBodySchema, registerBodySchema } from './auth.schema.js';
import { env } from '../../config/env.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many login attempts; try again later' } },
});

authRouter.post('/login', loginLimiter, validateRequest({ body: loginBodySchema }), asyncHandler(controller.login));
authRouter.post('/register', loginLimiter, validateRequest({ body: registerBodySchema }), asyncHandler(controller.register));
authRouter.post('/google', loginLimiter, validateRequest({ body: googleBodySchema }), asyncHandler(controller.google));
authRouter.post('/refresh', asyncHandler(controller.refresh));
authRouter.post('/logout', asyncHandler(controller.logout));
authRouter.get('/me', authenticate, asyncHandler(controller.me));
