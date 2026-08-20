import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getAnalyticsConsent } from '../services/newsAnalytics';

const GA_SCRIPT_ID = 'kriptokeyfi-ga4';
const UMAMI_SCRIPT_ID = 'kriptokeyfi-umami';

function removeScript(id: string) { document.getElementById(id)?.remove(); }

export default function AnalyticsTracker() {
  const location = useLocation();
  const previousPath = useRef<string | null>(null);
  const isAdmin = location.pathname.startsWith('/admin');

  useEffect(() => {
    if (isAdmin) {
      removeScript(GA_SCRIPT_ID);
      removeScript(UMAMI_SCRIPT_ID);
      return;
    }
    const umamiWebsiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
    const umamiScriptUrl = import.meta.env.VITE_UMAMI_SCRIPT_URL;
    if (umamiWebsiteId && umamiScriptUrl && !document.getElementById(UMAMI_SCRIPT_ID)) {
      const script = document.createElement('script');
      script.id = UMAMI_SCRIPT_ID;
      script.defer = true;
      script.src = umamiScriptUrl;
      script.dataset.websiteId = umamiWebsiteId;
      script.dataset.autoTrack = 'false';
      document.head.appendChild(script);
    }
  }, [isAdmin]);

  useEffect(() => {
    const configureGa = () => {
      if (isAdmin || getAnalyticsConsent() !== 'granted') return;
      const measurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID;
      if (!measurementId) return;
      window.dataLayer ??= [];
      window.gtag ??= (...args: unknown[]) => { window.dataLayer?.push(args); };
      if (!document.getElementById(GA_SCRIPT_ID)) {
        const script = document.createElement('script');
        script.id = GA_SCRIPT_ID;
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        document.head.appendChild(script);
        window.gtag('js', new Date());
        window.gtag('config', measurementId, { send_page_view: false });
      }
      window.gtag('event', 'page_view', { page_path: `${location.pathname}${location.search}`, page_title: document.title });
    };
    configureGa();
    window.addEventListener('kriptokeyfi-analytics-consent', configureGa);
    return () => window.removeEventListener('kriptokeyfi-analytics-consent', configureGa);
  }, [isAdmin, location.pathname, location.search]);

  useEffect(() => {
    if (isAdmin) return;
    const path = `${location.pathname}${location.search}`;
    if (previousPath.current === path) return;
    previousPath.current = path;
    const send = () => window.umami?.track();
    if (window.umami) send(); else document.getElementById(UMAMI_SCRIPT_ID)?.addEventListener('load', send, { once: true });
  }, [isAdmin, location.pathname, location.search]);

  return null;
}
