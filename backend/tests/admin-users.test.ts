import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), count: vi.fn(), userCreate: vi.fn(), auditCreate: vi.fn(), transaction: vi.fn(), hashPassword: vi.fn(),
}));

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    user: { findMany: mocks.findMany, count: mocks.count },
    $transaction: mocks.transaction,
  },
}));
vi.mock('../src/security/password.js', () => ({ hashPassword: mocks.hashPassword }));

import { adminUserListQuerySchema, createAdminUserBodySchema } from '../src/modules/users/admin-user.schema.js';
import { createAdminUser, listAdminUsers } from '../src/modules/users/admin-user.service.js';

describe('admin user list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((input: Array<Promise<unknown>> | ((transaction: unknown) => unknown)) => (
      typeof input === 'function'
        ? input({ user: { create: mocks.userCreate }, userAdminAuditLog: { create: mocks.auditCreate } })
        : Promise.all(input)
    ));
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    mocks.hashPassword.mockResolvedValue('argon2id-hash');
    mocks.auditCreate.mockResolvedValue({ id: 1 });
  });

  it('validates filters and pagination limits', () => {
    expect(adminUserListQuerySchema.parse({ search: 'hamza', status: 'suspended', role: 'admin', page: '2', limit: '25' }))
      .toEqual({ search: 'hamza', status: 'suspended', role: 'admin', page: 2, limit: 25 });
    expect(adminUserListQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('excludes deleted users by default and searches all identity fields', async () => {
    await listAdminUsers({ search: 'kripto', page: 1, limit: 20 });

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [
        { OR: [{ email: { contains: 'kripto' } }, { username: { contains: 'kripto' } }, { name: { contains: 'kripto' } }] },
        { status: { not: UserStatus.DELETED } },
      ] },
      skip: 0,
      take: 20,
    }));
  });

  it('returns only explicitly requested deleted admins', async () => {
    mocks.findMany.mockResolvedValue([{
      id: 'user-1', email: 'admin@example.com', username: 'admin', name: 'Admin', avatarUrl: null,
      role: UserRole.ADMIN, status: UserStatus.DELETED, createdAt: new Date('2026-08-01T00:00:00Z'), lastLoginAt: null,
    }]);
    mocks.count.mockResolvedValue(1);

    const result = await listAdminUsers({ status: 'deleted', role: 'admin', page: 1, limit: 20 });

    expect(result.users[0]).toMatchObject({ id: 'user-1', role: 'admin', status: 'deleted' });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [{ status: UserStatus.DELETED }, { role: UserRole.ADMIN }] },
    }));
  });

  it('creates an active verified account with a hashed temporary password and a password-free audit entry', async () => {
    const createdAt = new Date('2026-08-16T18:00:00Z');
    mocks.userCreate.mockResolvedValue({
      id: 'new-user', email: 'new@example.com', username: 'new_user', name: 'Yeni Kullanıcı', avatarUrl: null,
      role: UserRole.USER, status: UserStatus.ACTIVE, createdAt, lastLoginAt: null,
    });
    const input = createAdminUserBodySchema.parse({
      email: 'NEW@EXAMPLE.COM', username: 'Yeni Kullanıcı', display_name: 'Yeni Kullanıcı', password: 'temporary-123', role: 'user',
    });

    const result = await createAdminUser(input, 'admin-1');

    expect(mocks.hashPassword).toHaveBeenCalledWith('temporary-123');
    expect(mocks.userCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: 'new@example.com', username: 'yeni_kullanici', passwordHash: 'argon2id-hash', status: UserStatus.ACTIVE,
        emailVerifiedAt: expect.any(Date), mustChangePassword: true, createdByAdminId: 'admin-1',
      }),
    }));
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: {
      userId: 'new-user', adminId: 'admin-1', action: 'created', changes: { source: 'admin', role: 'user' },
    } });
    expect(JSON.stringify(mocks.auditCreate.mock.calls)).not.toContain('temporary-123');
    expect(result).toMatchObject({ id: 'new-user', role: 'user', status: 'active' });
  });

  it('returns a meaningful conflict when the email is already registered', async () => {
    mocks.userCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.19.0',
      meta: { target: ['email'] },
    }));

    const input = createAdminUserBodySchema.parse({
      email: 'existing@example.com', username: 'new_user', display_name: 'Yeni Kullanıcı',
      password: 'temporary-123', role: 'user',
    });

    await expect(createAdminUser(input, 'admin-1')).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_EXISTS',
    });
  });
});
