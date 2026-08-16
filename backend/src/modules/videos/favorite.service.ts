import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';

export async function listFavoriteChannelIds(userId: string) {
  const favorites = await prisma.userFavoriteChannel.findMany({ where: { userId }, select: { channelId: true }, orderBy: { createdAt: 'desc' } });
  return favorites.map((favorite) => favorite.channelId);
}

export async function toggleFavoriteChannel(userId: string, channelId: number) {
  const channel = await prisma.youtubeChannel.findUnique({ where: { id: channelId }, select: { id: true } });
  if (!channel) throw new ApiError(404, 'YouTube kanalı bulunamadı.', 'YOUTUBE_CHANNEL_NOT_FOUND');
  const removed = await prisma.userFavoriteChannel.deleteMany({ where: { userId, channelId } });
  if (removed.count > 0) return false;
  await prisma.userFavoriteChannel.create({ data: { userId, channelId } });
  return true;
}
