import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import type { AdminUserListQuery, CreateAdminUserInput } from './admin-user.schema.js';
import { createAdminUser, listAdminUsers } from './admin-user.service.js';

export async function list(req: Request, res: Response) {
  return success(res, await listAdminUsers(req.query as unknown as AdminUserListQuery));
}

export async function create(req: Request, res: Response) {
  return success(res, { user: await createAdminUser(req.body as CreateAdminUserInput, req.user!.id) }, 201);
}
