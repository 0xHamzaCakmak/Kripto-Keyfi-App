import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import { calculateYoutubeChannelScores, getYoutubeScoreOverview, updateYoutubeScoreWeights } from './youtube-score.service.js';

export async function overview(_req: Request, res: Response) {
  return success(res, await getYoutubeScoreOverview());
}

export async function recalculate(_req: Request, res: Response) {
  await calculateYoutubeChannelScores();
  return success(res, await getYoutubeScoreOverview());
}

export async function updateWeights(req: Request, res: Response) {
  return success(res, await updateYoutubeScoreWeights(req.body, req.user!.id));
}
