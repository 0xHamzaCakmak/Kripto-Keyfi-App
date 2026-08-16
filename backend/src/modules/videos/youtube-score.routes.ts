import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './youtube-score.controller.js';

export const adminYoutubeScoreRouter = Router();
adminYoutubeScoreRouter.use(authenticate, authorize(UserRole.ADMIN));
adminYoutubeScoreRouter.post('/recalculate', asyncHandler(controller.recalculate));
