import { ChatRoomStatus, Prisma, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { logger } from '../../utils/logger.js';
import type { ChatReactionType, CreateRoomInput, UpdateRoomInput } from './chat.schema.js';

export const CHAT_PRUNE_THRESHOLD = 1_100;
export const CHAT_PRUNE_BATCH = 100;
const pruningRooms = new Map<number, Promise<void>>();

const userSelect = {
  id: true, username: true, name: true, avatarUrl: true, role: true,
  profileRoles: { where: { role: { isActive: true } }, select: { role: { select: { name: true } } }, take: 1 },
} satisfies Prisma.UserSelect;

type ChatUserRecord = Prisma.UserGetPayload<{ select: typeof userSelect }>;
const messageInclude = { user: { select: userSelect }, reactions: { select: { reactionType: true } } } satisfies Prisma.ChatMessageInclude;
type ChatMessageRecord = Prisma.ChatMessageGetPayload<{ include: typeof messageInclude }>;

export function sanitizeChatContent(content: string) {
  return content.trim().replace(/[<>]/g, '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

export function presentChatUser(user: ChatUserRecord) {
  return {
    id: user.id,
    name: user.name?.trim() || user.username,
    username: user.username,
    avatar: user.avatarUrl,
    role: user.role === UserRole.ADMIN ? 'Moderator' : user.profileRoles[0]?.role.name ?? 'Yeni Üye',
  };
}

export function presentMessage(message: ChatMessageRecord) {
  const counts = new Map<string, number>();
  for (const reaction of message.reactions) counts.set(reaction.reactionType, (counts.get(reaction.reactionType) ?? 0) + 1);
  return {
    id: message.id.toString(),
    userId: message.userId, content: message.content, createdAt: message.createdAt.toISOString(),
    user: presentChatUser(message.user),
    reactions: [...counts].map(([type, count]) => ({ type, count })),
  };
}

export function presentRoom(room: { id: number; slug: string; name: string; category: string; icon: string | null; displayOrder: number; status: ChatRoomStatus; messageCount: number }) {
  return { id: room.id, slug: room.slug, name: room.name, category: room.category, icon: room.icon, displayOrder: room.displayOrder, status: room.status.toLowerCase(), messageCount: room.messageCount };
}

export async function getSocketUser(userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, status: UserStatus.ACTIVE }, select: userSelect });
  return user ? presentChatUser(user) : null;
}

export async function listRooms(includeHidden = false) {
  const rooms = await prisma.chatRoom.findMany({
    where: includeHidden ? {} : { status: { not: ChatRoomStatus.HIDDEN } },
    orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
  });
  return rooms.map(presentRoom);
}

export async function getRoomForJoin(slug: string) {
  const room = await prisma.chatRoom.findUnique({ where: { slug } });
  if (!room || room.status === ChatRoomStatus.HIDDEN) throw new ApiError(404, 'Sohbet odası bulunamadı.', 'CHAT_ROOM_NOT_FOUND');
  return room;
}

export async function listMessages(slug: string, input: { before?: string; limit: number }) {
  const room = await getRoomForJoin(slug);
  const messages = await prisma.chatMessage.findMany({
    where: { roomId: room.id, ...(input.before ? { id: { lt: BigInt(input.before) } } : {}) },
    include: messageInclude, orderBy: { id: 'desc' }, take: input.limit,
  });
  const items = messages.reverse().map((message) => ({ ...presentMessage(message), roomSlug: room.slug }));
  return { room: presentRoom(room), messages: items, nextCursor: messages.length === input.limit ? messages[0]?.id.toString() ?? null : null };
}

export async function createMessage(roomSlug: string, userId: string, rawContent: string) {
  const content = sanitizeChatContent(rawContent);
  if (!content) throw new ApiError(400, 'Mesaj boş olamaz.', 'CHAT_EMPTY_MESSAGE');
  const room = await prisma.chatRoom.findUnique({ where: { slug: roomSlug }, select: { id: true, slug: true, status: true } });
  if (!room || room.status === ChatRoomStatus.HIDDEN) throw new ApiError(404, 'Sohbet odası bulunamadı.', 'CHAT_ROOM_NOT_FOUND');
  if (room.status === ChatRoomStatus.CLOSED) throw new ApiError(409, 'Bu oda salt okunur durumda.', 'CHAT_ROOM_CLOSED');

  const result = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.chatRoom.updateMany({ where: { id: room.id, status: ChatRoomStatus.ACTIVE }, data: { messageCount: { increment: 1 } } });
    if (updated.count !== 1) throw new ApiError(409, 'Bu oda salt okunur durumda.', 'CHAT_ROOM_CLOSED');
    const message = await transaction.chatMessage.create({ data: { roomId: room.id, userId, content }, include: messageInclude });
    const counter = await transaction.chatRoom.findUniqueOrThrow({ where: { id: room.id }, select: { messageCount: true } });
    return { message, messageCount: counter.messageCount };
  });
  return { message: { ...presentMessage(result.message), roomSlug }, roomId: room.id, messageCount: result.messageCount };
}

export function pruneRoomInBackground(roomId: number, messageCount: number) {
  if (messageCount < CHAT_PRUNE_THRESHOLD || pruningRooms.has(roomId)) return;
  const task = pruneRoom(roomId).catch((error) => logger.error({ err: error, roomId }, 'chat retention pruning failed')).finally(() => pruningRooms.delete(roomId));
  pruningRooms.set(roomId, task);
}

export async function pruneRoom(roomId: number) {
  await prisma.$transaction(async (transaction) => {
    const oldest = await transaction.chatMessage.findMany({ where: { roomId }, orderBy: { id: 'asc' }, take: CHAT_PRUNE_BATCH, select: { id: true } });
    if (oldest.length < CHAT_PRUNE_BATCH) return;
    const deleted = await transaction.chatMessage.deleteMany({ where: { id: { in: oldest.map((item) => item.id) }, roomId } });
    await transaction.chatRoom.update({ where: { id: roomId }, data: { messageCount: { decrement: deleted.count } } });
  });
}

export async function reconcileChatMessageCounts() {
  const [rooms, counts] = await Promise.all([
    prisma.chatRoom.findMany({ select: { id: true, messageCount: true } }),
    prisma.chatMessage.groupBy({ by: ['roomId'], _count: { _all: true } }),
  ]);
  const actual = new Map(counts.map((item) => [item.roomId, item._count._all]));
  const drifted = rooms.filter((room) => room.messageCount !== (actual.get(room.id) ?? 0));
  await prisma.$transaction(drifted.map((room) => prisma.chatRoom.update({ where: { id: room.id }, data: { messageCount: actual.get(room.id) ?? 0 } })));
  return drifted.length;
}

export function scheduleChatReconciliation() {
  const interval = setInterval(() => { void reconcileChatMessageCounts().then((corrected) => corrected && logger.info({ corrected }, 'chat message counters reconciled')).catch((error) => logger.error({ err: error }, 'chat reconciliation failed')); }, 24 * 60 * 60 * 1000);
  interval.unref();
  return () => clearInterval(interval);
}

export async function toggleReaction(messageId: bigint, userId: string, reactionType: ChatReactionType, roomSlug: string) {
  return prisma.$transaction(async (transaction) => {
    const message = await transaction.chatMessage.findFirst({ where: { id: messageId, room: { slug: roomSlug } }, include: { room: { select: { slug: true, status: true } } } });
    if (!message || message.room.status === ChatRoomStatus.HIDDEN) throw new ApiError(404, 'Mesaj bulunamadı.', 'CHAT_MESSAGE_NOT_FOUND');
    const key = { messageId_userId_reactionType: { messageId, userId, reactionType } };
    const existing = await transaction.chatMessageReaction.findUnique({ where: key, select: { id: true } });
    if (existing) await transaction.chatMessageReaction.delete({ where: { id: existing.id } });
    else await transaction.chatMessageReaction.create({ data: { messageId, userId, reactionType } });
    const grouped = await transaction.chatMessageReaction.groupBy({ by: ['reactionType'], where: { messageId }, _count: { _all: true } });
    return { roomSlug: message.room.slug, messageId: messageId.toString(), active: !existing, reactions: grouped.map((item) => ({ type: item.reactionType, count: item._count._all })) };
  });
}

export async function createRoom(adminId: string, input: CreateRoomInput) {
  try {
    return presentRoom(await prisma.chatRoom.create({ data: { ...input, icon: input.icon || null, createdById: adminId } }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError(409, 'Bu oda adresi zaten kullanılıyor.', 'CHAT_ROOM_SLUG_EXISTS');
    throw error;
  }
}

export async function updateRoom(id: number, input: UpdateRoomInput) {
  const data: Prisma.ChatRoomUpdateInput = {
    ...(input.slug === undefined ? {} : { slug: input.slug }),
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.category === undefined ? {} : { category: input.category }),
    ...(input.icon === undefined ? {} : { icon: input.icon || null }),
    ...(input.displayOrder === undefined ? {} : { displayOrder: input.displayOrder }),
  };
  try { return presentRoom(await prisma.chatRoom.update({ where: { id }, data })); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new ApiError(404, 'Sohbet odası bulunamadı.', 'CHAT_ROOM_NOT_FOUND');
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError(409, 'Bu oda adresi zaten kullanılıyor.', 'CHAT_ROOM_SLUG_EXISTS');
    throw error;
  }
}

export async function updateRoomStatus(id: number, status: ChatRoomStatus) {
  try { return presentRoom(await prisma.chatRoom.update({ where: { id }, data: { status } })); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new ApiError(404, 'Sohbet odası bulunamadı.', 'CHAT_ROOM_NOT_FOUND');
    throw error;
  }
}
