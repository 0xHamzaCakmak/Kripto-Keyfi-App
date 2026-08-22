import type { Request, Response } from 'express';
import type { z } from 'zod';
import { success } from '../../utils/response.js';
import type { tradeMemoryQuerySchema, tradeMemoryStatsQuerySchema, tradeMemorySummaryQuerySchema } from './trade-memory.schema.js';
import { getTradeMemoryStats, listTradeMemory, summarizeTradeMemory } from './trade-memory.service.js';

type MemoryQuery = z.infer<typeof tradeMemoryQuerySchema>;
type SummaryQuery = z.infer<typeof tradeMemorySummaryQuerySchema>;
type StatsQuery = z.infer<typeof tradeMemoryStatsQuerySchema>;

export async function tradeMemory(req: Request, res: Response) {
  return success(res, await listTradeMemory(req.user!.id, req.query as unknown as MemoryQuery));
}

export async function tradeMemorySummary(req: Request, res: Response) {
  return success(res, await summarizeTradeMemory(req.user!.id, req.query as unknown as SummaryQuery));
}
export async function tradeMemoryStats(req: Request, res: Response) {
  return success(res, await getTradeMemoryStats(req.user!.id, req.query as unknown as StatsQuery));
}
