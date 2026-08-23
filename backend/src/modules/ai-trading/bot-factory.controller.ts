import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import type {
  CloneFactoryBotInput,
  CreateFactoryBotInput,
  CreateParameterVariantInput,
  TransitionFactoryBotInput,
} from './bot-factory.schema.js';
import {
  cloneFactoryBot,
  createFactoryBot,
  createParameterVariant,
  getFactoryBot,
  getFactoryBotPaperPerformance,
  listFactoryBots,
  transitionFactoryBot,
} from './bot-factory.service.js';

export async function factoryBots(req: Request, res: Response) {
  return success(res, await listFactoryBots(req.user!.id));
}

export async function factoryBot(req: Request, res: Response) {
  return success(res, await getFactoryBot(req.user!.id, req.params.id as string));
}

export async function factoryBotPaperPerformance(req: Request, res: Response) {
  return success(res, await getFactoryBotPaperPerformance(req.user!.id, req.params.id as string));
}

export async function create(req: Request, res: Response) {
  return success(res, await createFactoryBot(req.user!.id, req.body as CreateFactoryBotInput, req.ip), 201);
}

export async function clone(req: Request, res: Response) {
  return success(res, await cloneFactoryBot(
    req.user!.id,
    req.params.id as string,
    req.body as CloneFactoryBotInput,
    req.ip,
  ), 201);
}

export async function parameterVariant(req: Request, res: Response) {
  return success(res, await createParameterVariant(
    req.user!.id,
    req.params.id as string,
    req.body as CreateParameterVariantInput,
    req.ip,
  ), 201);
}

export async function transition(req: Request, res: Response) {
  const body = req.body as TransitionFactoryBotInput;
  return success(res, await transitionFactoryBot(req.user!.id, req.params.id as string, body.status, req.ip));
}
