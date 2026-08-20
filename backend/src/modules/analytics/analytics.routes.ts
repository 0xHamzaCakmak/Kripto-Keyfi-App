import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './analytics.controller.js';
import { contentQuerySchema, eventBodySchema, funnelQuerySchema, rangeQuerySchema } from './analytics.schema.js';

export const analyticsRouter = Router();
analyticsRouter.post('/events', optionalAuthenticate, validateRequest({ body: eventBodySchema }), asyncHandler(controller.record));

export const adminAnalyticsRouter = Router();
adminAnalyticsRouter.use(authenticate, authorize(UserRole.ADMIN));
adminAnalyticsRouter.get('/overview', validateRequest({ query: rangeQuerySchema }), asyncHandler(controller.overview));
adminAnalyticsRouter.get('/top-pages', validateRequest({ query: rangeQuerySchema }), asyncHandler(controller.pages));
adminAnalyticsRouter.get('/referrers', validateRequest({ query: rangeQuerySchema }), asyncHandler(controller.referrers));
adminAnalyticsRouter.get('/devices', validateRequest({ query: rangeQuerySchema }), asyncHandler(controller.devices));
adminAnalyticsRouter.get('/funnel', validateRequest({ query: funnelQuerySchema }), asyncHandler(controller.funnel));
adminAnalyticsRouter.get('/content', validateRequest({ query: contentQuerySchema }), asyncHandler(controller.content));
