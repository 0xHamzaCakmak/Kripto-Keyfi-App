import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { dashboard } from './admin.controller.js';
import { tradingRouter } from '../trading/trading.routes.js';
import { adminUserRouter } from '../users/admin-user.routes.js';

export const adminRouter = Router();
adminRouter.get('/dashboard', authenticate, authorize(UserRole.ADMIN), asyncHandler(dashboard));
adminRouter.use('/users', adminUserRouter);
adminRouter.use('/trading', tradingRouter);
