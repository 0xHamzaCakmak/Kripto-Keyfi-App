import type { Video, YoutubeChannel } from '@prisma/client';

type VideoWithChannel = Video & { channel: Pick<YoutubeChannel, 'channelName' | 'avatarUrl'> | null };

export function presentVideo(video: VideoWithChannel) {
  return {
    id: video.id,
    youtubeVideoId: video.youtubeVideoId,
    title: video.title ?? 'İsimsiz video',
    description: video.description ?? '',
    thumbnailUrl: video.thumbnailUrl,
    duration: video.duration,
    publishedAt: video.publishedAt?.toISOString() ?? null,
    channelName: video.channel?.channelName ?? video.channelName ?? 'YouTube',
    channelAvatarUrl: video.channel?.avatarUrl ?? null,
    source: video.source.toLowerCase(),
  };
}
