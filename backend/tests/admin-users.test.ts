import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), userCreate: vi.fn(), userUpdate: vi.fn(),
  auditCreate: vi.fn(), sessionUpdateMany: vi.fn(), transaction: vi.fn(), hashPassword: vi.fn(),
}));

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    user: { findMany: mocks.findMany, findUnique: mocks.findUnique, count: mocks.count },
    $transaction: mocks.transaction,
  },
}));
vi.mock('../src/security/password.js', () => ({ hashPassword: mocks.hashPassword }));

import { adminUserListQuerySchema, createAdminUserBodySchema, updateAdminUserBodySchema } from '../src/modules/users/admin-user.schema.js';
import { createAdminUser, listAdminUsers, resetAdminUserPassword, restoreAdminUser, softDeleteAdminUser, updateAdminUser } from '../src/modules/users/admin-user.service.js';

const fullUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1', email: 'user@example.com', username: 'user_one', name: 'Kullanıcı', avatarUrl: null,
  role: UserRole.USER, status: UserStatus.ACTIVE, createdAt: new Date('2026-08-01T00:00:00Z'),
  updatedAt: new Date('2026-08-01T00:00:00Z'), lastLoginAt: null, notes: null, mustChangePassword: false,
  createdByAdminId: null, ...overrides,
});

describe('admin user management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((input: Array<Promise<unknown>> | ((transaction: unknown) => unknown)) => (
      typeof input === 'function'
        ? input({
          user: { create: mocks.userCreate, update: mocks.userUpdate },
          userAdminAuditLog: { create: mocks.auditCreate },
          refreshSession: { updateMany: mocks.sessionUpdateMany },
        })
        : Promise.all(input)
    ));
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    mocks.hashPassword.mockResolvedValue('argon2id-hash');
    mocks.auditCreate.mockResolvedValue({ id: 1 });
    mocks.sessionUpdateMany.mockResolvedValue({ count: 1 });
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
    mocks.findMany.mockResolvedValue([fullUser({ email: 'admin@example.com', username: 'admin', name: 'Admin', role: UserRole.ADMIN, status: UserStatus.DELETED })]);
    mocks.count.mockResolvedValue(1);
    const result = await listAdminUsers({ status: 'deleted', role: 'admin', page: 1, limit: 20 });
    expect(result.users[0]).toMatchObject({ id: 'user-1', role: 'admin', status: 'deleted' });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { AND: [{ status: UserStatus.DELETED }, { role: UserRole.ADMIN }] },
    }));
  });

  it('creates an active verified account with a hashed temporary password and a password-free audit entry', async () => {
    const createdAt = new Date('2026-08-16T18:00:00Z');
    mocks.userCreate.mockResolvedValue(fullUser({
      id: 'new-user', email: 'new@example.com', username: 'new_user', name: 'Yeni Kullanıcı', createdAt, updatedAt: createdAt,
    }));
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
      code: 'P2002', clientVersion: '6.19.0', meta: { target: ['email'] },
    }));
    const input = createAdminUserBodySchema.parse({
      email: 'existing@example.com', username: 'new_user', display_name: 'Yeni Kullanıcı', password: 'temporary-123', role: 'user',
    });
    await expect(createAdminUser(input, 'admin-1')).rejects.toMatchObject({ statusCode: 409, code: 'EMAIL_EXISTS' });
  });

  it('updates changed fields, audits old/new values and revokes sessions when suspending', async () => {
    mocks.findUnique.mockResolvedValue(fullUser());
    mocks.userUpdate.mockResolvedValue(fullUser({ email: 'updated@example.com', status: UserStatus.SUSPENDED, notes: 'Destek notu' }));
    const input = updateAdminUserBodySchema.parse({ email: 'UPDATED@EXAMPLE.COM', status: 'suspended', notes: 'Destek notu' });
    const result = await updateAdminUser('user-1', input, 'admin-1');
    expect(result).toMatchObject({ email: 'updated@example.com', status: 'suspended' });
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: {
      userId: 'user-1', adminId: 'admin-1', action: 'updated', changes: {
        email: { old: 'user@example.com', new: 'updated@example.com' },
        status: { old: 'active', new: 'suspended' },
        notes: { old: null, new: 'Destek notu' },
      },
    } });
    expect(mocks.sessionUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1', revokedAt: null } }));
  });

  it('resets the password without exposing it in audit and revokes open sessions', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'user-1' });
    await resetAdminUserPassword('user-1', 'new-secret-123', 'admin-1');
    expect(mocks.hashPassword).toHaveBeenCalledWith('new-secret-123');
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' }, data: { passwordHash: 'argon2id-hash', mustChangePassword: true },
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: { userId: 'user-1', adminId: 'admin-1', action: 'password_reset' } });
    expect(JSON.stringify(mocks.auditCreate.mock.calls)).not.toContain('new-secret-123');
    expect(mocks.sessionUpdateMany).toHaveBeenCalledOnce();
  });

  it('soft deletes and restores users with explicit audit entries', async () => {
    mocks.findUnique.mockResolvedValueOnce({ status: UserStatus.ACTIVE });
    await softDeleteAdminUser('user-1', 'admin-1');
    expect(mocks.userUpdate).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { status: UserStatus.DELETED } });
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'deleted' }) });

    mocks.findUnique.mockResolvedValueOnce({ status: UserStatus.DELETED });
    mocks.userUpdate.mockResolvedValueOnce(fullUser());
    const restored = await restoreAdminUser('user-1', 'admin-1');
    expect(restored.status).toBe('active');
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'restored' }) });
  });

  it('prevents an admin from suspending or deleting their own account', async () => {
    mocks.findUnique.mockResolvedValue(fullUser({ id: 'admin-1', role: UserRole.ADMIN }));
    await expect(updateAdminUser('admin-1', updateAdminUserBodySchema.parse({ status: 'suspended' }), 'admin-1'))
      .rejects.toMatchObject({ code: 'SELF_ADMIN_PROTECTED' });
    await expect(softDeleteAdminUser('admin-1', 'admin-1')).rejects.toMatchObject({ code: 'SELF_ADMIN_PROTECTED' });
  });
});
