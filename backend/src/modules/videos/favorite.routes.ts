import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './favorite.controller.js';
import { favoriteChannelParamsSchema } from './favorite.schema.js';

export const favoriteChannelRouter = Router();
favoriteChannelRouter.use(authenticate);
favoriteChannelRouter.get('/', asyncHandler(controller.list));
favoriteChannelRouter.post('/:channelId', validateRequest({ params: favoriteChannelParamsSchema }), asyncHandler(controller.toggle));
