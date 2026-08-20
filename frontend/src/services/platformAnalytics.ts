import { api } from './apiClient';

export const PLATFORM_EVENT_NAMES = [
  'user_register', 'user_login', 'wallet_connect', 'coin_view', 'news_open',
  'video_open', 'youtube_connect', 'creator_application', 'airdrop_view', 'article_read',
] as const;
export type PlatformEventName = typeof PLATFORM_EVENT_NAMES[number];
type Metadata = Record<string, string | number | boolean | null>;

declare global {
  interface Window {
    umami?: { track: (name?: string, data?: Metadata) => void };
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const SESSION_KEY = 'kriptokeyfi:analytics-session';

function sessionId() {
  let value = sessionStorage.getItem(SESSION_KEY);
  if (!value) {
    value = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, value);
  }
  return value;
}

export function trackPlatformEvent(eventName: PlatformEventName, metadata?: Metadata) {
  if (location.pathname.startsWith('/admin')) return;
  trackUmamiEvent(eventName, metadata);
  void api.post('/analytics/events', { eventName, sessionId: sessionId(), pagePath: location.pathname, metadata }).catch(() => undefined);
}

export function trackUmamiEvent(eventName: PlatformEventName, metadata?: Metadata) {
  if (!location.pathname.startsWith('/admin')) window.umami?.track(eventName, metadata);
}
