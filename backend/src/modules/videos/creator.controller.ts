import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import { presentVideo, presentYoutubeChannel } from './video.presenter.js';
import { addCreatorVideo, connectMyYoutubeChannel, getMyCreatorState, listCreatorApplications, reviewCreatorApplication, submitCreatorApplication } from './creator.service.js';
import { trackEvent } from '../analytics/analytics-events.service.js';

function presentCapability(capability: { status: string; appliedAt: Date; approvedAt: Date | null; rejectedAt: Date | null } | null) {
  return capability ? { status: capability.status.toLowerCase(), appliedAt: capability.appliedAt.toISOString(), approvedAt: capability.approvedAt?.toISOString() ?? null, rejectedAt: capability.rejectedAt?.toISOString() ?? null } : { status: 'not_applied', appliedAt: null, approvedAt: null, rejectedAt: null };
}

export async function myState(req: Request, res: Response) {
  const state = await getMyCreatorState(req.user!.id);
  return success(res, { channel: state.channel ? presentYoutubeChannel(state.channel) : null, application: presentCapability(state.capability) });
}

export async function connectChannel(req: Request, res: Response) {
  const channel = await connectMyYoutubeChannel(req.user!.id, req.body.channel_url);
  await trackEvent('youtube_connect', { userId: req.user!.id, sessionId: req.user!.sessionId, pagePath: '/profile', metadata: { channel_id: channel.id } });
  return success(res, { channel: presentYoutubeChannel(channel) }, 201);
}

export async function apply(req: Request, res: Response) {
  const application = await submitCreatorApplication(req.user!.id);
  await trackEvent('creator_application', { userId: req.user!.id, sessionId: req.user!.sessionId, pagePath: '/profile' });
  return success(res, { application: presentCapability(application) }, 201);
}

export async function addVideo(req: Request, res: Response) {
  const video = await addCreatorVideo(req.user!.id, req.body.youtube_url);
  return success(res, { video: presentVideo(video) }, 201);
}

export async function listApplications(_req: Request, res: Response) {
  const applications = await listCreatorApplications();
  return success(res, { applications: applications.map((item) => ({
    user: { id: item.user.id, name: item.user.name, username: item.user.username, email: item.user.email, avatarUrl: item.user.avatarUrl },
    channel: item.user.ownedYoutubeChannel ? presentYoutubeChannel(item.user.ownedYoutubeChannel) : null,
    application: presentCapability(item),
  })) });
}

export async function review(req: Request, res: Response) {
  const result = await reviewCreatorApplication(String(req.params.userId), req.body.status);
  return success(res, { application: presentCapability(result.capability), sync: result.sync });
}
