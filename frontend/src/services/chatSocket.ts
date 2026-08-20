import { io, type Socket } from 'socket.io-client';
import type { ChatReaction, ChatUser } from '../types';
import { getAccessToken } from './apiClient';
import { restoreSession } from './authService';
import { mapChatMessage, mapChatUser, type ApiChatMessage, type ApiChatUser } from './chatService';

type Ack<T = unknown> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };
type ServerEvents = {
  new_message: (message: ApiChatMessage) => void;
  reaction_updated: (payload: { messageId: string; reactions: Array<{ type: string; count: number }> }) => void;
  presence_update: (payload: { roomSlug: string; users: ApiChatUser[] }) => void;
};
type ClientEvents = {
  join_room: (payload: { roomSlug: string }, ack: (response: Ack<{ room: { slug: string; status: string } }>) => void) => void;
  leave_room: (payload: { roomSlug: string }, ack: (response: Ack) => void) => void;
  send_message: (payload: { roomSlug: string; content: string }, ack: (response: Ack) => void) => void;
  react_message: (payload: { messageId: string; reactionType: string }, ack: (response: Ack<{ active: boolean }>) => void) => void;
};

let socket: Socket<ServerEvents, ClientEvents> | null = null;
let refreshing = false;

export function getChatSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
      path: '/socket.io', autoConnect: false, transports: ['websocket', 'polling'],
      auth: (callback) => callback({ token: getAccessToken() }),
      reconnection: true, reconnectionDelay: 600, reconnectionDelayMax: 5_000,
    });
    socket.on('connect_error', (error) => {
      const code = (error as Error & { data?: { code?: string } }).data?.code;
      if (code !== 'UNAUTHORIZED' || refreshing) return;
      refreshing = true;
      void restoreSession().then(() => socket?.connect()).catch(() => undefined).finally(() => { refreshing = false; });
    });
  }
  if (!socket.connected) socket.connect();
  return socket;
}

export function disconnectChatSocket() {
  socket?.disconnect();
}

function emitWithAck<T>(event: keyof ClientEvents, payload: object) {
  return new Promise<T>((resolve, reject) => {
    const callback = (response: Ack<T>) => {
      if ('error' in response) reject(new Error(response.error.message));
      else resolve(response.data);
    };
    (getChatSocket().emit as (event: string, payload: object, callback: (response: Ack<T>) => void) => Socket)(event, payload, callback);
  });
}

export const joinChatRoom = (roomSlug: string) => emitWithAck<{ room: { slug: string; status: string } }>('join_room', { roomSlug });
export const leaveChatRoom = (roomSlug: string) => emitWithAck('leave_room', { roomSlug });
export const sendChatMessage = (roomSlug: string, content: string) => emitWithAck('send_message', { roomSlug, content });
export const reactToChatMessage = (messageId: string, reactionType: string) => emitWithAck<{ active: boolean }>('react_message', { messageId, reactionType });
export const mapSocketMessage = mapChatMessage;
export const mapSocketUsers = (users: ApiChatUser[]): ChatUser[] => users.map(mapChatUser);
export const mapSocketReactions = (items: Array<{ type: string; count: number }>): ChatReaction[] => items.map((item) => ({ id: item.type, label: { useful: 'Faydalı', quality: 'Kaliteli analiz', alpha: 'Alpha', security: 'Güvenlik uyarısı' }[item.type] ?? item.type, count: item.count }));
