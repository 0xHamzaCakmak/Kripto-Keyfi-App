import type { Video, YoutubeChannel } from '@prisma/client';

type VideoWithChannel = Video & { channel: Pick<YoutubeChannel, 'channelName' | 'avatarUrl' | 'isOwnChannel'> | null };

export function presentVideo(video: VideoWithChannel) {
  return {
    id: video.id,
    channelId: video.channelId,
    youtubeVideoId: video.youtubeVideoId,
    youtubeUrl: video.youtubeUrl,
    title: video.titleOverride ?? video.title ?? 'İsimsiz video',
    description: video.descriptionOverride ?? video.description ?? '',
    thumbnailUrl: video.thumbnailUrl,
    duration: video.duration,
    durationSeconds: video.durationSeconds,
    contentType: video.contentType.toLowerCase(),
    publishedAt: video.publishedAt?.toISOString() ?? null,
    channelName: video.channel?.channelName ?? video.channelName ?? 'YouTube',
    channelAvatarUrl: video.channel?.avatarUrl ?? null,
    source: video.source.toLowerCase(),
    isOwnChannel: video.channel?.isOwnChannel ?? false,
  };
}

export function presentAdminVideo(video: VideoWithChannel) {
  return {
    ...presentVideo(video),
    originalTitle: video.title ?? '',
    originalDescription: video.description ?? '',
    titleOverride: video.titleOverride,
    descriptionOverride: video.descriptionOverride,
    status: video.status.toLowerCase(),
    deletedAt: video.deletedAt?.toISOString() ?? null,
    warningLabel: video.warningLabel,
    warningNote: video.warningNote,
    warningVisibleToUsers: video.warningVisibleToUsers,
    warnedAt: video.warnedAt?.toISOString() ?? null,
    moderatedAt: video.moderatedAt?.toISOString() ?? null,
  };
}

type ChannelWithCount = YoutubeChannel & { _count: { videos: number } };

export function presentYoutubeChannel(channel: ChannelWithCount) {
  return {
    id: channel.id,
    channelId: channel.channelId,
    channelName: channel.channelName,
    channelUrl: channel.channelUrl,
    avatarUrl: channel.avatarUrl,
    isOwnChannel: channel.isOwnChannel,
    status: channel.status.toLowerCase(),
    lastSyncedAt: channel.lastSyncedAt?.toISOString() ?? null,
    videoCount: channel._count.videos,
    createdAt: channel.createdAt.toISOString(),
  };
}
