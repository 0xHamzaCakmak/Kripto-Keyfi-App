import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './user.controller.js';
import { updateMeBodySchema } from './user.schema.js';

export const userRouter = Router();

const profileUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Çok fazla profil güncelleme isteği gönderildi; lütfen daha sonra tekrar deneyin.' } },
});

userRouter.patch('/me', authenticate, profileUpdateLimiter, validateRequest({ body: updateMeBodySchema }), asyncHandler(controller.updateMe));
