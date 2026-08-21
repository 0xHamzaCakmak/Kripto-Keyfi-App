import type { Request, Response } from 'express';
import type { z } from 'zod';
import { success } from '../../utils/response.js';
import type { runLiveEligibilityBodySchema } from './live-eligibility.schema.js';
import { runLiveEligibility } from './live-eligibility.service.js';

export async function evaluateLiveEligible(req: Request, res: Response) {
  return success(res, await runLiveEligibility(req.user!.id, req.body as z.infer<typeof runLiveEligibilityBodySchema>, req.ip), 201);
}
