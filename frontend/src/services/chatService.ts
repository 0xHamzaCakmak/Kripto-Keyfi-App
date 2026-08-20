import type { ChatChannel, ChatMessage, ChatNewsItem, ChatReaction, ChatUser } from '../types';
import { api } from './apiClient';

export type ApiChatUser = { id: string; name: string; username: string; avatar: string | null; role: string };
export type ApiChatMessage = { id: string; roomSlug: string; userId: string; content: string; createdAt: string; user: ApiChatUser; reactions: Array<{ type: string; count: number }> };
type ApiRoom = { id: number; slug: string; name: string; category: string; icon: string | null; displayOrder: number; status: 'active' | 'closed'; messageCount: number };

const reactionLabels: Record<string, string> = { useful: 'Faydalı', quality: 'Kaliteli analiz', alpha: 'Alpha', security: 'Güvenlik uyarısı' };

export function mapChatUser(user: ApiChatUser): ChatUser {
  return { id: user.id, name: user.name, avatar: user.avatar || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.username)}`, role: user.role, badge: user.role, isOnline: true, reputation: 0 };
}

export function mapChatMessage(message: ApiChatMessage): ChatMessage {
  return {
    id: message.id, userId: message.userId, channelId: message.roomSlug, text: message.content, createdAt: message.createdAt,
    user: mapChatUser(message.user), reactions: message.reactions.map((reaction): ChatReaction => ({ id: reaction.type, label: reactionLabels[reaction.type] ?? reaction.type, count: reaction.count })),
  };
}

export async function getChatRooms() {
  const response = await api.get<{ data: { rooms: ApiRoom[] } }>('/chat/rooms');
  return response.data.data.rooms.map((room): ChatChannel => ({ id: room.slug, name: room.name, group: room.category, status: room.status, messageCount: room.messageCount }));
}

export async function getChatMessages(roomSlug: string, before?: string) {
  const response = await api.get<{ data: { messages: ApiChatMessage[]; nextCursor: string | null } }>(`/chat/rooms/${roomSlug}/messages`, { params: { limit: 50, before } });
  return { messages: response.data.data.messages.map(mapChatMessage), nextCursor: response.data.data.nextCursor };
}

export const CHAT_NEWS: ChatNewsItem[] = [
  { id: 'cn1', title: 'Bitcoin ETF girişlerinde artış', slug: 'bitcoin-etf-girisleri-piyasada-yeni-beklenti-olusturdu', category: 'Bitcoin', publishedAt: '10 dk önce' },
  { id: 'cn2', title: 'Ethereum Layer-2 işlem hacmi yükseldi', slug: 'ethereum-layer-2-aglarinda-islem-hacmi-artiyor', category: 'Ethereum', publishedAt: '22 dk önce' },
  { id: 'cn3', title: 'Büyük borsadan yeni listeleme duyurusu', slug: 'buyuk-borsadan-yeni-altcoin-listeleme-duyurusu', category: 'Borsa', publishedAt: '41 dk önce' },
];
export function getChatNews() { return CHAT_NEWS; }
