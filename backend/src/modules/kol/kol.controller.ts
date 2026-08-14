import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import * as service from './kol.service.js';
import { getKOLDataSources } from './providers/kol-data-provider.js';

export async function list(req: Request, res: Response) { return success(res, await service.listKOLs(req.query as never)); }
export async function detail(req: Request, res: Response) { return success(res, await service.getKOL(req.params.slug as string)); }
export async function campaigns(req: Request, res: Response) { return success(res, await service.listCompanyCampaigns(req.user!.id)); }
export async function companies(req: Request, res: Response) { return success(res, await service.listCompanies(req.user!.id)); }
export async function createCompany(req: Request, res: Response) { return success(res, await service.createCompany(req.user!.id, req.body), 201); }
export async function createCampaign(req: Request, res: Response) { return success(res, await service.createCampaign(req.user!.id, req.body), 201); }
export async function campaignDetail(req: Request, res: Response) { return success(res, await service.getCampaign(req.user!.id, req.params.id as string)); }
export async function campaignStatus(req: Request, res: Response) { return success(res, await service.updateCampaignStatus(req.user!.id, req.params.id as string, req.body.status)); }
export async function campaignMatches(req: Request, res: Response) { return success(res, await service.getCampaignMatches(req.user!.id, req.params.id as string)); }
export async function assignKOL(req: Request, res: Response) { return success(res, await service.assignKOL(req.user!.id, req.params.id as string, req.body), 201); }
export async function analytics(req: Request, res: Response) { return success(res, await service.getCampaignAnalytics(req.user!.id, req.params.id as string)); }
export async function event(req: Request, res: Response) { return success(res, await service.ingestEvent(req.body), 202); }
export async function redirect(req: Request, res: Response) { return res.redirect(302, await service.resolveTrackingRedirect(req.params.code as string)); }
export async function adminList(req: Request, res: Response) { return success(res, await service.adminListKOLs()); }
export async function adminCreate(req: Request, res: Response) { return success(res, await service.createKOL(req.user!.id, req.body), 201); }
export async function adminCampaigns(_req: Request, res: Response) { return success(res, await service.adminListCampaigns()); }
export async function adminCampaignStatus(req: Request, res: Response) { return success(res, await service.adminUpdateCampaignStatus(req.user!.id, req.params.id as string, req.body.status)); }
export async function adminUpdate(req: Request, res: Response) { return success(res, await service.updateKOL(req.user!.id, req.params.id as string, req.body)); }
export async function adminSocial(req: Request, res: Response) { return success(res, await service.addSocialAccount(req.user!.id, req.params.id as string, req.body), 201); }
export async function adminScore(req: Request, res: Response) { return success(res, await service.addScore(req.user!.id, req.params.id as string, req.body), 201); }
export async function adminRecalculate(req: Request, res: Response) { return success(res, await service.recalculateScore(req.user!.id, req.params.id as string), 201); }
export async function adminPrediction(req: Request, res: Response) { return success(res, await service.addPrediction(req.user!.id, req.params.id as string, req.body), 201); }
export async function adminEvaluate(req: Request, res: Response) { return success(res, await service.evaluatePrediction(req.user!.id, req.params.id as string, req.params.predictionId as string, req.body)); }
export async function adminRisk(req: Request, res: Response) { return success(res, await service.addRiskEvent(req.user!.id, req.params.id as string, req.body), 201); }
export async function adminAudience(req: Request, res: Response) { return success(res, await service.addAudienceMetric(req.user!.id, req.params.id as string, req.body), 201); }
export async function kolDashboard(req: Request, res: Response) { return success(res, await service.getKOLDashboard(req.user!.id)); }
export async function adminDataSources(_req: Request, res: Response) { return success(res, getKOLDataSources()); }
