import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import type { AdminUserListQuery, CreateAdminUserInput, ResetAdminUserPasswordInput, UpdateAdminUserInput } from './admin-user.schema.js';
import { createAdminUser, getAdminUser, getAdminUserProfileSections, listAdminUsers, resetAdminUserPassword, restoreAdminUser, softDeleteAdminUser, updateAdminUser } from './admin-user.service.js';

export async function list(req: Request, res: Response) {
  return success(res, await listAdminUsers(req.query as unknown as AdminUserListQuery));
}

export async function create(req: Request, res: Response) {
  return success(res, { user: await createAdminUser(req.body as CreateAdminUserInput, req.user!.id) }, 201);
}

export async function detail(req: Request, res: Response) {
  return success(res, { user: await getAdminUser(String(req.params.id)) });
}

export async function profileSections(req: Request, res: Response) {
  return success(res, { sections: await getAdminUserProfileSections(String(req.params.id)) });
}

export async function update(req: Request, res: Response) {
  return success(res, { user: await updateAdminUser(String(req.params.id), req.body as UpdateAdminUserInput, req.user!.id) });
}

export async function resetPassword(req: Request, res: Response) {
  await resetAdminUserPassword(String(req.params.id), (req.body as ResetAdminUserPasswordInput).new_password, req.user!.id);
  return success(res, { reset: true });
}

export async function remove(req: Request, res: Response) {
  await softDeleteAdminUser(String(req.params.id), req.user!.id);
  return success(res, { deleted: true });
}

export async function restore(req: Request, res: Response) {
  return success(res, { user: await restoreAdminUser(String(req.params.id), req.user!.id) });
}
