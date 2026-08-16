import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './video.controller.js';
import { createVideoBodySchema } from './video.schema.js';

export const videoRouter = Router();
videoRouter.get('/', asyncHandler(controller.list));

export const adminVideoRouter = Router();
adminVideoRouter.use(authenticate, authorize(UserRole.ADMIN));
adminVideoRouter.post('/', validateRequest({ body: createVideoBodySchema }), asyncHandler(controller.create));
