import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { AdminUserListQuery } from './admin-user.schema.js';

const roleMap = { admin: UserRole.ADMIN, user: UserRole.USER } as const;
const statusMap = {
  active: UserStatus.ACTIVE,
  pending: UserStatus.PENDING,
  passive: UserStatus.PASSIVE,
  suspended: UserStatus.SUSPENDED,
  deleted: UserStatus.DELETED,
} as const;

export async function listAdminUsers(query: AdminUserListQuery) {
  const { search, status, role, page, limit } = query;
  const conditions: Prisma.UserWhereInput[] = [];
  if (search) conditions.push({ OR: [
    { email: { contains: search } },
    { username: { contains: search } },
    { name: { contains: search } },
  ] });
  conditions.push(status ? { status: statusMap[status] } : { status: { not: UserStatus.DELETED } });
  if (role) conditions.push({ role: roleMap[role] });
  const where: Prisma.UserWhereInput = { AND: conditions };
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatarUrl: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);
  return {
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role.toLowerCase(),
      status: user.status.toLowerCase(),
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
