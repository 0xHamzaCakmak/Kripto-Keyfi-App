import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';

export function placeholder(_req: Request, res: Response) {
  return success(res, { message: 'User module is ready for a later phase' });
}

