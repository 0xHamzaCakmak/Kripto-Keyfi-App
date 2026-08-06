import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './news.controller.js';
import { articleIdParamsSchema, detailNewsQuerySchema, listNewsQuerySchema, newsAnalyticsEventBodySchema, slugParamsSchema } from './news.schema.js';

export const newsRouter = Router();
newsRouter.get('/', validateRequest({ query: listNewsQuerySchema }), asyncHandler(controller.list));
newsRouter.post('/analytics', validateRequest({ body: newsAnalyticsEventBodySchema }), asyncHandler(controller.recordAnalytics));
newsRouter.get('/:slug', validateRequest({ params: slugParamsSchema, query: detailNewsQuerySchema }), asyncHandler(controller.detail));
newsRouter.post('/:articleId/save', authenticate, validateRequest({ params: articleIdParamsSchema }), asyncHandler(controller.save));
newsRouter.delete('/:articleId/save', authenticate, validateRequest({ params: articleIdParamsSchema }), asyncHandler(controller.unsave));
