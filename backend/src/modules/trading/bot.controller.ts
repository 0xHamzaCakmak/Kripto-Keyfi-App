import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import type { CreateBotInput, GridPlanPreviewInput } from './bot.schema.js';
import { createBot, emergencyStopBot, getPaperPerformance, listBotDecisions, listBotSignals, listBots, pauseBot, resumeBot, startBot, stopBot, validateBot } from './bot.service.js';
import { getStoredGridPlan, previewGridPlan } from './grid-plan.service.js';

export async function bots(req: Request, res: Response) { return success(res, await listBots(req.user!.id)); }
export async function decisions(req: Request, res: Response) { return success(res, await listBotDecisions(req.user!.id, req.params.id as string)); }
export async function signals(req: Request, res: Response) { return success(res, await listBotSignals(req.user!.id, req.params.id as string)); }
export async function paperPerformance(req: Request, res: Response) { return success(res, await getPaperPerformance(req.user!.id, req.params.id as string)); }
export async function gridPlanPreview(req: Request, res: Response) { return success(res, await previewGridPlan(req.user!.id, req.body as GridPlanPreviewInput)); }
export async function gridPlan(req: Request, res: Response) { return success(res, await getStoredGridPlan(req.user!.id, req.params.id as string)); }
export async function create(req: Request, res: Response) { return success(res, await createBot(req.user!.id, req.body as CreateBotInput, req.ip), 201); }
export async function validate(req: Request, res: Response) { return success(res, await validateBot(req.user!.id, req.params.id as string, req.ip)); }
export async function start(req: Request, res: Response) { return success(res, await startBot(req.user!.id, req.params.id as string, req.ip)); }
export async function pause(req: Request, res: Response) { return success(res, await pauseBot(req.user!.id, req.params.id as string, req.ip)); }
export async function resume(req: Request, res: Response) { return success(res, await resumeBot(req.user!.id, req.params.id as string, req.ip)); }
export async function stop(req: Request, res: Response) { return success(res, await stopBot(req.user!.id, req.params.id as string, req.ip)); }
export async function emergencyStop(req: Request, res: Response) { return success(res, await emergencyStopBot(req.user!.id, req.params.id as string, req.ip)); }
