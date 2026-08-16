import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import { presentVideo } from './video.presenter.js';
import { createManualVideo, listPublishedVideos } from './video.service.js';

export async function list(_req: Request, res: Response) {
  const videos = await listPublishedVideos();
  return success(res, { videos: videos.map(presentVideo) });
}

export async function create(req: Request, res: Response) {
  const video = await createManualVideo(req.body.youtube_url, req.user!.id);
  return success(res, { video: presentVideo(video) }, 201);
}
