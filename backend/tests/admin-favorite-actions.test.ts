import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), remove: vi.fn(), auditCreate: vi.fn(), transaction: vi.fn(),
}));

vi.mock('../src/database/prisma.js', () => ({ prisma: {
  $transaction: mocks.transaction,
} }));

import { removeFavoriteChannelAsAdmin } from '../src/modules/videos/favorite.service.js';

describe('admin favorite channel actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation((callback: (transaction: unknown) => unknown) => callback({
      userFavoriteChannel: { findUnique: mocks.findUnique, delete: mocks.remove },
      userAdminAuditLog: { create: mocks.auditCreate },
    }));
    mocks.remove.mockResolvedValue({ id: 5 });
    mocks.auditCreate.mockResolvedValue({ id: 10 });
  });

  it('removes only the selected relationship and records the admin audit', async () => {
    mocks.findUnique.mockResolvedValue({ id: 5, channel: { channelId: 'UC123', channelName: 'Kripto Kanalı' } });

    await removeFavoriteChannelAsAdmin('user-1', 7, 'admin-1');

    expect(mocks.remove).toHaveBeenCalledWith({ where: { userId_channelId: { userId: 'user-1', channelId: 7 } } });
    expect(mocks.auditCreate).toHaveBeenCalledWith({ data: {
      userId: 'user-1',
      adminId: 'admin-1',
      action: 'favorite_channel_removed',
      changes: { favorite_channel: { old: { channelId: 7, youtubeChannelId: 'UC123', channelName: 'Kripto Kanalı' }, new: null } },
    } });
  });

  it('returns a meaningful error when the favorite relationship does not exist', async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(removeFavoriteChannelAsAdmin('user-1', 7, 'admin-1'))
      .rejects.toMatchObject({ statusCode: 404, code: 'FAVORITE_CHANNEL_NOT_FOUND' });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });
});
