import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import { listVideoReactions, toggleVideoReaction } from './video-reaction.service.js';

export async function list(req: Request, res: Response) {
  return success(res, { reactions: await listVideoReactions(req.user!.id) });
}

export async function toggle(req: Request, res: Response) {
  const reaction = await toggleVideoReaction(req.user!.id, Number(req.params.videoId), req.body.reaction);
  return success(res, { reaction });
}
