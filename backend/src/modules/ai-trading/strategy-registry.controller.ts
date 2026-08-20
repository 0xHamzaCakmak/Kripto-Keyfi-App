import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import type {
  CreateStrategyInput,
  CreateStrategyVersionInput,
  ValidateStrategyParametersInput,
} from './strategy-registry.schema.js';
import {
  createStrategy,
  createStrategyVersion,
  getStrategy,
  listStrategies,
  validateStrategyParameters,
} from './strategy-registry.service.js';

export async function strategies(req: Request, res: Response) {
  return success(res, await listStrategies(req.user!.id));
}

export async function strategy(req: Request, res: Response) {
  return success(res, await getStrategy(req.user!.id, req.params.id as string));
}

export async function create(req: Request, res: Response) {
  return success(res, await createStrategy(req.user!.id, req.body as CreateStrategyInput), 201);
}

export async function createVersion(req: Request, res: Response) {
  return success(res, await createStrategyVersion(req.user!.id, req.params.id as string, req.body as CreateStrategyVersionInput), 201);
}

export async function validateParameters(req: Request, res: Response) {
  return success(res, await validateStrategyParameters(
    req.user!.id,
    req.params.id as string,
    req.body as ValidateStrategyParametersInput,
  ));
}
