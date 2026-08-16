import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import type { AdminUserListQuery } from './admin-user.schema.js';
import { listAdminUsers } from './admin-user.service.js';

export async function list(req: Request, res: Response) {
  return success(res, await listAdminUsers(req.query as unknown as AdminUserListQuery));
}
