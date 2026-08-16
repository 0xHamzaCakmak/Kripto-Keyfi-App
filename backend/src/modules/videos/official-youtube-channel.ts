export const OFFICIAL_YOUTUBE_CHANNEL_ID = 'UC9Pj2oK99ghwgtqdpWR2DoA';

type YoutubeChannelIdentity = {
  channelId?: string | null;
  isOwnChannel?: boolean;
};

export function isOfficialYoutubeChannel(channel: YoutubeChannelIdentity | null | undefined) {
  return Boolean(channel && (channel.isOwnChannel || channel.channelId === OFFICIAL_YOUTUBE_CHANNEL_ID));
}
