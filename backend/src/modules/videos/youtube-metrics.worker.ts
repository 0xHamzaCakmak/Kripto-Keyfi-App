import { YoutubeChannelStatus, type YoutubeChannel } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { getChannelStatistics, getRecentVideosStats } from '../../services/youtubeApi.js';
import { logger } from '../../utils/logger.js';
import { calculateYoutubeChannelScores } from './youtube-score.service.js';

const MYSQL_INT_MAX = 2_147_483_647;

function toMysqlInt(value: number | null) {
  return value === null ? null : Math.min(MYSQL_INT_MAX, Math.max(0, Math.round(value)));
}

export function utcDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function collectYoutubeChannelMetrics(
  channel: Pick<YoutubeChannel, 'id' | 'channelId' | 'uploadsPlaylistId'>,
  collectedAt = new Date(),
) {
  const snapshotDate = utcDateOnly(collectedAt);
  const uploadsSince = new Date(collectedAt.getTime() - 90 * 24 * 60 * 60 * 1_000);
  const [statistics, recent, uploadsLast90Days] = await Promise.all([
    getChannelStatistics(channel.channelId),
    getRecentVideosStats(channel.uploadsPlaylistId, 20),
    prisma.video.count({ where: { channelId: channel.id, publishedAt: { gte: uploadsSince } } }),
  ]);
  const metrics = {
    subscriberCount: toMysqlInt(statistics.subscriberCount),
    totalViewCount: statistics.totalViewCount,
    videoCount: toMysqlInt(statistics.videoCount),
    avgViewsRecent: toMysqlInt(recent.avgViews),
    avgLikesRecent: toMysqlInt(recent.avgLikes),
    avgCommentsRecent: toMysqlInt(recent.avgComments),
    uploadsLast90Days,
  };
  return prisma.youtubeChannelMetricSnapshot.upsert({
    where: { channelId_snapshotDate: { channelId: channel.id, snapshotDate } },
    create: { channelId: channel.id, snapshotDate, ...metrics },
    update: metrics,
  });
}

export async function runYoutubeMetricsCollection(collectedAt = new Date()) {
  const channels = await prisma.youtubeChannel.findMany({
    where: { status: YoutubeChannelStatus.ACTIVE },
    orderBy: { id: 'asc' },
  });
  let collected = 0;
  let failed = 0;
  for (const channel of channels) {
    try {
      await collectYoutubeChannelMetrics(channel, collectedAt);
      collected += 1;
      logger.info({ channelId: channel.channelId, snapshotDate: utcDateOnly(collectedAt) }, 'YouTube channel metrics collected');
    } catch (error) {
      failed += 1;
      logger.warn({ channelId: channel.channelId, err: error }, 'YouTube channel metrics collection failed');
    }
  }
  const scoring = await calculateYoutubeChannelScores(collectedAt);
  return { activeChannels: channels.length, collected, failed, scoring };
}

export function scheduleYoutubeMetricsCollection() {
  let running = false;
  const execute = async () => {
    if (running) return;
    running = true;
    try {
      const result = await runYoutubeMetricsCollection();
      logger.info(result, 'YouTube metrics collection completed');
    } catch (error) {
      logger.error({ err: error }, 'YouTube metrics collection scheduler failed');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => { void execute(); }, env.YOUTUBE_METRICS_INTERVAL_HOURS * 60 * 60_000);
  timer.unref();
  void execute();
  return () => clearInterval(timer);
}
