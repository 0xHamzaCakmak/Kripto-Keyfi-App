import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import { listFavoriteChannelIds, toggleFavoriteChannel } from './favorite.service.js';

export async function list(req: Request, res: Response) {
  return success(res, { channelIds: await listFavoriteChannelIds(req.user!.id) });
}

export async function toggle(req: Request, res: Response) {
  return success(res, { favorited: await toggleFavoriteChannel(req.user!.id, Number(req.params.channelId)) });
}
