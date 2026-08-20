import { ChatRoomStatus } from '@prisma/client';
import { z } from 'zod';

export const CHAT_REACTIONS = ['useful', 'quality', 'alpha', 'security'] as const;
export const roomSlugSchema = z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const roomParamsSchema = z.object({ slug: roomSlugSchema });
export const roomIdParamsSchema = z.object({ id: z.coerce.number().int().positive() });
export const messagesQuerySchema = z.object({
  before: z.string().regex(/^\d+$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const createRoomBodySchema = z.object({
  slug: roomSlugSchema,
  name: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(50),
  icon: z.string().trim().max(50).nullable().optional(),
  displayOrder: z.coerce.number().int().min(0).max(10_000).default(0),
}).strict();
export const updateRoomBodySchema = createRoomBodySchema.partial().strict().refine((value) => Object.keys(value).length > 0, 'En az bir alan güncellenmelidir.');
export const updateRoomStatusBodySchema = z.object({ status: z.nativeEnum(ChatRoomStatus) }).strict();

export const joinRoomPayloadSchema = z.object({ roomSlug: roomSlugSchema }).strict();
export const sendMessagePayloadSchema = z.object({ roomSlug: roomSlugSchema, content: z.string().trim().min(1).max(2_000) }).strict();
export const reactMessagePayloadSchema = z.object({ messageId: z.string().regex(/^\d+$/), reactionType: z.enum(CHAT_REACTIONS) }).strict();

export type CreateRoomInput = z.infer<typeof createRoomBodySchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomBodySchema>;
export type ChatReactionType = typeof CHAT_REACTIONS[number];
