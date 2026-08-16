import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './video-reaction.controller.js';
import { videoReactionBodySchema, videoReactionParamsSchema } from './video-reaction.schema.js';

export const videoReactionRouter = Router();
videoReactionRouter.use(authenticate);
videoReactionRouter.get('/', asyncHandler(controller.list));
videoReactionRouter.put('/:videoId', validateRequest({ params: videoReactionParamsSchema, body: videoReactionBodySchema }), asyncHandler(controller.toggle));
