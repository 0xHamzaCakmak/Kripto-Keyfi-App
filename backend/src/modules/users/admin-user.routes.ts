import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './admin-user.controller.js';
import { adminUserListQuerySchema, createAdminUserBodySchema } from './admin-user.schema.js';

export const adminUserRouter = Router();
adminUserRouter.use(authenticate, authorize(UserRole.ADMIN));
adminUserRouter.get('/', validateRequest({ query: adminUserListQuerySchema }), asyncHandler(controller.list));
adminUserRouter.post('/', validateRequest({ body: createAdminUserBodySchema }), asyncHandler(controller.create));
