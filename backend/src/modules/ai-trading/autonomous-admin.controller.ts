import type { Request, Response } from 'express';
import type { z } from 'zod';
import { success } from '../../utils/response.js';
import {
  activateAutonomousTestnet, archiveCandidate, configureBotCapital, configureNonCriticalBotSettings, getArenaStatus, getAutonomousOverview,
  listGenerations, listLiveEligibilityStatus, pauseAutonomousBot, resumeAutonomousBot, reviewPromotion, startAutonomousBot, triggerPaperGeneration,
} from './autonomous-admin.service.js';
import type {
  autonomousGenerationQuerySchema, botCapitalSchema, createAutonomousPaperBotSchema, nonCriticalBotSettingsSchema,
  promotionReviewSchema, testnetActivationSchema, triggerPaperGenerationSchema,
} from './autonomous-admin.schema.js';
import { autonomousDTO } from './autonomous-admin.service.js';
import { createFactoryBot } from './bot-factory.service.js';
import { getTestnetBotOperation, listTestnetBotOperations } from './testnet-operations.service.js';

export async function autonomousOverview(req: Request, res: Response) { return success(res, await getAutonomousOverview(req.user!.id)); }
export async function arenaStatus(req: Request, res: Response) { return success(res, await getArenaStatus(req.user!.id)); }
export async function generations(req: Request, res: Response) {
  const query = req.query as unknown as z.infer<typeof autonomousGenerationQuerySchema>;
  return success(res, await listGenerations(req.user!.id, query.limit));
}
export async function liveEligibilityStatus(req: Request, res: Response) { return success(res, await listLiveEligibilityStatus(req.user!.id)); }
export async function triggerGeneration(req: Request, res: Response) {
  return success(res, await triggerPaperGeneration(req.user!.id, req.body as z.infer<typeof triggerPaperGenerationSchema>, req.ip), 201);
}
export async function createPaperBot(req: Request, res: Response) {
  const bot = await createFactoryBot(req.user!.id, req.body as z.infer<typeof createAutonomousPaperBotSchema>, req.ip);
  return success(res, autonomousDTO('AUTONOMOUS_BOT', bot), 201);
}
export async function pausePaperBot(req: Request, res: Response) { return success(res, await pauseAutonomousBot(req.user!.id, req.params.id as string, req.ip)); }
export async function startPaperBot(req: Request, res: Response) { return success(res, await startAutonomousBot(req.user!.id, req.params.id as string, req.ip)); }
export async function resumePaperBot(req: Request, res: Response) { return success(res, await resumeAutonomousBot(req.user!.id, req.params.id as string, req.ip)); }
export async function archive(req: Request, res: Response) { return success(res, await archiveCandidate(req.user!.id, req.params.id as string, req.ip)); }
export async function promotion(req: Request, res: Response) {
  return success(res, await reviewPromotion(req.user!.id, req.params.id as string, req.body as z.infer<typeof promotionReviewSchema>, req.ip));
}
export async function settings(req: Request, res: Response) {
  return success(res, await configureNonCriticalBotSettings(req.user!.id, req.params.id as string, req.body as z.infer<typeof nonCriticalBotSettingsSchema>, req.ip));
}
export async function capital(req: Request, res: Response) {
  return success(res, await configureBotCapital(req.user!.id, req.params.id as string, req.body as z.infer<typeof botCapitalSchema>, req.ip));
}
export async function activateTestnet(req: Request, res: Response) {
  return success(res, await activateAutonomousTestnet(req.user!.id, req.params.id as string, req.body as z.infer<typeof testnetActivationSchema>, req.ip));
}
export async function testnetOperations(req: Request, res: Response) { return success(res, await listTestnetBotOperations(req.user!.id)); }
export async function testnetBotOperation(req: Request, res: Response) { return success(res, await getTestnetBotOperation(req.user!.id, req.params.id as string)); }
