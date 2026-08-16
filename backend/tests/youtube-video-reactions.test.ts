import { VideoReactionType } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  reactionFindMany: vi.fn(),
  reactionFindUnique: vi.fn(),
  reactionDelete: vi.fn(),
  reactionUpsert: vi.fn(),
  videoFindFirst: vi.fn(),
}));

vi.mock('../src/database/prisma.js', () => ({ prisma: {
  userVideoReaction: {
    findMany: mocks.reactionFindMany,
    findUnique: mocks.reactionFindUnique,
    delete: mocks.reactionDelete,
    upsert: mocks.reactionUpsert,
  },
  video: { findFirst: mocks.videoFindFirst },
} }));

import { listVideoReactions, toggleVideoReaction } from '../src/modules/videos/video-reaction.service.js';

describe('YouTube video reactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.videoFindFirst.mockResolvedValue({ id: 9 });
  });

  it('lists likes and dislikes independently from channel favorites', async () => {
    mocks.reactionFindMany.mockResolvedValue([
      { videoId: 9, reaction: VideoReactionType.LIKE },
      { videoId: 10, reaction: VideoReactionType.DISLIKE },
    ]);
    await expect(listVideoReactions('user-1')).resolves.toEqual([
      { videoId: 9, reaction: 'like' },
      { videoId: 10, reaction: 'dislike' },
    ]);
  });

  it('creates a like when the video has no reaction', async () => {
    mocks.reactionFindUnique.mockResolvedValue(null);
    await expect(toggleVideoReaction('user-1', 9, 'like')).resolves.toBe('like');
    expect(mocks.reactionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: { userId: 'user-1', videoId: 9, reaction: VideoReactionType.LIKE },
      update: { reaction: VideoReactionType.LIKE },
    }));
  });

  it('removes a reaction when the active button is clicked again', async () => {
    mocks.reactionFindUnique.mockResolvedValue({ reaction: VideoReactionType.LIKE });
    await expect(toggleVideoReaction('user-1', 9, 'like')).resolves.toBeNull();
    expect(mocks.reactionDelete).toHaveBeenCalledWith({ where: { userId_videoId: { userId: 'user-1', videoId: 9 } } });
    expect(mocks.reactionUpsert).not.toHaveBeenCalled();
  });

  it('switches directly between dislike and like', async () => {
    mocks.reactionFindUnique.mockResolvedValue({ reaction: VideoReactionType.DISLIKE });
    await expect(toggleVideoReaction('user-1', 9, 'like')).resolves.toBe('like');
    expect(mocks.reactionUpsert).toHaveBeenCalledWith(expect.objectContaining({ update: { reaction: VideoReactionType.LIKE } }));
  });
});
