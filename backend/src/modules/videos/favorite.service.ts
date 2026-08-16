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

export async function removeFavoriteChannelAsAdmin(userId: string, channelId: number, adminId: string) {
  await prisma.$transaction(async (transaction) => {
    const favorite = await transaction.userFavoriteChannel.findUnique({
      where: { userId_channelId: { userId, channelId } },
      select: { id: true, channel: { select: { channelId: true, channelName: true } } },
    });
    if (!favorite) throw new ApiError(404, 'Favori kanal kaydı bulunamadı.', 'FAVORITE_CHANNEL_NOT_FOUND');
    await transaction.userFavoriteChannel.delete({ where: { userId_channelId: { userId, channelId } } });
    await transaction.userAdminAuditLog.create({ data: {
      userId,
      adminId,
      action: 'favorite_channel_removed',
      changes: { favorite_channel: { old: { channelId, youtubeChannelId: favorite.channel.channelId, channelName: favorite.channel.channelName }, new: null } },
    } });
  });
}
