import { UserRole, UserStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn(), transaction: vi.fn() }));

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    user: { findMany: mocks.findMany, count: mocks.count },
    $transaction: mocks.transaction,
  },
}));

import { adminUserListQuerySchema } from '../src/modules/users/admin-user.schema.js';
import { listAdminUsers } from '../src/modules/users/admin-user.service.js';

describe('admin user list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((operations: Array<Promise<unknown>>) => Promise.all(operations));
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
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
});
