import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../../config/env.js';
import { verifyAccessToken } from '../../security/tokens.js';
import { logger } from '../../utils/logger.js';
import { joinRoomPayloadSchema, reactMessagePayloadSchema, sendMessagePayloadSchema } from './chat.schema.js';
import { createMessage, getRoomForJoin, getSocketUser, pruneRoomInBackground, toggleReaction } from './chat.service.js';

type ChatUser = NonNullable<Awaited<ReturnType<typeof getSocketUser>>>;
type Ack<T = unknown> = (response: { ok: true; data: T } | { ok: false; error: { code: string; message: string } }) => void;
type ClientEvents = {
  join_room: (payload: unknown, ack: Ack<{ room: unknown }>) => void;
  leave_room: (payload: unknown, ack: Ack) => void;
  send_message: (payload: unknown, ack: Ack) => void;
  react_message: (payload: unknown, ack: Ack<{ active: boolean }>) => void;
};
type ServerEvents = {
  new_message: (message: unknown) => void;
  reaction_updated: (payload: unknown) => void;
  presence_update: (payload: { roomSlug: string; users: ChatUser[] }) => void;
};
type SocketData = { user: ChatUser; roomSlug?: string };
const lastMessageByUser = new Map<string, number>();

function failure(error: unknown) {
  const candidate = error as { code?: string; message?: string };
  return { ok: false as const, error: { code: candidate.code ?? 'CHAT_ERROR', message: candidate.message ?? 'Sohbet işlemi tamamlanamadı.' } };
}

async function emitPresence(io: ChatIo, roomSlug: string) {
  // Presence is process-local. Configure the Socket.IO Redis adapter before running multiple backend instances.
  const sockets = await io.in(roomSlug).fetchSockets();
  const users = new Map<string, ChatUser>();
  for (const socket of sockets) if (socket.data.user) users.set(socket.data.user.id, socket.data.user);
  io.to(roomSlug).emit('presence_update', { roomSlug, users: [...users.values()] });
}

export type ChatIo = Server<ClientEvents, ServerEvents, Record<string, never>, SocketData>;

export function attachChatSocket(server: HttpServer) {
  const io: ChatIo = new Server(server, {
    path: '/socket.io',
    cors: { origin: env.FRONTEND_URL, credentials: true, methods: ['GET', 'POST'] },
    maxHttpBufferSize: 10_000,
  });

  io.use((socket, next) => {
    void (async () => {
      try {
        const token = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';
        if (!token) throw new Error('UNAUTHORIZED');
        const claims = await verifyAccessToken(token);
        const user = await getSocketUser(claims.sub);
        if (!user) throw new Error('UNAUTHORIZED');
        socket.data.user = user;
        next();
      } catch {
        const error = new Error('Sohbet bağlantısı için giriş yapmalısınız.') as Error & { data: { code: string } };
        error.data = { code: 'UNAUTHORIZED' };
        next(error);
      }
    })();
  });

  io.on('connection', (socket) => {
    socket.on('join_room', async (payload, ack) => {
      const parsed = joinRoomPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(failure({ code: 'VALIDATION_ERROR', message: 'Geçersiz oda.' }));
      try {
        const room = await getRoomForJoin(parsed.data.roomSlug);
        const previous = socket.data.roomSlug;
        if (previous && previous !== room.slug) {
          await socket.leave(previous);
          void emitPresence(io, previous);
        }
        await socket.join(room.slug);
        socket.data.roomSlug = room.slug;
        ack({ ok: true, data: { room: { slug: room.slug, status: room.status.toLowerCase() } } });
        void emitPresence(io, room.slug);
      } catch (error) { ack(failure(error)); }
    });

    socket.on('leave_room', async (payload, ack) => {
      const parsed = joinRoomPayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(failure({ code: 'VALIDATION_ERROR', message: 'Geçersiz oda.' }));
      await socket.leave(parsed.data.roomSlug);
      if (socket.data.roomSlug === parsed.data.roomSlug) delete socket.data.roomSlug;
      ack({ ok: true, data: {} });
      void emitPresence(io, parsed.data.roomSlug);
    });

    socket.on('send_message', async (payload, ack) => {
      const parsed = sendMessagePayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(failure({ code: 'VALIDATION_ERROR', message: 'Mesaj 1-2000 karakter olmalıdır.' }));
      if (!socket.rooms.has(parsed.data.roomSlug)) return ack(failure({ code: 'CHAT_ROOM_NOT_JOINED', message: 'Önce odaya katılmalısınız.' }));
      const now = Date.now();
      const lastMessageAt = lastMessageByUser.get(socket.data.user.id);
      if (lastMessageAt && now - lastMessageAt < 1_000) return ack(failure({ code: 'CHAT_RATE_LIMIT', message: 'Saniyede en fazla bir mesaj gönderebilirsiniz.' }));
      lastMessageByUser.set(socket.data.user.id, now);
      const cleanup = setTimeout(() => {
        if (lastMessageByUser.get(socket.data.user.id) === now) lastMessageByUser.delete(socket.data.user.id);
      }, 1_000);
      cleanup.unref();
      try {
        const result = await createMessage(parsed.data.roomSlug, socket.data.user.id, parsed.data.content);
        io.to(parsed.data.roomSlug).emit('new_message', result.message);
        ack({ ok: true, data: {} });
        pruneRoomInBackground(result.roomId, result.messageCount);
      } catch (error) { ack(failure(error)); }
    });

    socket.on('react_message', async (payload, ack) => {
      const parsed = reactMessagePayloadSchema.safeParse(payload);
      if (!parsed.success) return ack(failure({ code: 'VALIDATION_ERROR', message: 'Geçersiz reaksiyon.' }));
      const roomSlug = socket.data.roomSlug;
      if (!roomSlug || !socket.rooms.has(roomSlug)) return ack(failure({ code: 'CHAT_ROOM_NOT_JOINED', message: 'Önce odaya katılmalısınız.' }));
      try {
        const result = await toggleReaction(BigInt(parsed.data.messageId), socket.data.user.id, parsed.data.reactionType, roomSlug);
        io.to(result.roomSlug).emit('reaction_updated', { messageId: result.messageId, reactions: result.reactions });
        ack({ ok: true, data: { active: result.active } });
      } catch (error) { ack(failure(error)); }
    });

    socket.on('disconnecting', () => {
      const roomSlug = socket.data.roomSlug;
      if (roomSlug) setTimeout(() => { void emitPresence(io, roomSlug); }, 0);
    });
  });

  io.engine.on('connection_error', (error) => logger.debug({ code: error.code }, 'chat socket connection error'));
  return io;
}
