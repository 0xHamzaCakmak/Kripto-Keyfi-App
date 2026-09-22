import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler.js';
import { success } from '../../utils/response.js';
import { gridDemoConfirmSchema, gridDemoInputSchema } from './grid-demo.schema.js';
import { controlDemoGrid, gridDemoConfirm, gridDemoPreview, gridDemoSymbols, listDemoGrids } from './grid-demo.service.js';

export const gridDemoRouter = Router();
const accountQuery = z.object({ exchangeAccountId: z.string().min(1) }).strict();
gridDemoRouter.get('/symbols', asyncHandler(async (req, res) => success(res, await gridDemoSymbols(req.user!.id, accountQuery.parse(req.query).exchangeAccountId))));
gridDemoRouter.get('/', asyncHandler(async (req, res) => success(res, await listDemoGrids(req.user!.id, accountQuery.parse(req.query).exchangeAccountId))));
gridDemoRouter.post('/preview', asyncHandler(async (req, res) => success(res, await gridDemoPreview(req.user!.id, gridDemoInputSchema.parse(req.body)), 201)));
gridDemoRouter.post('/confirm', asyncHandler(async (req, res) => {
  const input = gridDemoConfirmSchema.parse(req.body);
  return success(res, await gridDemoConfirm(req.user!.id, input.previewId, input.exchangeAccountId));
}));
gridDemoRouter.post('/:id/control', asyncHandler(async (req, res) => {
  const input = z.object({ exchangeAccountId: z.string().min(1), action: z.enum(['PAUSE', 'RESUME', 'CLOSE']) }).strict().parse(req.body);
  return success(res, await controlDemoGrid(req.user!.id, z.string().uuid().parse(req.params.id), input.exchangeAccountId, input.action));
}));
