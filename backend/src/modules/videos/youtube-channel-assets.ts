import { createHash } from 'node:crypto';
import type { YoutubeChannelInfo } from '../../services/youtubeApi.js';
import { uploadImage } from '../../storage/r2-image.js';
import { logger } from '../../utils/logger.js';

export async function cacheYoutubeChannelAvatar(channel: YoutubeChannelInfo) {
  if (!channel.avatarUrl) return channel;
  const version = createHash('sha256').update(channel.avatarUrl).digest('hex').slice(0, 12);
  try {
    const avatarUrl = await uploadImage(channel.avatarUrl, `youtube/channels/${channel.channelId}/avatar-${version}.webp`);
    return { ...channel, avatarUrl };
  } catch (error) {
    logger.warn({ channelId: channel.channelId, err: error }, 'YouTube channel avatar could not be cached in R2');
    return channel;
  }
}
