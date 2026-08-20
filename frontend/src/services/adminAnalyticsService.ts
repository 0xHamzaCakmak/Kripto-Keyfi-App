import { api } from './apiClient';

export type AnalyticsRange = 'today' | '7d' | '30d' | '90d' | 'custom';
export type AnalyticsPeriod = { range: AnalyticsRange; start?: string; end?: string };
export type Metric = { x: string; y: number };
export type Overview = {
  configured: boolean;
  available: boolean;
  range: AnalyticsRange;
  stats: { pageviews: number; visitors: number; visits: number; bounces: number; totaltime: number };
  series: { pageviews: Metric[]; sessions: Metric[] };
  visitorKpis: { today: number; sevenDays: number; thirtyDays: number };
  users: { total: number; today: number; thirtyDays: number; selected: number };
  conversionRate: number;
  ga4DashboardUrl: string;
};

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;
export const getOverview = async (period: AnalyticsPeriod) => unwrap(await api.get('/admin/analytics/overview', { params: period })) as Overview;
export const getTraffic = async (type: 'top-pages' | 'referrers' | 'devices', period: AnalyticsPeriod) => unwrap(await api.get(`/admin/analytics/${type}`, { params: period }));
export const getFunnel = async (steps: string[]) => unwrap(await api.get('/admin/analytics/funnel', { params: { steps: steps.join(',') } })) as Array<{ step: string; users: number; conversionRate: number }>;
export const getContent = async (eventName: string, period: AnalyticsPeriod) => unwrap(await api.get('/admin/analytics/content', { params: { event_name: eventName, ...period } })) as Array<{ contentId: string; views: number }>;
