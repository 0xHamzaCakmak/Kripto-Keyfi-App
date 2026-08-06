import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import * as newsService from './news.service.js';
import * as analyticsService from './news-analytics.service.js';
import { getNewsOperations } from './news-operations.service.js';

export async function list(req: Request, res: Response) { return success(res, await newsService.listNews(req.query as never)); }
export async function detail(req: Request, res: Response) { return success(res, await newsService.getNewsBySlug(req.params.slug as string, undefined, req.query.trackView !== 'false')); }
export async function save(req: Request, res: Response) { await newsService.saveArticle(req.user!.id, req.params.articleId as string); return success(res, { saved: true }); }
export async function unsave(req: Request, res: Response) { await newsService.unsaveArticle(req.user!.id, req.params.articleId as string); return success(res, { saved: false }); }
export async function recordAnalytics(req: Request, res: Response) { return success(res, await analyticsService.recordNewsAnalytics(req.body), 202); }
export async function listSources(_req: Request, res: Response) { return success(res, { sources: await newsService.listSources() }); }
export async function createSource(req: Request, res: Response) { return success(res, { source: await newsService.createSource(req.body) }, 201); }
export async function updateSource(req: Request, res: Response) { return success(res, { source: await newsService.updateSource(req.params.sourceId as string, req.body) }); }
export async function listAdminArticles(req: Request, res: Response) { return success(res, { articles: await newsService.listAdminArticles(req.query as never) }); }
export async function updateArticleStatus(req: Request, res: Response) { return success(res, { article: await newsService.updateArticleStatus(req.params.articleId as string, req.body) }); }
export async function updateArticleContent(req: Request, res: Response) { return success(res, { article: await newsService.updateArticleContent(req.params.articleId as string, req.body) }); }
export async function relocalizeArticle(req: Request, res: Response) { return success(res, await newsService.relocalizeArticle(req.params.articleId as string)); }
export async function createArticleAiDraft(req: Request, res: Response) { return success(res, { draft: await newsService.createArticleAiDraft(req.params.articleId as string) }); }
export async function newsOperations(_req: Request, res: Response) { return success(res, await getNewsOperations()); }
export async function analyticsReport(req: Request, res: Response) { return success(res, await analyticsService.getNewsAnalyticsReport(req.query as never)); }
