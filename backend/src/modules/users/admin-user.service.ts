import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../security/password.js';
import { ApiError } from '../../utils/api-error.js';
import type { AdminUserListQuery, CreateAdminUserInput } from './admin-user.schema.js';

const roleMap = { admin: UserRole.ADMIN, user: UserRole.USER } as const;
const statusMap = {
  active: UserStatus.ACTIVE,
  pending: UserStatus.PENDING,
  passive: UserStatus.PASSIVE,
  suspended: UserStatus.SUSPENDED,
  deleted: UserStatus.DELETED,
} as const;

const adminUserSelect = {
  id: true,
  email: true,
  username: true,
  name: true,
  avatarUrl: true,
  role: true,
  status: true,
  createdAt: true,
  lastLoginAt: true,
} satisfies Prisma.UserSelect;

type SelectedAdminUser = Prisma.UserGetPayload<{ select: typeof adminUserSelect }>;

function presentAdminUser(user: SelectedAdminUser) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role.toLowerCase(),
    status: user.status.toLowerCase(),
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

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
      select: adminUserSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);
  return {
    users: users.map(presentAdminUser),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function createAdminUser(input: CreateAdminUserInput, adminId: string) {
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: {
          email: input.email,
          username: input.username,
          name: input.display_name,
          passwordHash,
          role: roleMap[input.role],
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
          mustChangePassword: true,
          createdByAdminId: adminId,
        },
        select: adminUserSelect,
      });
      await transaction.userAdminAuditLog.create({
        data: {
          userId: created.id,
          adminId,
          action: 'created',
          changes: { source: 'admin', role: input.role },
        },
      });
      return created;
    });
    return presentAdminUser(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : String(error.meta?.target ?? '');
      if (target.includes('username')) throw new ApiError(409, 'Bu kullanıcı adı kullanılıyor.', 'USERNAME_EXISTS');
      throw new ApiError(409, 'Bu e-posta adresiyle daha önce hesap oluşturulmuş.', 'EMAIL_EXISTS');
    }
    throw error;
  }
}
