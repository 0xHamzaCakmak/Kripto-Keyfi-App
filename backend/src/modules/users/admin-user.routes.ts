import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './admin-user.controller.js';
import { adminUserListQuerySchema, adminUserParamsSchema, createAdminUserBodySchema, resetAdminUserPasswordBodySchema, updateAdminUserBodySchema } from './admin-user.schema.js';

export const adminUserRouter = Router();
adminUserRouter.use(authenticate, authorize(UserRole.ADMIN));
adminUserRouter.get('/', validateRequest({ query: adminUserListQuerySchema }), asyncHandler(controller.list));
adminUserRouter.post('/', validateRequest({ body: createAdminUserBodySchema }), asyncHandler(controller.create));
adminUserRouter.get('/:id/profile-sections', validateRequest({ params: adminUserParamsSchema }), asyncHandler(controller.profileSections));
adminUserRouter.get('/:id', validateRequest({ params: adminUserParamsSchema }), asyncHandler(controller.detail));
adminUserRouter.patch('/:id', validateRequest({ params: adminUserParamsSchema, body: updateAdminUserBodySchema }), asyncHandler(controller.update));
adminUserRouter.post('/:id/reset-password', validateRequest({ params: adminUserParamsSchema, body: resetAdminUserPasswordBodySchema }), asyncHandler(controller.resetPassword));
adminUserRouter.delete('/:id', validateRequest({ params: adminUserParamsSchema }), asyncHandler(controller.remove));
adminUserRouter.post('/:id/restore', validateRequest({ params: adminUserParamsSchema }), asyncHandler(controller.restore));
