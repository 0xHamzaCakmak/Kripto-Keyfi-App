import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';

export const ANALYTICS_EVENT_NAMES = [
  'user_register', 'user_login', 'wallet_connect', 'coin_view', 'news_open',
  'video_open', 'youtube_connect', 'creator_application', 'airdrop_view', 'article_read',
] as const;

export type AnalyticsEventName = typeof ANALYTICS_EVENT_NAMES[number];

type TrackEventInput = {
  userId?: string | null | undefined;
  sessionId?: string | null | undefined;
  pagePath?: string | null | undefined;
  metadata?: Prisma.InputJsonValue | null | undefined;
};

export async function trackEvent(eventName: AnalyticsEventName, input: TrackEventInput = {}) {
  try {
    await prisma.analyticsEvent.create({
      data: {
        eventName,
        userId: input.userId || null,
        sessionId: input.sessionId?.slice(0, 64) || null,
        pagePath: input.pagePath?.slice(0, 500) || null,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  } catch (error) {
    logger.warn({ err: error, eventName }, 'Analytics event could not be recorded');
  }
}
