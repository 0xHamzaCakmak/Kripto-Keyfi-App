import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../security/password.js';
import { ApiError } from '../../utils/api-error.js';
import type { AdminUserListQuery, CreateAdminUserInput, UpdateAdminUserInput } from './admin-user.schema.js';

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
  updatedAt: true,
  lastLoginAt: true,
  notes: true,
  mustChangePassword: true,
  createdByAdminId: true,
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
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    notes: user.notes,
    mustChangePassword: user.mustChangePassword,
    createdByAdminId: user.createdByAdminId,
  };
}

function notFound(): never {
  throw new ApiError(404, 'Kullanıcı bulunamadı.', 'USER_NOT_FOUND');
}

function uniqueConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : String(error.meta?.target ?? '');
    if (target.includes('username')) throw new ApiError(409, 'Bu kullanıcı adı kullanılıyor.', 'USERNAME_EXISTS');
    throw new ApiError(409, 'Bu e-posta adresiyle daha önce hesap oluşturulmuş.', 'EMAIL_EXISTS');
  }
  throw error;
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
        data: { userId: created.id, adminId, action: 'created', changes: { source: 'admin', role: input.role } },
      });
      return created;
    });
    return presentAdminUser(user);
  } catch (error) {
    uniqueConflict(error);
  }
}

export async function getAdminUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, select: adminUserSelect });
  if (!user) notFound();
  return presentAdminUser(user);
}

export async function updateAdminUser(id: string, input: UpdateAdminUserInput, adminId: string) {
  const current = await prisma.user.findUnique({ where: { id }, select: adminUserSelect });
  if (!current) notFound();
  if (current.status === UserStatus.DELETED) throw new ApiError(409, 'Silinmiş kullanıcı düzenlenemez; önce geri yükleyin.', 'USER_DELETED');
  if (id === adminId && (input.role === 'user' || (input.status && input.status !== 'active'))) {
    throw new ApiError(409, 'Kendi admin rolünüzü veya aktif durumunuzu değiştiremezsiniz.', 'SELF_ADMIN_PROTECTED');
  }

  const requested: Record<string, string | null> = {
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.username !== undefined ? { username: input.username } : {}),
    ...(input.display_name !== undefined ? { name: input.display_name } : {}),
    ...(input.role !== undefined ? { role: roleMap[input.role] } : {}),
    ...(input.status !== undefined ? { status: statusMap[input.status] } : {}),
    ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
  };
  const changes: Record<string, Prisma.InputJsonObject> = {};
  for (const [field, value] of Object.entries(requested)) {
    const oldValue = current[field as keyof SelectedAdminUser];
    if (oldValue !== value) changes[field === 'name' ? 'display_name' : field] = {
      old: typeof oldValue === 'string' && (field === 'role' || field === 'status') ? oldValue.toLowerCase() : oldValue,
      new: typeof value === 'string' && (field === 'role' || field === 'status') ? value.toLowerCase() : value,
    } as Prisma.InputJsonObject;
  }
  if (Object.keys(changes).length === 0) return presentAdminUser(current);

  try {
    const updated = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.update({ where: { id }, data: requested, select: adminUserSelect });
      if ((input.status && input.status !== 'active') || (input.role && input.role !== current.role.toLowerCase())) {
        await transaction.refreshSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }
      await transaction.userAdminAuditLog.create({ data: { userId: id, adminId, action: 'updated', changes } });
      return user;
    });
    return presentAdminUser(updated);
  } catch (error) {
    uniqueConflict(error);
  }
}

export async function resetAdminUserPassword(id: string, newPassword: string, adminId: string) {
  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!exists) notFound();
  if (exists.status === UserStatus.DELETED) throw new ApiError(409, 'Silinmiş kullanıcının şifresi sıfırlanamaz.', 'USER_DELETED');
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true } });
    await transaction.refreshSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await transaction.userAdminAuditLog.create({ data: { userId: id, adminId, action: 'password_reset' } });
  });
}

export async function softDeleteAdminUser(id: string, adminId: string) {
  if (id === adminId) throw new ApiError(409, 'Kendi hesabınızı silemezsiniz.', 'SELF_ADMIN_PROTECTED');
  const current = await prisma.user.findUnique({ where: { id }, select: { status: true } });
  if (!current) notFound();
  if (current.status === UserStatus.DELETED) throw new ApiError(409, 'Kullanıcı zaten silinmiş.', 'USER_ALREADY_DELETED');
  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({ where: { id }, data: { status: UserStatus.DELETED } });
    await transaction.refreshSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await transaction.userAdminAuditLog.create({ data: {
      userId: id, adminId, action: 'deleted', changes: { status: { old: current.status.toLowerCase(), new: 'deleted' } },
    } });
  });
}

export async function restoreAdminUser(id: string, adminId: string) {
  const current = await prisma.user.findUnique({ where: { id }, select: { status: true } });
  if (!current) notFound();
  if (current.status !== UserStatus.DELETED) throw new ApiError(409, 'Yalnızca silinmiş kullanıcılar geri yüklenebilir.', 'USER_NOT_DELETED');
  const user = await prisma.$transaction(async (transaction) => {
    const restored = await transaction.user.update({ where: { id }, data: { status: UserStatus.ACTIVE }, select: adminUserSelect });
    await transaction.userAdminAuditLog.create({ data: {
      userId: id, adminId, action: 'restored', changes: { status: { old: 'deleted', new: 'active' } },
    } });
    return restored;
  });
  return presentAdminUser(user);
}
