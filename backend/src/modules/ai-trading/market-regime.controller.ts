import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import type { MarketRegime } from './core-domain.js';
import { getRegimeLeaderboard } from './market-regime.service.js';

export async function regimeLeaderboard(req: Request, res: Response) {
  return success(res, await getRegimeLeaderboard(
    req.user!.id,
    req.params.regime as MarketRegime,
    Number(req.query.limit),
  ));
}
