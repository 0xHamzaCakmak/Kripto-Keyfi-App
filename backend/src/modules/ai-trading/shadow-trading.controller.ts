import type { Request, Response } from 'express';
import type { z } from 'zod';
import { success } from '../../utils/response.js';
import type { shadowSummaryQuerySchema, shadowTradesQuerySchema } from './shadow-trading.schema.js';
import { getShadowPerformance, listShadowTrades } from './shadow-trading.service.js';

export async function shadowTrades(req: Request, res: Response) {
  return success(res, await listShadowTrades(req.user!.id, req.query as unknown as z.infer<typeof shadowTradesQuerySchema>));
}
export async function shadowPerformance(req: Request, res: Response) {
  return success(res, await getShadowPerformance(req.user!.id, req.query as unknown as z.infer<typeof shadowSummaryQuerySchema>));
}
