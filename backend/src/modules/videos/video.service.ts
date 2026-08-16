import { Prisma, VideoSource, VideoStatus, YoutubeChannelStatus, type YoutubeChannel } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { getChannelInfo, getUploadsFromPlaylist, getVideoDetails, parseYoutubeVideoId } from '../../services/youtubeApi.js';
import { ApiError } from '../../utils/api-error.js';

const withChannel = { channel: { select: { channelName: true, avatarUrl: true, isOwnChannel: true } } } as const;
const withVideoCount = { _count: { select: { videos: true } } } as const;

export async function listPublishedVideos() {
  return prisma.video.findMany({
    where: { status: VideoStatus.PUBLISHED }, include: withChannel,
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function createManualVideo(youtubeUrl: string, addedById: string) {
  const youtubeVideoId = parseYoutubeVideoId(youtubeUrl);
  const existing = await prisma.video.findUnique({ where: { youtubeVideoId }, select: { id: true } });
  if (existing) throw new ApiError(409, 'Bu video zaten Video Merkezi’nde yer alıyor.', 'VIDEO_ALREADY_EXISTS');
  const details = await getVideoDetails(youtubeVideoId);
  try {
    return await prisma.video.create({
      data: {
        youtubeVideoId, youtubeUrl: details.youtubeUrl, title: details.title, description: details.description,
        thumbnailUrl: details.thumbnailUrl, duration: details.duration, publishedAt: details.publishedAt,
        channelName: details.channelName, source: VideoSource.ADMIN_MANUAL, status: VideoStatus.PUBLISHED, addedById,
      },
      include: withChannel,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError(409, 'Bu video zaten Video Merkezi’nde yer alıyor.', 'VIDEO_ALREADY_EXISTS');
    throw error;
  }
}

export async function listYoutubeChannels() {
  return prisma.youtubeChannel.findMany({ include: withVideoCount, orderBy: { createdAt: 'desc' } });
}

export async function syncYoutubeChannel(channel: YoutubeChannel, limit = 500) {
  const syncStartedAt = new Date();
  const publishedAfter = channel.lastSyncedAt ? new Date(channel.lastSyncedAt.getTime() - 10 * 60_000) : null;
  const uploads = await getUploadsFromPlaylist(channel.uploadsPlaylistId, publishedAfter, limit);
  const source = channel.isOwnChannel ? VideoSource.KRIPTOKEYFI_AUTO : VideoSource.CREATOR_AUTO;
  if (!uploads.length) {
    await prisma.youtubeChannel.update({ where: { id: channel.id }, data: { lastSyncedAt: syncStartedAt } });
    return { discovered: 0, created: 0, syncedAt: syncStartedAt };
  }
  const [created] = await prisma.$transaction([
    prisma.video.createMany({
      data: uploads.map((video) => ({
        youtubeVideoId: video.youtubeVideoId, youtubeUrl: video.youtubeUrl, channelId: channel.id,
        channelName: video.channelName, title: video.title, description: video.description,
        thumbnailUrl: video.thumbnailUrl, duration: video.duration, publishedAt: video.publishedAt,
        source, status: VideoStatus.PUBLISHED, addedById: channel.addedById,
        creatorId: channel.ownerUserId,
      })),
      skipDuplicates: true,
    }),
    prisma.youtubeChannel.update({ where: { id: channel.id }, data: { lastSyncedAt: syncStartedAt } }),
  ]);
  return { discovered: uploads.length, created: created.count, syncedAt: syncStartedAt };
}

export async function createYoutubeChannel(channelUrl: string, addedById: string) {
  const details = await getChannelInfo(channelUrl);
  const existing = await prisma.youtubeChannel.findUnique({ where: { channelId: details.channelId }, select: { id: true } });
  if (existing) throw new ApiError(409, 'Bu YouTube kanalı zaten takip ediliyor.', 'YOUTUBE_CHANNEL_ALREADY_EXISTS');
  let channel: YoutubeChannel;
  try {
    channel = await prisma.youtubeChannel.create({
      data: { ...details, isOwnChannel: false, status: YoutubeChannelStatus.ACTIVE, addedById },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError(409, 'Bu YouTube kanalı zaten takip ediliyor.', 'YOUTUBE_CHANNEL_ALREADY_EXISTS');
    throw error;
  }
  try {
    const sync = await syncYoutubeChannel(channel, env.YOUTUBE_INITIAL_SYNC_LIMIT);
    const saved = await prisma.youtubeChannel.findUniqueOrThrow({ where: { id: channel.id }, include: withVideoCount });
    return { channel: saved, sync };
  } catch (error) {
    await prisma.youtubeChannel.delete({ where: { id: channel.id } }).catch(() => undefined);
    throw error;
  }
}

export async function updateYoutubeChannelStatus(id: number, status: 'active' | 'paused') {
  const existing = await prisma.youtubeChannel.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new ApiError(404, 'YouTube kanalı bulunamadı.', 'YOUTUBE_CHANNEL_NOT_FOUND');
  return prisma.youtubeChannel.update({
    where: { id }, data: { status: status === 'active' ? YoutubeChannelStatus.ACTIVE : YoutubeChannelStatus.PAUSED }, include: withVideoCount,
  });
}
