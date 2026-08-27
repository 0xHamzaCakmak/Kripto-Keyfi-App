import type { Request, Response } from 'express';
import type { z } from 'zod';
import { success } from '../../utils/response.js';
import type { aiMentorPerformanceQuerySchema } from './ai-mentor-performance.schema.js';
import { getAIMentorPerformance } from './ai-mentor-performance.service.js';

type Query = z.infer<typeof aiMentorPerformanceQuerySchema>;
export async function aiMentorPerformance(req: Request, res: Response) {
  const query = req.query as unknown as Query;
  return success(res, await getAIMentorPerformance(req.user!.id, query.days));
}
