import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import { getTradingOverview } from './trading.service.js';

export async function overview(req: Request, res: Response) {
  return success(res, await getTradingOverview(req.user!.id));
}
