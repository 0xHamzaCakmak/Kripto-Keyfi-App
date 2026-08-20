import type { Request, Response } from 'express';
import type { z } from 'zod';
import { success } from '../../utils/response.js';
import type { createMutationBodySchema, mutationsQuerySchema } from './mutation.schema.js';
import { createMutation, listMutations } from './mutation.service.js';

export async function mutate(req: Request, res: Response) {
  return success(res, await createMutation(req.user!.id, req.body as z.infer<typeof createMutationBodySchema>, req.ip), 201);
}
export async function mutations(req: Request, res: Response) {
  return success(res, await listMutations(req.user!.id, req.query as unknown as z.infer<typeof mutationsQuerySchema>));
}
