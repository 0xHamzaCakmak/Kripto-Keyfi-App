import type { Request, Response } from 'express';
import type { z } from 'zod';
import { success } from '../../utils/response.js';
import type { runTeacherBodySchema, teacherEvaluationsQuerySchema } from './teacher.schema.js';
import { listTeacherEvaluations, runTeacherEvaluation } from './teacher.service.js';

type RunInput = z.infer<typeof runTeacherBodySchema>;
type ListQuery = z.infer<typeof teacherEvaluationsQuerySchema>;

export async function evaluate(req: Request, res: Response) {
  return success(res, await runTeacherEvaluation(req.user!.id, req.body as RunInput, req.ip));
}

export async function evaluations(req: Request, res: Response) {
  return success(res, await listTeacherEvaluations(req.user!.id, req.query as unknown as ListQuery));
}
