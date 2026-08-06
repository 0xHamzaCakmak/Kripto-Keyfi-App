import { apiUrl } from './apiClient';

export const ANALYTICS_CONSENT_KEY = 'kriptokeyfi:analytics-consent';
export type AnalyticsConsent = 'granted' | 'denied' | null;
export type NewsAnalyticsEvent = {
  type: 'NEWS_SUMMARY_VIEW' | 'NEWS_SOURCE_CLICK' | 'RELATED_NEWS_CLICK' | 'CATEGORY_CLICK' | 'WEB_VITAL';
  articleId?: string;
  sourceSlug?: string;
  category?: string;
  summaryWordCount?: number;
  durationMs?: number;
  scrollDepth?: number;
  targetArticleId?: string;
  metricName?: 'LCP' | 'CLS' | 'INP';
  metricValue?: number;
  pageType?: 'news-detail' | 'news-list' | 'other';
};

export const getAnalyticsConsent = (): AnalyticsConsent => {
  const value = localStorage.getItem(ANALYTICS_CONSENT_KEY);
  return value === 'granted' || value === 'denied' ? value : null;
};
export function setAnalyticsConsent(value: Exclude<AnalyticsConsent, null>) {
  localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
  window.dispatchEvent(new CustomEvent('kriptokeyfi-analytics-consent', { detail: value }));
}
export function trackNewsEvent(event: NewsAnalyticsEvent) {
  if (getAnalyticsConsent() !== 'granted') return;
  const payload = JSON.stringify(event);
  if (navigator.sendBeacon) {
    const sent = navigator.sendBeacon(`${apiUrl}/news/analytics`, new Blob([payload], { type: 'application/json' }));
    if (sent) return;
  }
  void fetch(`${apiUrl}/news/analytics`, { method: 'POST', credentials: 'include', keepalive: true, headers: { 'content-type': 'application/json' }, body: payload }).catch(() => undefined);
}

const pageType = (): NewsAnalyticsEvent['pageType'] => /^\/haberler\/[^/]+$/.test(location.pathname) ? 'news-detail' : location.pathname.startsWith('/haberler') ? 'news-list' : 'other';
let vitalsStarted = false;
export function startWebVitals() {
  if (vitalsStarted || getAnalyticsConsent() !== 'granted' || typeof PerformanceObserver === 'undefined') return;
  vitalsStarted = true;
  let lcp = 0;
  let cls = 0;
  let inp = 0;
  const observers: PerformanceObserver[] = [];
  const observe = (type: string, handler: (entries: PerformanceEntryList) => void) => {
    try { const observer = new PerformanceObserver((list) => handler(list.getEntries())); observer.observe({ type, buffered: true }); observers.push(observer); } catch { /* Browser bu metriği desteklemiyor. */ }
  };
  observe('largest-contentful-paint', (entries) => { lcp = entries.at(-1)?.startTime ?? lcp; });
  observe('layout-shift', (entries) => { for (const entry of entries as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) if (!entry.hadRecentInput) cls += entry.value ?? 0; });
  observe('event', (entries) => { for (const entry of entries) inp = Math.max(inp, entry.duration); });
  const flush = () => {
    const common = { type: 'WEB_VITAL' as const, pageType: pageType() };
    if (lcp) trackNewsEvent({ ...common, metricName: 'LCP', metricValue: Math.round(lcp) });
    trackNewsEvent({ ...common, metricName: 'CLS', metricValue: Number(cls.toFixed(4)) });
    if (inp) trackNewsEvent({ ...common, metricName: 'INP', metricValue: Math.round(inp) });
    observers.forEach((observer) => observer.disconnect());
  };
  window.addEventListener('pagehide', flush, { once: true });
}
