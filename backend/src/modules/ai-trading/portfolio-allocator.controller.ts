import type { Request, Response } from 'express';
import type { z } from 'zod';
import { success } from '../../utils/response.js';
import type { portfolioAllocationQuerySchema, portfolioAllocatorBodySchema } from './portfolio-allocator.schema.js';
import { createPortfolioAllocation, listPortfolioAllocations } from './portfolio-allocator.service.js';

export async function allocate(req: Request, res: Response) {
  return success(res, await createPortfolioAllocation(req.user!.id, req.body as z.infer<typeof portfolioAllocatorBodySchema>, req.ip), 201);
}

export async function allocations(req: Request, res: Response) {
  return success(res, await listPortfolioAllocations(req.user!.id, req.query as unknown as z.infer<typeof portfolioAllocationQuerySchema>));
}
