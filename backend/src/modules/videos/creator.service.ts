import { Prisma, UserCapabilityStatus, UserCapabilityType, VideoContentType, VideoSource, VideoStatus, YoutubeChannelStatus } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { getChannelInfo, getVideoDetails, parseYoutubeVideoId } from '../../services/youtubeApi.js';
import { ApiError } from '../../utils/api-error.js';

const channelWithCount = { _count: { select: { videos: true } } } as const;

export async function getMyCreatorState(userId: string) {
  const [channel, capability] = await Promise.all([
    prisma.youtubeChannel.findUnique({ where: { ownerUserId: userId }, include: channelWithCount }),
    prisma.userCapability.findUnique({ where: { userId_type: { userId, type: UserCapabilityType.CREATOR } } }),
  ]);
  return { channel, capability };
}

export async function connectMyYoutubeChannel(userId: string, channelUrl: string) {
  const [details, state] = await Promise.all([getChannelInfo(channelUrl), getMyCreatorState(userId)]);
  const lockedStatuses: UserCapabilityStatus[] = [UserCapabilityStatus.PENDING, UserCapabilityStatus.APPROVED, UserCapabilityStatus.SUSPENDED];
  if (state.capability && lockedStatuses.includes(state.capability.status)) {
    throw new ApiError(409, 'Başvuru incelemedeyken veya onaylıyken kanal değiştirilemez.', 'CREATOR_CHANNEL_LOCKED');
  }
  if (state.channel && state.channel.channelId !== details.channelId) {
    throw new ApiError(409, 'Bağlı kanalı değiştirmek için yönetim ekibiyle iletişime geçin.', 'CREATOR_CHANNEL_ALREADY_LINKED');
  }
  const claimed = await prisma.youtubeChannel.findUnique({ where: { channelId: details.channelId }, select: { id: true, ownerUserId: true } });
  if (claimed?.ownerUserId && claimed.ownerUserId !== userId) throw new ApiError(409, 'Bu kanal başka bir kullanıcı profiline bağlı.', 'YOUTUBE_CHANNEL_ALREADY_CLAIMED');

  if (state.channel) {
    return prisma.youtubeChannel.update({ where: { id: state.channel.id }, data: { ...details, status: YoutubeChannelStatus.PAUSED }, include: channelWithCount });
  }
  if (claimed) {
    return prisma.youtubeChannel.update({ where: { id: claimed.id }, data: { ...details, ownerUserId: userId, status: YoutubeChannelStatus.PAUSED }, include: channelWithCount });
  }
  return prisma.youtubeChannel.create({
    data: { ...details, ownerUserId: userId, addedById: userId, isOwnChannel: false, status: YoutubeChannelStatus.PAUSED },
    include: channelWithCount,
  });
}

export async function submitCreatorApplication(userId: string) {
  const state = await getMyCreatorState(userId);
  if (!state.channel) throw new ApiError(400, 'Başvurmadan önce YouTube kanalınızı bağlayın.', 'YOUTUBE_CHANNEL_REQUIRED');
  if (state.capability?.status === UserCapabilityStatus.PENDING) throw new ApiError(409, 'Creator başvurunuz zaten inceleniyor.', 'CREATOR_APPLICATION_PENDING');
  if (state.capability?.status === UserCapabilityStatus.APPROVED) throw new ApiError(409, 'Creator başvurunuz zaten onaylandı.', 'CREATOR_ALREADY_APPROVED');
  if (state.capability?.status === UserCapabilityStatus.SUSPENDED) throw new ApiError(409, 'Askıya alınan Creator hesabı yeniden başvuru yapamaz.', 'CREATOR_SUSPENDED');

  return prisma.userCapability.upsert({
    where: { userId_type: { userId, type: UserCapabilityType.CREATOR } },
    create: { userId, type: UserCapabilityType.CREATOR, status: UserCapabilityStatus.PENDING },
    update: { status: UserCapabilityStatus.PENDING, appliedAt: new Date(), approvedAt: null, rejectedAt: null },
  });
}

export async function addCreatorVideo(userId: string, youtubeUrl: string) {
  const state = await getMyCreatorState(userId);
  if (state.capability?.status !== UserCapabilityStatus.APPROVED || !state.channel) throw new ApiError(403, 'Video paylaşmak için onaylı Creator olmalısınız.', 'CREATOR_APPROVAL_REQUIRED');
  const youtubeVideoId = parseYoutubeVideoId(youtubeUrl);
  const duplicate = await prisma.video.findUnique({ where: { youtubeVideoId }, select: { id: true } });
  if (duplicate) throw new ApiError(409, 'Bu video zaten Video Merkezi’nde yer alıyor.', 'VIDEO_ALREADY_EXISTS');
  const details = await getVideoDetails(youtubeVideoId);
  if (details.channelId !== state.channel.channelId) throw new ApiError(403, 'Yalnızca bağlı YouTube kanalınıza ait videoları paylaşabilirsiniz.', 'VIDEO_CHANNEL_MISMATCH');
  try {
    return await prisma.video.create({
      data: {
        youtubeVideoId, youtubeUrl: details.youtubeUrl, channelId: state.channel.id, channelName: details.channelName,
        title: details.title, description: details.description, thumbnailUrl: details.thumbnailUrl, duration: details.duration,
        durationSeconds: details.durationSeconds, contentType: details.contentType === 'short' ? VideoContentType.SHORT : VideoContentType.LONG,
        publishedAt: details.publishedAt, source: VideoSource.CREATOR_AUTO, status: VideoStatus.PUBLISHED,
        creatorId: userId, addedById: userId,
      },
      include: { channel: { select: { channelName: true, avatarUrl: true, isOwnChannel: true } } },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ApiError(409, 'Bu video zaten Video Merkezi’nde yer alıyor.', 'VIDEO_ALREADY_EXISTS');
    throw error;
  }
}

export async function listCreatorApplications() {
  return prisma.userCapability.findMany({
    where: { type: UserCapabilityType.CREATOR },
    include: {
      user: { select: { id: true, name: true, username: true, email: true, avatarUrl: true, ownedYoutubeChannel: { include: channelWithCount } } },
    },
    orderBy: { appliedAt: 'desc' },
  });
}

export async function reviewCreatorApplication(userId: string, status: 'approved' | 'rejected' | 'suspended') {
  const state = await getMyCreatorState(userId);
  if (!state.capability || !state.channel) throw new ApiError(404, 'Creator başvurusu bulunamadı.', 'CREATOR_APPLICATION_NOT_FOUND');
  const capabilityStatus = status === 'approved' ? UserCapabilityStatus.APPROVED : status === 'rejected' ? UserCapabilityStatus.REJECTED : UserCapabilityStatus.SUSPENDED;
  const channelStatus = status === 'approved' ? YoutubeChannelStatus.ACTIVE : YoutubeChannelStatus.PAUSED;
  const approvedAt = status === 'approved' ? new Date() : null;
  const [capability, channel] = await prisma.$transaction([
    prisma.userCapability.update({
      where: { id: state.capability.id },
      data: {
        status: capabilityStatus,
        ...(status === 'approved' ? { approvedAt, rejectedAt: null } : {}),
        ...(status === 'rejected' ? { rejectedAt: new Date(), approvedAt: null } : {}),
      },
    }),
    prisma.youtubeChannel.update({
      where: { id: state.channel.id },
      data: { status: channelStatus, ...(approvedAt ? { lastSyncedAt: approvedAt } : {}) },
    }),
  ]);
  return { capability, channel, sync: null };
}
