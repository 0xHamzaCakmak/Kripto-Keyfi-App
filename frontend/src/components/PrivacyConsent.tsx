import { useEffect, useState } from 'react';
import { getAnalyticsConsent, setAnalyticsConsent, startWebVitals, type AnalyticsConsent } from '../services/newsAnalytics';

export default function PrivacyConsent() {
  const [consent, setConsent] = useState<AnalyticsConsent>(() => getAnalyticsConsent());
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { if (consent === 'granted') startWebVitals(); }, [consent]);
  if (consent) return null;
  const choose = (value: Exclude<AnalyticsConsent, null>) => { setAnalyticsConsent(value); setConsent(value); };
  if (!expanded) return <button onClick={() => setExpanded(true)} className="fixed bottom-16 right-4 z-[80] rounded-full border border-primary/25 bg-[#11110f]/95 px-4 py-2 text-xs font-bold text-primary shadow-xl backdrop-blur">Gizlilik ve ölçüm tercihi</button>;
  return <aside role="dialog" aria-label="Ölçüm tercihi" className="fixed bottom-16 left-4 right-4 z-[80] mx-auto max-w-3xl rounded-2xl border border-primary/25 bg-[#11110f]/95 p-4 shadow-2xl backdrop-blur md:flex md:items-center md:gap-5">
    <p className="text-sm leading-6 text-on-surface-variant"><strong className="text-white">Ölçüm tercihi:</strong> İzin verirseniz Google Analytics çerezleri ile toplu trafik ölçümü, ayrıca anonim etkileşim ve Core Web Vitals verileri kullanılır. Reddettiğinizde çerezli Google Analytics yüklenmez.</p>
    <div className="mt-3 flex shrink-0 gap-2 md:mt-0"><button onClick={() => choose('denied')} className="rounded-xl border border-outline/15 px-4 py-2 text-sm font-bold text-on-surface">Reddet</button><button onClick={() => choose('granted')} className="rounded-xl bg-primary px-4 py-2 text-sm font-black text-background">İzin ver</button></div>
  </aside>;
}
