import { Prisma, VideoContentType, VideoSource, VideoStatus, YoutubeChannelStatus, type YoutubeChannel } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { getChannelInfo, getUploadsFromPlaylist, getVideoDetails, parseYoutubeVideoId } from '../../services/youtubeApi.js';
import { ApiError } from '../../utils/api-error.js';
import { cacheYoutubeChannelAvatar } from './youtube-channel-assets.js';

const withChannel = { channel: { select: { channelName: true, avatarUrl: true, isOwnChannel: true } } } as const;
const withVideoCount = {
  _count: { select: { videos: true } },
  metricSnapshots: { select: { subscriberCount: true }, orderBy: { snapshotDate: 'desc' as const }, take: 1 },
  score: { select: { totalScore: true } },
} as const;

type PublishedVideoFilters = {
  contentType?: 'all' | 'long' | 'short';
  search?: string | undefined;
  channelId?: number | undefined;
  favoritesOnly?: boolean;
  likedOnly?: boolean;
  userId?: string | undefined;
  page?: number;
  limit?: number;
};

export async function listPublishedVideos(filters: PublishedVideoFilters = {}) {
  const { contentType = 'all', search, channelId, favoritesOnly = false, likedOnly = false, userId, page = 1, limit = 24 } = filters;
  if (favoritesOnly && !userId) throw new ApiError(401, 'Favori videolar için giriş yapmalısınız.', 'UNAUTHORIZED');
  if (likedOnly && !userId) throw new ApiError(401, 'Beğenilen videolar için giriş yapmalısınız.', 'UNAUTHORIZED');
  const conditions: Prisma.VideoWhereInput[] = [];
  if (search) conditions.push({ OR: [
    { title: { contains: search } },
    { channelName: { contains: search } },
    { channel: { is: { channelName: { contains: search } } } },
  ] });
  if (channelId) conditions.push({ channelId });
  if (favoritesOnly && userId) conditions.push({ channel: { is: { favoritedBy: { some: { userId } } } } });
  if (likedOnly && userId) conditions.push({ reactions: { some: { userId, reaction: 'LIKE' } } });
  const baseWhere: Prisma.VideoWhereInput = { status: VideoStatus.PUBLISHED, deletedAt: null, ...(conditions.length ? { AND: conditions } : {}) };
  const where: Prisma.VideoWhereInput = {
    ...baseWhere,
    ...(contentType === 'all' ? {} : { contentType: contentType === 'short' ? VideoContentType.SHORT : VideoContentType.LONG }),
  };
  const [videos, all, long, short] = await prisma.$transaction([
    prisma.video.findMany({ where, include: withChannel, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }], skip: (page - 1) * limit, take: limit }),
    prisma.video.count({ where: baseWhere }),
    prisma.video.count({ where: { ...baseWhere, contentType: VideoContentType.LONG } }),
    prisma.video.count({ where: { ...baseWhere, contentType: VideoContentType.SHORT } }),
  ]);
  const total = contentType === 'all' ? all : contentType === 'short' ? short : long;
  return { videos, counts: { all, long, short }, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function listPublicYoutubeChannels() {
  const channels = await prisma.youtubeChannel.findMany({
    where: { videos: { some: { status: VideoStatus.PUBLISHED, deletedAt: null } } },
    select: {
      id: true,
      channelName: true,
      avatarUrl: true,
      metricSnapshots: { select: { subscriberCount: true }, orderBy: { snapshotDate: 'desc' }, take: 1 },
      _count: { select: { videos: { where: { status: VideoStatus.PUBLISHED, deletedAt: null } } } },
    },
    orderBy: { channelName: 'asc' },
  });
  return channels.map((channel) => ({
    id: channel.id,
    channelName: channel.channelName ?? 'YouTube',
    avatarUrl: channel.avatarUrl,
    videoCount: channel._count.videos,
    subscriberCount: channel.metricSnapshots[0]?.subscriberCount ?? null,
  }));
}

export async function listAdminVideos(includeDeleted = false) {
  return prisma.video.findMany({
    where: includeDeleted ? {} : { deletedAt: null },
    include: withChannel,
    orderBy: [{ deletedAt: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
  });
}

async function requireVideo(id: number) {
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) throw new ApiError(404, 'Video bulunamadı.', 'VIDEO_NOT_FOUND');
  return video;
}

export async function updateVideoStatus(id: number, status: 'published' | 'hidden', adminId: string) {
  await requireVideo(id);
  return prisma.video.update({
    where: { id },
    data: { status: status === 'published' ? VideoStatus.PUBLISHED : VideoStatus.HIDDEN, moderatedById: adminId, moderatedAt: new Date() },
    include: withChannel,
  });
}

export async function softDeleteVideo(id: number, adminId: string) {
  await requireVideo(id);
  return prisma.video.update({ where: { id }, data: { deletedAt: new Date(), deletedById: adminId, moderatedById: adminId, moderatedAt: new Date() }, include: withChannel });
}

export async function restoreVideo(id: number, adminId: string) {
  await requireVideo(id);
  return prisma.video.update({ where: { id }, data: { deletedAt: null, deletedById: null, moderatedById: adminId, moderatedAt: new Date() }, include: withChannel });
}

export async function refreshVideoMetadata(id: number, adminId: string) {
  const video = await requireVideo(id);
  const details = await getVideoDetails(video.youtubeVideoId);
  return prisma.video.update({
    where: { id },
    data: {
      youtubeUrl: details.youtubeUrl, channelName: details.channelName, title: details.title, description: details.description,
      thumbnailUrl: details.thumbnailUrl, duration: details.duration, durationSeconds: details.durationSeconds,
      contentType: details.contentType === 'short' ? VideoContentType.SHORT : VideoContentType.LONG,
      publishedAt: details.publishedAt, moderatedById: adminId, moderatedAt: new Date(),
    },
    include: withChannel,
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
        thumbnailUrl: details.thumbnailUrl, duration: details.duration, durationSeconds: details.durationSeconds,
        contentType: details.contentType === 'short' ? VideoContentType.SHORT : VideoContentType.LONG, publishedAt: details.publishedAt,
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
        thumbnailUrl: video.thumbnailUrl, duration: video.duration, durationSeconds: video.durationSeconds,
        contentType: video.contentType === 'short' ? VideoContentType.SHORT : VideoContentType.LONG, publishedAt: video.publishedAt,
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
  const details = await cacheYoutubeChannelAvatar(await getChannelInfo(channelUrl));
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
