import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import type { z } from 'zod';
import type { leaderboardQuerySchema } from './bot-score.schema.js';
import { getBotLeaderboard, getBotScore } from './bot-score.service.js';

type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

export async function leaderboard(req: Request, res: Response) {
  const query = req.query as unknown as LeaderboardQuery;
  return success(res, await getBotLeaderboard(req.user!.id, query.limit));
}

export async function score(req: Request, res: Response) {
  return success(res, await getBotScore(req.user!.id, req.params.id as string));
}
