import { YoutubeChannelStatus } from '@prisma/client';
import { env } from '../src/config/env.js';
import { prisma } from '../src/database/prisma.js';
import { syncInitialYoutubeChannelVideos } from '../src/modules/videos/video.service.js';

try {
  const channels = await prisma.youtubeChannel.findMany({
    where: { status: YoutubeChannelStatus.ACTIVE },
    orderBy: { id: 'asc' },
  });
  const results = [];
  for (const channel of channels) {
    const result = await syncInitialYoutubeChannelVideos(channel, env.YOUTUBE_INITIAL_SYNC_LIMIT);
    results.push({ channelId: channel.id, channelName: channel.channelName, ...result });
  }
  console.log(JSON.stringify({ perTypeLimit: env.YOUTUBE_INITIAL_SYNC_LIMIT, channels: results }));
} finally {
  await prisma.$disconnect();
}
