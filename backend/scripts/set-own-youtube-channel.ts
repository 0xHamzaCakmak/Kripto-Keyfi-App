import { prisma } from '../src/database/prisma.js';

const channelName = process.argv.slice(2).join(' ').trim();
if (!channelName) throw new Error('Kanal adı zorunludur. Örnek: npm run youtube:set-own-channel -- "Kripto Keyfi"');

try {
  const channel = await prisma.youtubeChannel.findFirst({ where: { channelName }, select: { id: true, channelId: true, channelName: true } });
  if (!channel) throw new Error(`YouTube kanalı bulunamadı: ${channelName}`);
  await prisma.$transaction([
    prisma.youtubeChannel.updateMany({ where: { id: { not: channel.id }, isOwnChannel: true }, data: { isOwnChannel: false } }),
    prisma.youtubeChannel.update({ where: { id: channel.id }, data: { isOwnChannel: true } }),
  ]);
  console.log(JSON.stringify({ id: channel.id, channelId: channel.channelId, channelName: channel.channelName, isOwnChannel: true }));
} finally {
  await prisma.$disconnect();
}
