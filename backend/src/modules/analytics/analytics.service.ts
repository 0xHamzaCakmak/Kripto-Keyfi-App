import { Prisma, UserRole, UserStatus } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import type { AnalyticsEventName } from './analytics-events.service.js';
import { getMetrics, getPageviews, getStats, isUmamiConfigured, type DateRange } from './umami-api.service.js';

type RangeName = 'today' | '7d' | '30d' | '90d' | 'custom';

export function resolveRange(range: RangeName, startDate?: string, endDate?: string): DateRange {
  if (range === 'custom' && startDate && endDate) {
    return { startAt: new Date(`${startDate}T00:00:00+03:00`).getTime(), endAt: new Date(`${endDate}T23:59:59.999+03:00`).getTime() };
  }
  const endAt = Date.now();
  const start = new Date();
  if (range === 'today') start.setHours(0, 0, 0, 0);
  else start.setDate(start.getDate() - Number.parseInt(range, 10));
  return { startAt: start.getTime(), endAt };
}

const emptyStats = { pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0 };
const emptySeries = { pageviews: [], sessions: [] };

async function safeTraffic(range: DateRange) {
  if (!isUmamiConfigured()) return { stats: emptyStats, series: emptySeries, available: false };
  try {
    const [stats, series] = await Promise.all([getStats(range), getPageviews(range)]);
    return { stats, series, available: true };
  } catch {
    return { stats: emptyStats, series: emptySeries, available: false };
  }
}

export async function getOverview(rangeName: RangeName, startDate?: string, endDate?: string) {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now); monthStart.setDate(monthStart.getDate() - 30);
  const selectedRange = resolveRange(rangeName, startDate, endDate);
  const [selected, today, week, month, totalUsers, todayUsers, monthUsers, selectedUsers] = await Promise.all([
    safeTraffic(resolveRange(rangeName)), safeTraffic(resolveRange('today')), safeTraffic(resolveRange('7d')), safeTraffic(resolveRange('30d')),
    prisma.user.count({ where: { role: UserRole.USER, status: { not: UserStatus.DELETED } } }),
    prisma.user.count({ where: { role: UserRole.USER, status: { not: UserStatus.DELETED }, createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { role: UserRole.USER, status: { not: UserStatus.DELETED }, createdAt: { gte: monthStart } } }),
    prisma.user.count({ where: { role: UserRole.USER, status: { not: UserStatus.DELETED }, createdAt: { gte: new Date(selectedRange.startAt), lte: new Date(selectedRange.endAt) } } }),
  ]);
  return {
    configured: isUmamiConfigured(), available: selected.available, range: rangeName, stats: selected.stats, series: selected.series,
    visitorKpis: { today: today.stats.visitors, sevenDays: week.stats.visitors, thirtyDays: month.stats.visitors },
    users: { total: totalUsers, today: todayUsers, thirtyDays: monthUsers, selected: selectedUsers },
    conversionRate: selected.stats.visitors ? Number(((selectedUsers / selected.stats.visitors) * 100).toFixed(2)) : 0,
    ga4DashboardUrl: env.GA4_DASHBOARD_URL,
  };
}

export async function getTrafficMetrics(kind: 'pages' | 'referrers' | 'devices', rangeName: RangeName, startDate?: string, endDate?: string) {
  const range = resolveRange(rangeName, startDate, endDate);
  if (!isUmamiConfigured()) return { configured: false, ...(kind === 'devices' ? { devices: [], browsers: [], countries: [] } : { items: [] }) };
  try {
    if (kind === 'devices') {
      const [devices, browsers, countries] = await Promise.all([getMetrics('device', range), getMetrics('browser', range), getMetrics('country', range)]);
      return { configured: true, available: true, devices, browsers, countries };
    }
    return { configured: true, available: true, items: await getMetrics(kind === 'pages' ? 'path' : 'referrer', range) };
  } catch {
    return { configured: true, available: false, ...(kind === 'devices' ? { devices: [], browsers: [], countries: [] } : { items: [] }) };
  }
}

export async function getFunnel(steps: AnalyticsEventName[]) {
  const rows = await prisma.analyticsEvent.findMany({
    where: { eventName: { in: steps }, userId: { not: null } },
    select: { eventName: true, userId: true, createdAt: true }, orderBy: { createdAt: 'asc' },
  });
  let cohort: Map<string, Date> | null = null;
  const result = steps.map((step) => {
    const reached = new Map<string, Date>();
    for (const row of rows) {
      if (row.eventName !== step || !row.userId || reached.has(row.userId)) continue;
      const previousAt = cohort?.get(row.userId);
      if (!cohort || (previousAt && row.createdAt >= previousAt)) reached.set(row.userId, row.createdAt);
    }
    cohort = reached;
    return { step, users: reached.size };
  });
  return result.map((item, index) => ({ ...item, conversionRate: index === 0 ? 100 : result[index - 1]!.users ? Number(((item.users / result[index - 1]!.users) * 100).toFixed(2)) : 0 }));
}

const contentKeys = { video_open: 'video_id', news_open: 'news_id', coin_view: 'coin_id', article_read: 'article_id' } as const;

export async function getContent(eventName: keyof typeof contentKeys, rangeName: RangeName, startDate?: string, endDate?: string) {
  const start = new Date(resolveRange(rangeName, startDate, endDate).startAt);
  const path = `$.${contentKeys[eventName]}`;
  return prisma.$queryRaw<Array<{ contentId: string; views: bigint }>>(Prisma.sql`
    SELECT JSON_UNQUOTE(JSON_EXTRACT(metadata, ${path})) AS contentId, COUNT(*) AS views
    FROM analytics_events
    WHERE event_name = ${eventName} AND created_at >= ${start} AND JSON_EXTRACT(metadata, ${path}) IS NOT NULL
    GROUP BY JSON_UNQUOTE(JSON_EXTRACT(metadata, ${path})) ORDER BY views DESC LIMIT 50
  `).then((rows) => rows.map((row) => ({ contentId: row.contentId, views: Number(row.views) })));
}
