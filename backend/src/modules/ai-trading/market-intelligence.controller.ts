import type { Request, Response } from 'express';
import type { z } from 'zod';
import { success } from '../../utils/response.js';
import type { marketContextQuerySchema } from './market-intelligence.schema.js';
import { getMarketContext } from './market-intelligence.service.js';

export async function marketContext(req: Request, res: Response) {
  return success(res, await getMarketContext(req.query as unknown as z.infer<typeof marketContextQuerySchema>));
}
