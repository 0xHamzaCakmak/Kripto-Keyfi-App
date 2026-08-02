import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import type { UpdateMeInput } from './user.schema.js';
import * as userService from './user.service.js';

export async function updateMe(req: Request<object, object, UpdateMeInput>, res: Response) {
  return success(res, { user: await userService.updateMe(req.user!.id, req.body) });
}
