import { UserRole } from '@prisma/client';
import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { asyncHandler } from '../../utils/async-handler.js';
import * as controller from './chat.controller.js';
import { createRoomBodySchema, messagesQuerySchema, roomIdParamsSchema, roomParamsSchema, updateRoomBodySchema, updateRoomStatusBodySchema } from './chat.schema.js';

export const chatRouter = Router();
chatRouter.use(authenticate);
chatRouter.get('/rooms', asyncHandler(controller.rooms));
chatRouter.get('/rooms/:slug/messages', validateRequest({ params: roomParamsSchema, query: messagesQuerySchema }), asyncHandler(controller.messages));

export const adminChatRouter = Router();
adminChatRouter.use(authenticate, authorize(UserRole.ADMIN));
adminChatRouter.get('/rooms', asyncHandler(controller.adminRooms));
adminChatRouter.post('/rooms', validateRequest({ body: createRoomBodySchema }), asyncHandler(controller.createRoom));
adminChatRouter.patch('/rooms/:id', validateRequest({ params: roomIdParamsSchema, body: updateRoomBodySchema }), asyncHandler(controller.updateRoom));
adminChatRouter.patch('/rooms/:id/status', validateRequest({ params: roomIdParamsSchema, body: updateRoomStatusBodySchema }), asyncHandler(controller.updateRoomStatus));
