import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './youtube-score.controller.js';
import { updateYoutubeScoreWeightsBodySchema } from './youtube-score.schema.js';

export const adminYoutubeScoreRouter = Router();
adminYoutubeScoreRouter.use(authenticate, authorize(UserRole.ADMIN));
adminYoutubeScoreRouter.get('/', asyncHandler(controller.overview));
adminYoutubeScoreRouter.post('/recalculate', asyncHandler(controller.recalculate));
adminYoutubeScoreRouter.put('/weights', validateRequest({ body: updateYoutubeScoreWeightsBodySchema }), asyncHandler(controller.updateWeights));
