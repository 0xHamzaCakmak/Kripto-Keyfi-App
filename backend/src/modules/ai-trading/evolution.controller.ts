import type { Request, Response } from 'express';
import type { z } from 'zod';
import { success } from '../../utils/response.js';
import type { evolutionRunsQuerySchema, runEvolutionBodySchema } from './evolution.schema.js';
import { listEvolutionRuns, runEvolution } from './evolution.service.js';

export async function evolve(req: Request, res: Response) { return success(res, await runEvolution(req.user!.id, req.body as z.infer<typeof runEvolutionBodySchema>, req.ip), 201); }
export async function runs(req: Request, res: Response) { return success(res, await listEvolutionRuns(req.user!.id, req.query as unknown as z.infer<typeof evolutionRunsQuerySchema>)); }
