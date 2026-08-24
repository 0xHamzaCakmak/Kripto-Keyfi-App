import type { Request, Response } from 'express';
import type { z } from 'zod';
import { success } from '../../utils/response.js';
import type { tradingUniverseAssetParamsSchema, updateTradingUniverseAssetSchema } from './trading-universe.schema.js';
import { getTradingUniverse, updateTradingUniverseAsset } from './trading-universe.service.js';

type Params = z.infer<typeof tradingUniverseAssetParamsSchema>;
type Body = z.infer<typeof updateTradingUniverseAssetSchema>;

export async function tradingUniverse(req: Request, res: Response) { return success(res, await getTradingUniverse(req.user!.id)); }
export async function changeTradingUniverseAsset(req: Request, res: Response) {
  const params = req.params as Params; const body = req.body as Body;
  return success(res, await updateTradingUniverseAsset(req.user!.id, params.symbol, body.enabled, req.ip));
}
