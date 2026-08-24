import type { Request, Response } from 'express';
import type { z } from 'zod';
import { success } from '../../utils/response.js';
import type { coinPerformanceQuerySchema } from './coin-performance.schema.js';
import { getCoinPerformance } from './coin-performance.service.js';

type Query = z.infer<typeof coinPerformanceQuerySchema>;
export async function coinPerformance(req: Request, res: Response) {
  const query = req.query as unknown as Query;
  return success(res, await getCoinPerformance(req.user!.id, { ...(query.symbol ? { symbol: query.symbol } : {}), ...(query.regime ? { regime: query.regime } : {}), limit: query.limit }));
}
