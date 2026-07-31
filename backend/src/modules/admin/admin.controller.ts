import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import { getDashboard } from './admin.service.js';

export async function dashboard(_req: Request, res: Response) {
  return success(res, await getDashboard());
}

