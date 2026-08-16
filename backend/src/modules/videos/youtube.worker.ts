import { YoutubeChannelStatus } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';
import { syncYoutubeChannel } from './video.service.js';

export async function runYoutubeSync() {
  const channels = await prisma.youtubeChannel.findMany({
    where: { status: YoutubeChannelStatus.ACTIVE }, orderBy: [{ lastSyncedAt: 'asc' }, { id: 'asc' }],
  });
  for (const channel of channels) {
    try {
      const result = await syncYoutubeChannel(channel);
      logger.info({ channelId: channel.channelId, created: result.created, discovered: result.discovered }, 'YouTube channel synchronized');
    } catch (error) {
      logger.warn({ channelId: channel.channelId, err: error }, 'YouTube channel synchronization failed');
    }
  }
}

export function scheduleYoutubeSync() {
  let running = false;
  const execute = async () => {
    if (running) return;
    running = true;
    try { await runYoutubeSync(); }
    catch (error) { logger.error({ err: error }, 'YouTube synchronization scheduler failed'); }
    finally { running = false; }
  };
  const timer = setInterval(() => { void execute(); }, env.YOUTUBE_SYNC_INTERVAL_MINUTES * 60_000);
  timer.unref();
  void execute();
  return () => clearInterval(timer);
}
