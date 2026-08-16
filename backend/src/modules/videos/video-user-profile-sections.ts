import { UserCapabilityType } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import type { UserProfileSectionDefinition } from '../users/user-profile-section.registry.js';

export const videoUserProfileSections: UserProfileSectionDefinition[] = [
  {
    key: 'favorite_channels',
    title: 'Favori YouTube Kanalları',
    async fetch(userId) {
      const favorites = await prisma.userFavoriteChannel.findMany({
        where: { userId },
        select: {
          id: true,
          createdAt: true,
          channel: { select: { id: true, channelId: true, channelName: true, channelUrl: true, avatarUrl: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return favorites.map((favorite) => ({
        id: favorite.id,
        channelId: favorite.channel.id,
        youtubeChannelId: favorite.channel.channelId,
        channelName: favorite.channel.channelName,
        channelUrl: favorite.channel.channelUrl,
        avatarUrl: favorite.channel.avatarUrl,
        status: favorite.channel.status.toLowerCase(),
        favoritedAt: favorite.createdAt.toISOString(),
      }));
    },
  },
  {
    key: 'creator_application',
    title: 'YouTuber Başvurusu',
    async fetch(userId) {
      const [application, channel] = await Promise.all([
        prisma.userCapability.findUnique({
          where: { userId_type: { userId, type: UserCapabilityType.CREATOR } },
          select: { status: true, appliedAt: true, approvedAt: true, rejectedAt: true, updatedAt: true },
        }),
        prisma.youtubeChannel.findUnique({
          where: { ownerUserId: userId },
          select: { id: true, channelId: true, channelName: true, channelUrl: true, avatarUrl: true, status: true },
        }),
      ]);
      if (!application && !channel) return [];
      return [{
        applicationStatus: application?.status.toLowerCase() ?? 'not_applied',
        appliedAt: application?.appliedAt.toISOString() ?? null,
        approvedAt: application?.approvedAt?.toISOString() ?? null,
        rejectedAt: application?.rejectedAt?.toISOString() ?? null,
        updatedAt: application?.updatedAt.toISOString() ?? null,
        channelId: channel?.id ?? null,
        youtubeChannelId: channel?.channelId ?? null,
        channelName: channel?.channelName ?? null,
        channelUrl: channel?.channelUrl ?? null,
        avatarUrl: channel?.avatarUrl ?? null,
        channelStatus: channel?.status.toLowerCase() ?? null,
      }];
    },
  },
];
