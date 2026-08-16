import { isOfficialYoutubeChannel } from './official-youtube-channel.js';

type VideoWithOwnership = { channel: { channelId: string; isOwnChannel: boolean } | null };

export function ensureOwnChannelInEveryFive<T extends VideoWithOwnership>(videos: T[]) {
  const remaining = [...videos];
  const ordered: T[] = [];
  while (remaining.length > 0) {
    const block = remaining.splice(0, 5);
    if (!block.some((video) => isOfficialYoutubeChannel(video.channel))) {
      const ownIndex = remaining.findIndex((video) => isOfficialYoutubeChannel(video.channel));
      if (ownIndex >= 0) {
        const [ownVideo] = remaining.splice(ownIndex, 1);
        const displaced = block.pop();
        if (displaced) remaining.unshift(displaced);
        if (ownVideo) block.push(ownVideo);
      }
    }
    ordered.push(...block);
  }
  return ordered;
}
