import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import type { AnalyticsEventName } from './analytics-events.service.js';
import { trackEvent } from './analytics-events.service.js';
import * as service from './analytics.service.js';

export async function record(req: Request, res: Response) {
  await trackEvent(req.body.eventName, { userId: req.user?.id, sessionId: req.body.sessionId ?? req.user?.sessionId, pagePath: req.body.pagePath, metadata: req.body.metadata });
  return success(res, { accepted: true }, 202);
}
export async function overview(req: Request, res: Response) { return success(res, await service.getOverview(req.query.range as never, req.query.start as string | undefined, req.query.end as string | undefined)); }
export async function pages(req: Request, res: Response) { return success(res, await service.getTrafficMetrics('pages', req.query.range as never, req.query.start as string | undefined, req.query.end as string | undefined)); }
export async function referrers(req: Request, res: Response) { return success(res, await service.getTrafficMetrics('referrers', req.query.range as never, req.query.start as string | undefined, req.query.end as string | undefined)); }
export async function devices(req: Request, res: Response) { return success(res, await service.getTrafficMetrics('devices', req.query.range as never, req.query.start as string | undefined, req.query.end as string | undefined)); }
export async function funnel(req: Request, res: Response) { return success(res, await service.getFunnel(req.query.steps as unknown as AnalyticsEventName[])); }
export async function content(req: Request, res: Response) { return success(res, await service.getContent(req.query.event_name as never, req.query.range as never, req.query.start as string | undefined, req.query.end as string | undefined)); }
