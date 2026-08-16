import { UserCapabilityStatus } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  channelFindUnique: vi.fn(),
  capabilityFindUnique: vi.fn(),
  videoFindUnique: vi.fn(),
  videoCreate: vi.fn(),
  capabilityUpdate: vi.fn(),
  channelUpdate: vi.fn(),
  transaction: vi.fn(),
  getVideoDetails: vi.fn(),
  parseYoutubeVideoId: vi.fn(),
}));

vi.mock('../src/database/prisma.js', () => ({
  prisma: {
    youtubeChannel: { findUnique: mocks.channelFindUnique, update: mocks.channelUpdate },
    userCapability: { findUnique: mocks.capabilityFindUnique, update: mocks.capabilityUpdate },
    video: { findUnique: mocks.videoFindUnique, create: mocks.videoCreate },
    $transaction: mocks.transaction,
  },
}));
vi.mock('../src/services/youtubeApi.js', () => ({
  getChannelInfo: vi.fn(),
  getVideoDetails: mocks.getVideoDetails,
  parseYoutubeVideoId: mocks.parseYoutubeVideoId,
}));
import { addCreatorVideo, reviewCreatorApplication } from '../src/modules/videos/creator.service.js';

const channel = {
  id: 'channel-1', channelId: 'UC_OWNER', ownerUserId: 'user-1', status: 'PAUSED',
  uploadsPlaylistId: 'UU_OWNER', channelName: 'Creator', lastSyncedAt: null,
};

describe('YouTube creator workflow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not allow a pending creator to publish a video', async () => {
    mocks.channelFindUnique.mockResolvedValue(channel);
    mocks.capabilityFindUnique.mockResolvedValue({ id: 'cap-1', status: UserCapabilityStatus.PENDING });

    await expect(addCreatorVideo('user-1', 'https://youtu.be/dQw4w9WgXcQ')).rejects.toMatchObject({
      statusCode: 403,
      code: 'CREATOR_APPROVAL_REQUIRED',
    });
    expect(mocks.getVideoDetails).not.toHaveBeenCalled();
  });

  it('rejects an old video link belonging to a different YouTube channel', async () => {
    mocks.channelFindUnique.mockResolvedValue(channel);
    mocks.capabilityFindUnique.mockResolvedValue({ id: 'cap-1', status: UserCapabilityStatus.APPROVED });
    mocks.parseYoutubeVideoId.mockReturnValue('dQw4w9WgXcQ');
    mocks.videoFindUnique.mockResolvedValue(null);
    mocks.getVideoDetails.mockResolvedValue({ channelId: 'UC_SOMEONE_ELSE' });

    await expect(addCreatorVideo('user-1', 'https://youtu.be/dQw4w9WgXcQ')).rejects.toMatchObject({
      statusCode: 403,
      code: 'VIDEO_CHANNEL_MISMATCH',
    });
    expect(mocks.videoCreate).not.toHaveBeenCalled();
  });

  it('activates the channel from the approval time without importing its old archive', async () => {
    const capability = { id: 'cap-1', status: UserCapabilityStatus.PENDING };
    const approved = { ...capability, status: UserCapabilityStatus.APPROVED };
    const activeChannel = { ...channel, status: 'ACTIVE' };
    mocks.channelFindUnique.mockResolvedValue(channel);
    mocks.capabilityFindUnique.mockResolvedValue(capability);
    mocks.capabilityUpdate.mockReturnValue({ operation: 'capability' });
    mocks.channelUpdate.mockReturnValue({ operation: 'channel' });
    mocks.transaction.mockResolvedValue([approved, activeChannel]);

    const result = await reviewCreatorApplication('user-1', 'approved');

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.channelUpdate).toHaveBeenCalledWith({
      where: { id: channel.id },
      data: { status: 'ACTIVE', lastSyncedAt: expect.any(Date) },
    });
    expect(result.sync).toBeNull();
  });
});
