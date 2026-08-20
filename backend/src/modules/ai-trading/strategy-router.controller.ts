import type { Request, Response } from 'express';
import type { z } from 'zod';
import { success } from '../../utils/response.js';
import type { routeStrategyBodySchema } from './strategy-router.schema.js';
import { routeStrategies } from './strategy-router.service.js';

export async function routeStrategy(req: Request, res: Response) {
  return success(res, await routeStrategies(req.user!.id, req.body as z.infer<typeof routeStrategyBodySchema>, req.ip), 201);
}
