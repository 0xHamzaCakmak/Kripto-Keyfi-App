import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './video.controller.js';
import { createVideoBodySchema, createYoutubeChannelBodySchema, listVideosQuerySchema, updateYoutubeChannelBodySchema, youtubeChannelParamsSchema } from './video.schema.js';

export const videoRouter = Router();
videoRouter.get('/', optionalAuthenticate, validateRequest({ query: listVideosQuerySchema }), asyncHandler(controller.list));

export const publicYoutubeChannelRouter = Router();
publicYoutubeChannelRouter.get('/list', asyncHandler(controller.listPublicChannels));

export const adminVideoRouter = Router();
adminVideoRouter.use(authenticate, authorize(UserRole.ADMIN));
adminVideoRouter.post('/', validateRequest({ body: createVideoBodySchema }), asyncHandler(controller.create));

export const adminYoutubeChannelRouter = Router();
adminYoutubeChannelRouter.use(authenticate, authorize(UserRole.ADMIN));
adminYoutubeChannelRouter.get('/', asyncHandler(controller.listChannels));
adminYoutubeChannelRouter.post('/', validateRequest({ body: createYoutubeChannelBodySchema }), asyncHandler(controller.createChannel));
adminYoutubeChannelRouter.patch('/:channelId/status', validateRequest({ params: youtubeChannelParamsSchema, body: updateYoutubeChannelBodySchema }), asyncHandler(controller.updateChannelStatus));
