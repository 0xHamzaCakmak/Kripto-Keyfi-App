type VideoWithOwnership = { channel: { isOwnChannel: boolean } | null };

export function ensureOwnChannelInEveryFive<T extends VideoWithOwnership>(videos: T[]) {
  const remaining = [...videos];
  const ordered: T[] = [];
  while (remaining.length > 0) {
    const block = remaining.splice(0, 5);
    if (!block.some((video) => video.channel?.isOwnChannel)) {
      const ownIndex = remaining.findIndex((video) => video.channel?.isOwnChannel);
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
