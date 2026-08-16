import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './creator.controller.js';
import { connectYoutubeChannelBodySchema, creatorApplicationParamsSchema, creatorVideoBodySchema, reviewCreatorApplicationBodySchema } from './creator.schema.js';

export const creatorRouter = Router();
creatorRouter.use(authenticate);
creatorRouter.get('/me', asyncHandler(controller.myState));
creatorRouter.post('/channel', validateRequest({ body: connectYoutubeChannelBodySchema }), asyncHandler(controller.connectChannel));
creatorRouter.post('/apply', asyncHandler(controller.apply));
creatorRouter.post('/videos', validateRequest({ body: creatorVideoBodySchema }), asyncHandler(controller.addVideo));

export const adminCreatorRouter = Router();
adminCreatorRouter.use(authenticate, authorize(UserRole.ADMIN));
adminCreatorRouter.get('/', asyncHandler(controller.listApplications));
adminCreatorRouter.patch('/:userId/status', validateRequest({ params: creatorApplicationParamsSchema, body: reviewCreatorApplicationBodySchema }), asyncHandler(controller.review));
