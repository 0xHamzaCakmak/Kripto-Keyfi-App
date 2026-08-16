import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import { presentVideo, presentYoutubeChannel } from './video.presenter.js';
import { createManualVideo, createYoutubeChannel, listPublishedVideos, listYoutubeChannels, updateYoutubeChannelStatus } from './video.service.js';

export async function list(req: Request, res: Response) {
  const result = await listPublishedVideos(req.query.content_type as 'all' | 'long' | 'short', req.query.creator as string | undefined);
  return success(res, { videos: result.videos.map(presentVideo), counts: result.counts });
}

export async function create(req: Request, res: Response) {
  const video = await createManualVideo(req.body.youtube_url, req.user!.id);
  return success(res, { video: presentVideo(video) }, 201);
}

export async function listChannels(_req: Request, res: Response) {
  const channels = await listYoutubeChannels();
  return success(res, { channels: channels.map(presentYoutubeChannel) });
}

export async function createChannel(req: Request, res: Response) {
  const result = await createYoutubeChannel(req.body.channel_url, req.user!.id);
  return success(res, { channel: presentYoutubeChannel(result.channel), sync: result.sync }, 201);
}

export async function updateChannelStatus(req: Request, res: Response) {
  const channel = await updateYoutubeChannelStatus(Number(req.params.channelId), req.body.status);
  return success(res, { channel: presentYoutubeChannel(channel) });
}
