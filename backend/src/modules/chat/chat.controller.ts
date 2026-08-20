import type { Request, Response } from 'express';
import { success } from '../../utils/response.js';
import * as service from './chat.service.js';

export async function rooms(_req: Request, res: Response) { return success(res, { rooms: await service.listRooms() }); }
export async function messages(req: Request, res: Response) { return success(res, await service.listMessages(String(req.params.slug), req.query as never)); }
export async function adminRooms(_req: Request, res: Response) { return success(res, { rooms: await service.listRooms(true) }); }
export async function createRoom(req: Request, res: Response) { return success(res, { room: await service.createRoom(req.user!.id, req.body) }, 201); }
export async function updateRoom(req: Request, res: Response) { return success(res, { room: await service.updateRoom(Number(req.params.id), req.body) }); }
export async function updateRoomStatus(req: Request, res: Response) { return success(res, { room: await service.updateRoomStatus(Number(req.params.id), req.body.status) }); }
