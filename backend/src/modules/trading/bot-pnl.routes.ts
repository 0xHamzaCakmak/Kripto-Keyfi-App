import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/async-handler.js';
import { success } from '../../utils/response.js';
import { getBotPnl, getPnlDayDetails, resetBotPnl } from './bot-pnl.service.js';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(`${v}T00:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v; }, 'Geçerli tarih seçin.');
export const pnlQuery = z.object({ exchangeAccountId: z.string().min(1), start: date, end: date }).strict().refine(v => v.end >= v.start && Date.parse(v.end) - Date.parse(v.start) <= 365 * 86400000, 'Tarih aralığı en fazla 366 gün olabilir.');
export const botPnlRouter = Router();
botPnlRouter.get('/details', asyncHandler(async (req, res) => {
  const q = z.object({ exchangeAccountId: z.string().min(1), date }).strict().parse(req.query);
  return success(res, await getPnlDayDetails(req.user!.id, q.exchangeAccountId, q.date));
}));
botPnlRouter.get('/', asyncHandler(async (req, res) => {
  const q = pnlQuery.parse(req.query);
  const report = await getBotPnl(req.user!.id, q.exchangeAccountId, q.start, q.end);
  return success(res, report);
}));
botPnlRouter.post('/reset', asyncHandler(async (req, res) => { const q = z.object({ exchangeAccountId: z.string().min(1), confirmation: z.literal('SIFIRLA') }).strict().parse(req.body); return success(res, await resetBotPnl(req.user!.id, q.exchangeAccountId)); }));
