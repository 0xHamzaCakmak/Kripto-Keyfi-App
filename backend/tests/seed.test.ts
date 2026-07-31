import { describe, expect, it, vi } from 'vitest';
import { seedAdmin } from '../prisma/seed.js';

describe('admin seed', () => {
  it('does not create the same normalized email twice', async () => {
    let stored: { id: string; email: string } | null = null;
    const client = {
      user: {
        findUnique: vi.fn(async ({ where }: { where: { email: string } }) => stored?.email === where.email ? { id: stored.id } : null),
        create: vi.fn(async ({ data }: { data: { email: string } }) => {
          stored = { id: 'admin-1', email: data.email };
          return { id: 'admin-1' };
        }),
      },
    };

    const input = { email: ' ADMIN@Example.com ', password: 'admin-password-123', name: 'Admin' };
    await seedAdmin(client as never, input);
    const second = await seedAdmin(client as never, input);

    expect(client.user.create).toHaveBeenCalledTimes(1);
    expect(second).toEqual({ created: false, id: 'admin-1' });
  });
});

