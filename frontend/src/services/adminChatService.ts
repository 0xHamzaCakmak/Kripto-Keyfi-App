import { api } from './apiClient';

export type AdminChatRoom = { id: number; slug: string; name: string; category: string; icon: string | null; displayOrder: number; status: 'active' | 'closed' | 'hidden'; messageCount: number };
export type ChatRoomInput = { slug: string; name: string; category: string; icon: string | null; displayOrder: number };

export async function getAdminChatRooms() {
  const response = await api.get<{ data: { rooms: AdminChatRoom[] } }>('/admin/chat/rooms');
  return response.data.data.rooms;
}
export async function createAdminChatRoom(input: ChatRoomInput) {
  const response = await api.post<{ data: { room: AdminChatRoom } }>('/admin/chat/rooms', input);
  return response.data.data.room;
}
export async function updateAdminChatRoom(id: number, input: ChatRoomInput) {
  const response = await api.patch<{ data: { room: AdminChatRoom } }>(`/admin/chat/rooms/${id}`, input);
  return response.data.data.room;
}
export async function updateAdminChatRoomStatus(id: number, status: AdminChatRoom['status']) {
  const response = await api.patch<{ data: { room: AdminChatRoom } }>(`/admin/chat/rooms/${id}/status`, { status: status.toUpperCase() });
  return response.data.data.room;
}
