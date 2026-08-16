import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import { calculateYoutubeChannelScores } from './youtube-score.service.js';

export async function recalculate(_req: Request, res: Response) {
  return success(res, await calculateYoutubeChannelScores());
}
