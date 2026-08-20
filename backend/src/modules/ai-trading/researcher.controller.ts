import type { Request, Response } from 'express';
import type { z } from 'zod';
import { success } from '../../utils/response.js';
import type { researchHypothesesQuerySchema, runResearcherBodySchema } from './researcher.schema.js';
import { listResearchHypotheses, runResearcher } from './researcher.service.js';

type RunInput = z.infer<typeof runResearcherBodySchema>;
type ListQuery = z.infer<typeof researchHypothesesQuerySchema>;

export async function research(req: Request, res: Response) {
  return success(res, await runResearcher(req.user!.id, req.body as RunInput, req.ip));
}
export async function hypotheses(req: Request, res: Response) {
  return success(res, await listResearchHypotheses(req.user!.id, req.query as unknown as ListQuery));
}
