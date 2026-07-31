import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { overview } from './trading.controller.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { balances, createAccount, listAccounts, removeAccount, testAccount } from './exchange-account.controller.js';
import { createExchangeAccountBodySchema, exchangeAccountIdParamsSchema } from './exchange-account.schema.js';

export const tradingRouter = Router();
tradingRouter.use(authenticate, authorize(UserRole.ADMIN));
tradingRouter.get('/overview', asyncHandler(overview));
tradingRouter.get('/exchange-accounts', asyncHandler(listAccounts));
tradingRouter.post('/exchange-accounts', validateRequest({ body: createExchangeAccountBodySchema }), asyncHandler(createAccount));
tradingRouter.post('/exchange-accounts/:id/test', validateRequest({ params: exchangeAccountIdParamsSchema }), asyncHandler(testAccount));
tradingRouter.get('/exchange-accounts/:id/balances', validateRequest({ params: exchangeAccountIdParamsSchema }), asyncHandler(balances));
tradingRouter.delete('/exchange-accounts/:id', validateRequest({ params: exchangeAccountIdParamsSchema }), asyncHandler(removeAccount));
