import { VideoReactionType } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';

export async function listVideoReactions(userId: string) {
  const reactions = await prisma.userVideoReaction.findMany({
    where: { userId, video: { deletedAt: null } },
    select: { videoId: true, reaction: true },
    orderBy: { updatedAt: 'desc' },
  });
  return reactions.map((item) => ({ videoId: item.videoId, reaction: item.reaction.toLowerCase() as 'like' | 'dislike' }));
}

export async function toggleVideoReaction(userId: string, videoId: number, reaction: 'like' | 'dislike') {
  const video = await prisma.video.findFirst({ where: { id: videoId, deletedAt: null }, select: { id: true } });
  if (!video) throw new ApiError(404, 'Video bulunamadı.', 'VIDEO_NOT_FOUND');
  const nextReaction = reaction === 'like' ? VideoReactionType.LIKE : VideoReactionType.DISLIKE;
  const existing = await prisma.userVideoReaction.findUnique({ where: { userId_videoId: { userId, videoId } } });
  if (existing?.reaction === nextReaction) {
    await prisma.userVideoReaction.delete({ where: { userId_videoId: { userId, videoId } } });
    return null;
  }
  await prisma.userVideoReaction.upsert({
    where: { userId_videoId: { userId, videoId } },
    create: { userId, videoId, reaction: nextReaction },
    update: { reaction: nextReaction },
  });
  return reaction;
}
