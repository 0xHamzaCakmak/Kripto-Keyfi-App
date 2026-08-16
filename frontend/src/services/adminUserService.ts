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
  lastLoginAt: string | null;
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
