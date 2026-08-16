import { prisma } from '../src/database/prisma.js';
import { cacheYoutubeChannelAvatar } from '../src/modules/videos/youtube-channel-assets.js';
import { getChannelInfo } from '../src/services/youtubeApi.js';

async function main() {
  const channels = await prisma.youtubeChannel.findMany({ select: { id: true, channelId: true, avatarUrl: true } });
  let updated = 0;
  for (const channel of channels) {
    const details = await cacheYoutubeChannelAvatar(await getChannelInfo(channel.channelId));
    if (details.avatarUrl && details.avatarUrl !== channel.avatarUrl) {
      await prisma.youtubeChannel.update({ where: { id: channel.id }, data: { avatarUrl: details.avatarUrl } });
      updated += 1;
    }
  }
  console.log(JSON.stringify({ channels: channels.length, updated }));
}

main().finally(() => prisma.$disconnect());
