import { Prisma, VideoSource, VideoStatus } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { getVideoDetails, parseYoutubeVideoId } from '../../services/youtubeApi.js';
import { ApiError } from '../../utils/api-error.js';

const withChannel = { channel: { select: { channelName: true, avatarUrl: true } } } as const;

export async function listPublishedVideos() {
  return prisma.video.findMany({
    where: { status: VideoStatus.PUBLISHED },
    include: withChannel,
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
        youtubeVideoId,
        title: details.title,
        description: details.description,
        thumbnailUrl: details.thumbnailUrl,
        duration: details.duration,
        publishedAt: details.publishedAt,
        channelName: details.channelName,
        source: VideoSource.MANUAL,
        status: VideoStatus.PUBLISHED,
        addedById,
      },
      include: withChannel,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ApiError(409, 'Bu video zaten Video Merkezi’nde yer alıyor.', 'VIDEO_ALREADY_EXISTS');
    }
    throw error;
  }
}
