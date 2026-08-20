import type { Request, Response } from 'express';
import type { z } from 'zod';
import { success } from '../../utils/response.js';
import type { tradeMemoryQuerySchema, tradeMemorySummaryQuerySchema } from './trade-memory.schema.js';
import { listTradeMemory, summarizeTradeMemory } from './trade-memory.service.js';

type MemoryQuery = z.infer<typeof tradeMemoryQuerySchema>;
type SummaryQuery = z.infer<typeof tradeMemorySummaryQuerySchema>;

export async function tradeMemory(req: Request, res: Response) {
  return success(res, await listTradeMemory(req.user!.id, req.query as unknown as MemoryQuery));
}

export async function tradeMemorySummary(req: Request, res: Response) {
  return success(res, await summarizeTradeMemory(req.user!.id, req.query as unknown as SummaryQuery));
}
