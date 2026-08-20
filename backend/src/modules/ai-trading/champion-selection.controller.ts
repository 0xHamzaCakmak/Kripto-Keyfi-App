import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import type { ChampionSelectionConfig } from './champion-selection.schema.js';
import { listChampionCandidates, runChampionSelection } from './champion-selection.service.js';

export async function evaluateChampions(req: Request, res: Response) {
  return success(res, await runChampionSelection(req.user!.id, req.body as ChampionSelectionConfig, req.ip));
}
export async function champions(req: Request, res: Response) {
  return success(res, await listChampionCandidates(req.user!.id));
}
