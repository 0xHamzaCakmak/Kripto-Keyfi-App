import type { Request, Response } from 'express';
import type { z } from 'zod';
import { success } from '../../utils/response.js';
import type { createCrossoverBodySchema, crossoversQuerySchema } from './crossover.schema.js';
import { createCrossover, listCrossovers } from './crossover.service.js';

export async function cross(req: Request, res: Response) { return success(res, await createCrossover(req.user!.id, req.body as z.infer<typeof createCrossoverBodySchema>, req.ip), 201); }
export async function crossovers(req: Request, res: Response) { return success(res, await listCrossovers(req.user!.id, req.query as unknown as z.infer<typeof crossoversQuerySchema>)); }
