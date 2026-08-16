import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(), syncYoutubeChannel: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn(),
}));

vi.mock('../src/database/prisma.js', () => ({ prisma: { youtubeChannel: { findMany: mocks.findMany } } }));
vi.mock('../src/modules/videos/video.service.js', () => ({ syncYoutubeChannel: mocks.syncYoutubeChannel }));
vi.mock('../src/utils/logger.js', () => ({ logger: { warn: mocks.warn, info: mocks.info, error: mocks.error } }));

import { runYoutubeSync } from '../src/modules/videos/youtube.worker.js';

describe('YouTube synchronization worker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('continues with remaining channels when one channel fails', async () => {
    const channels = [{ id: 1, channelId: 'UC_FAILED' }, { id: 2, channelId: 'UC_HEALTHY' }];
    mocks.findMany.mockResolvedValue(channels);
    mocks.syncYoutubeChannel.mockRejectedValueOnce(new Error('quota')).mockResolvedValueOnce({ created: 2, discovered: 2 });

    await runYoutubeSync();

    expect(mocks.syncYoutubeChannel).toHaveBeenCalledTimes(2);
    expect(mocks.syncYoutubeChannel).toHaveBeenNthCalledWith(2, channels[1]);
    expect(mocks.warn).toHaveBeenCalledOnce();
    expect(mocks.info).toHaveBeenCalledOnce();
  });
});
