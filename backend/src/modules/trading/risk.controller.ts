import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import type { UpdateKillSwitchInput, UpdateRiskProfileInput } from './risk.schema.js';
import { getRiskProfile, listRiskEvents, updateKillSwitch, updateRiskProfile } from './risk.service.js';

export async function riskProfile(req: Request, res: Response) { return success(res, await getRiskProfile(req.user!.id, req.params.id as string)); }
export async function changeRiskProfile(req: Request, res: Response) { return success(res, await updateRiskProfile(req.user!.id, req.params.id as string, req.body as UpdateRiskProfileInput, req.ip)); }
export async function changeKillSwitch(req: Request, res: Response) { return success(res, await updateKillSwitch(req.user!.id, req.body as UpdateKillSwitchInput, req.ip)); }
export async function riskEvents(req: Request, res: Response) { return success(res, await listRiskEvents(req.user!.id, req.params.id as string)); }
