import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  favoriteFindMany: vi.fn(), favoriteDeleteMany: vi.fn(), favoriteCreate: vi.fn(), channelFindUnique: vi.fn(),
}));

vi.mock('../src/database/prisma.js', () => ({ prisma: {
  userFavoriteChannel: { findMany: mocks.favoriteFindMany, deleteMany: mocks.favoriteDeleteMany, create: mocks.favoriteCreate },
  youtubeChannel: { findUnique: mocks.channelFindUnique },
} }));

import { listFavoriteChannelIds, toggleFavoriteChannel } from '../src/modules/videos/favorite.service.js';
import { listVideosQuerySchema } from '../src/modules/videos/video.schema.js';

describe('YouTube favorite channels', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the authenticated user channel ids', async () => {
    mocks.favoriteFindMany.mockResolvedValue([{ channelId: 7 }, { channelId: 3 }]);
    await expect(listFavoriteChannelIds('user-1')).resolves.toEqual([7, 3]);
    expect(mocks.favoriteFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1' } }));
  });

  it('removes an existing favorite', async () => {
    mocks.channelFindUnique.mockResolvedValue({ id: 7 });
    mocks.favoriteDeleteMany.mockResolvedValue({ count: 1 });
    await expect(toggleFavoriteChannel('user-1', 7)).resolves.toBe(false);
    expect(mocks.favoriteCreate).not.toHaveBeenCalled();
  });

  it('creates a missing favorite', async () => {
    mocks.channelFindUnique.mockResolvedValue({ id: 7 });
    mocks.favoriteDeleteMany.mockResolvedValue({ count: 0 });
    mocks.favoriteCreate.mockResolvedValue({ id: 1 });
    await expect(toggleFavoriteChannel('user-1', 7)).resolves.toBe(true);
    expect(mocks.favoriteCreate).toHaveBeenCalledWith({ data: { userId: 'user-1', channelId: 7 } });
  });

  it('validates combined public filters without raw SQL input', () => {
    expect(listVideosQuerySchema.parse({ search: 'bitcoin', type: 'short', channel_id: '7', favorites_only: 'true', page: '2', limit: '12' })).toMatchObject({
      search: 'bitcoin', type: 'short', channel_id: 7, favorites_only: true, page: 2, limit: 12,
    });
  });
});
