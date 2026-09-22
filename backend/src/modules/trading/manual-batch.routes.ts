import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler.js';
import { success } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';
import { batchCandidates, batchInputSchema, confirmBatch, getBatch, previewBatch } from './manual-batch.service.js';
import { runManualBatch } from './manual-batch.worker.js';

export const manualBatchRouter = Router();
const accountQuery = z.object({ exchangeAccountId: z.string().cuid() }).strict();
manualBatchRouter.get('/candidates', asyncHandler(async (req, res) => success(res, await batchCandidates(req.user!.id, accountQuery.parse(req.query).exchangeAccountId))));
manualBatchRouter.post('/preview', asyncHandler(async (req, res) => success(res, await previewBatch(req.user!.id, batchInputSchema.parse(req.body)), 201)));
manualBatchRouter.get('/:id', asyncHandler(async (req, res) => success(res, await getBatch(req.user!.id, z.string().uuid().parse(req.params.id), accountQuery.parse(req.query).exchangeAccountId))));
manualBatchRouter.post('/:id/confirm', asyncHandler(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const result = await confirmBatch(req.user!.id, id, accountQuery.parse(req.body).exchangeAccountId);
  setImmediate(() => void runManualBatch(id).catch(error => logger.error({ batchId: id, error }, 'Toplu manuel işlem hemen başlatılamadı')));
  return success(res, result);
}));
