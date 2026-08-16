import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import { presentAdminVideo, presentVideo, presentYoutubeChannel } from './video.presenter.js';
import { createManualVideo, createYoutubeChannel, listAdminVideos, listPublishedVideos, listPublicYoutubeChannels, listYoutubeChannels, refreshVideoMetadata, restoreVideo, softDeleteVideo, updateVideoStatus, updateYoutubeChannelStatus } from './video.service.js';

export async function list(req: Request, res: Response) {
  const result = await listPublishedVideos({
    contentType: (req.query.type ?? req.query.content_type ?? 'all') as 'all' | 'long' | 'short',
    search: (req.query.search ?? req.query.creator) as string | undefined,
    channelId: req.query.channel_id as unknown as number | undefined,
    favoritesOnly: req.query.favorites_only as unknown as boolean,
    likedOnly: req.query.liked_only as unknown as boolean,
    userId: req.user?.id,
    page: req.query.page as unknown as number,
    limit: req.query.limit as unknown as number,
  });
  return success(res, { videos: result.videos.map(presentVideo), counts: result.counts, pagination: result.pagination });
}

export async function create(req: Request, res: Response) {
  const video = await createManualVideo(req.body.youtube_url, req.user!.id);
  return success(res, { video: presentAdminVideo(video) }, 201);
}

export async function adminList(req: Request, res: Response) {
  const videos = await listAdminVideos(req.query.include_deleted as unknown as boolean);
  return success(res, { videos: videos.map(presentAdminVideo) });
}

export async function updateStatus(req: Request, res: Response) {
  return success(res, { video: presentAdminVideo(await updateVideoStatus(Number(req.params.videoId), req.body.status, req.user!.id)) });
}

export async function remove(req: Request, res: Response) {
  return success(res, { video: presentAdminVideo(await softDeleteVideo(Number(req.params.videoId), req.user!.id)) });
}

export async function restore(req: Request, res: Response) {
  return success(res, { video: presentAdminVideo(await restoreVideo(Number(req.params.videoId), req.user!.id)) });
}

export async function refresh(req: Request, res: Response) {
  return success(res, { video: presentAdminVideo(await refreshVideoMetadata(Number(req.params.videoId), req.user!.id)) });
}

export async function listChannels(_req: Request, res: Response) {
  const channels = await listYoutubeChannels();
  return success(res, { channels: channels.map(presentYoutubeChannel) });
}

export async function listPublicChannels(_req: Request, res: Response) {
  return success(res, { channels: await listPublicYoutubeChannels() });
}

export async function createChannel(req: Request, res: Response) {
  const result = await createYoutubeChannel(req.body.channel_url, req.user!.id);
  return success(res, { channel: presentYoutubeChannel(result.channel), sync: result.sync }, 201);
}

export async function updateChannelStatus(req: Request, res: Response) {
  const channel = await updateYoutubeChannelStatus(Number(req.params.channelId), req.body.status);
  return success(res, { channel: presentYoutubeChannel(channel) });
}
