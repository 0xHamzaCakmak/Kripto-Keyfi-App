import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import type { CancelOrderInput, ClosePositionInput, PreviewOrderInput, SubmitOrderInput } from './manual-trading.schema.js';
import { cancelOpenOrder, closePosition, createOrderPreview, listOpenOrders, listPositions, listSymbols, submitOrder } from './manual-trading.service.js';

export async function symbols(req: Request, res: Response) { return success(res, await listSymbols(req.user!.id, req.query.exchangeAccountId as string)); }
export async function preview(req: Request, res: Response) { return success(res, await createOrderPreview(req.user!.id, req.body as PreviewOrderInput), 201); }
export async function submit(req: Request, res: Response) { return success(res, await submitOrder(req.user!.id, req.body as SubmitOrderInput, req.ip), 201); }
export async function orders(req: Request, res: Response) { return success(res, await listOpenOrders(req.user!.id, req.query.exchangeAccountId as string)); }
export async function cancel(req: Request, res: Response) { return success(res, await cancelOpenOrder(req.user!.id, req.params.id as string, req.body as CancelOrderInput, req.ip)); }
export async function positions(req: Request, res: Response) { return success(res, await listPositions(req.user!.id, req.query.exchangeAccountId as string)); }
export async function close(req: Request, res: Response) { return success(res, await closePosition(req.user!.id, req.params.id as string, req.body as ClosePositionInput, req.ip)); }
