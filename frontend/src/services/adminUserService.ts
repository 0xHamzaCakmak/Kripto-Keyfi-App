import { api } from './apiClient';

export type AdminUserListItem = {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'admin' | 'user';
  status: 'active' | 'pending' | 'passive' | 'suspended' | 'deleted';
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  notes: string | null;
  mustChangePassword: boolean;
  createdByAdminId: string | null;
};

export type AdminUserPagination = { page: number; limit: number; total: number; totalPages: number };

type Result<T> = { data: T };

export async function getAdminUsers(filters: {
  search?: string;
  status?: AdminUserListItem['status'];
  role?: AdminUserListItem['role'];
  page?: number;
  limit?: number;
}) {
  const response = await api.get<Result<{ users: AdminUserListItem[]; pagination: AdminUserPagination }>>('/admin/users', {
    params: {
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.role ? { role: filters.role } : {}),
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    },
  });
  return response.data.data;
}

export async function createAdminUser(input: {
  email: string;
  username: string;
  displayName: string;
  password: string;
  role: AdminUserListItem['role'];
}) {
  const response = await api.post<Result<{ user: AdminUserListItem }>>('/admin/users', {
    email: input.email,
    username: input.username,
    display_name: input.displayName,
    password: input.password,
    role: input.role,
  });
  return response.data.data.user;
}

export async function getAdminUser(id: string) {
  const response = await api.get<Result<{ user: AdminUserListItem }>>(`/admin/users/${id}`);
  return response.data.data.user;
}

export async function updateAdminUser(id: string, input: {
  email?: string;
  username?: string;
  displayName?: string;
  role?: AdminUserListItem['role'];
  status?: Exclude<AdminUserListItem['status'], 'deleted'>;
  notes?: string | null;
}) {
  const response = await api.patch<Result<{ user: AdminUserListItem }>>(`/admin/users/${id}`, {
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.username !== undefined ? { username: input.username } : {}),
    ...(input.displayName !== undefined ? { display_name: input.displayName } : {}),
    ...(input.role !== undefined ? { role: input.role } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  });
  return response.data.data.user;
}

export async function resetAdminUserPassword(id: string, newPassword: string) {
  await api.post(`/admin/users/${id}/reset-password`, { new_password: newPassword });
}

export async function deleteAdminUser(id: string) {
  await api.delete(`/admin/users/${id}`);
}

export async function restoreAdminUser(id: string) {
  const response = await api.post<Result<{ user: AdminUserListItem }>>(`/admin/users/${id}/restore`);
  return response.data.data.user;
}
