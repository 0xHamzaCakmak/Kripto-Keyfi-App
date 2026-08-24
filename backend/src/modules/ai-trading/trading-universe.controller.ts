import type { Request, Response } from 'express';
import type { z } from 'zod';
import { success } from '../../utils/response.js';
import type { addTradingUniverseAssetSchema, searchTradingUniverseSchema, tradingUniverseAssetParamsSchema, updateTradingUniverseAssetSchema } from './trading-universe.schema.js';
import { addTradingUniverseAsset, getTradingUniverse, searchTradingUniverse, updateTradingUniverseAsset } from './trading-universe.service.js';

type Params = z.infer<typeof tradingUniverseAssetParamsSchema>;
type Body = z.infer<typeof updateTradingUniverseAssetSchema>;
type SearchQuery = z.infer<typeof searchTradingUniverseSchema>;
type AddBody = z.infer<typeof addTradingUniverseAssetSchema>;

export async function tradingUniverse(req: Request, res: Response) { return success(res, await getTradingUniverse(req.user!.id)); }
export async function searchUniverse(req: Request, res: Response) {
  return success(res, await searchTradingUniverse(req.user!.id, req.query as unknown as SearchQuery));
}
export async function addUniverseAsset(req: Request, res: Response) {
  const body = req.body as AddBody;
  return success(res, await addTradingUniverseAsset(req.user!.id, body.symbol, req.ip), 201);
}
export async function changeTradingUniverseAsset(req: Request, res: Response) {
  const params = req.params as Params; const body = req.body as Body;
  return success(res, await updateTradingUniverseAsset(req.user!.id, params.symbol, body.enabled, req.ip));
}
