import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getContent, getFunnel, getOverview, getTraffic, type AnalyticsPeriod, type AnalyticsRange, type Metric, type Overview } from '../services/adminAnalyticsService';

const ranges: Array<{ value: AnalyticsRange; label: string }> = [
  { value: 'today', label: 'Bugün' }, { value: '7d', label: '7 gün' }, { value: '30d', label: '30 gün' }, { value: '90d', label: '90 gün' },
  { value: 'custom', label: 'Özel' },
];
const today = new Date().toISOString().slice(0, 10);
const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
const defaultPeriod: AnalyticsPeriod = { range: '30d', start: monthAgo, end: today };

function RangePicker({ value, onChange }: { value: AnalyticsPeriod; onChange: (value: AnalyticsPeriod) => void }) {
  return <div className="flex flex-wrap items-center gap-2">{ranges.map((item) => <button key={item.value} type="button" onClick={() => onChange({ ...value, range: item.value })} className={`rounded-xl px-3 py-2 text-xs font-black ${value.range === item.value ? 'bg-primary text-background' : 'bg-surface-high text-on-surface-variant'}`}>{item.label}</button>)}{value.range === 'custom' && <><input aria-label="Başlangıç tarihi" type="date" value={value.start} max={value.end} onChange={(event) => onChange({ ...value, start: event.target.value })} className="rounded-xl bg-surface-high px-3 py-2 text-xs text-white"/><input aria-label="Bitiş tarihi" type="date" value={value.end} min={value.start} max={today} onChange={(event) => onChange({ ...value, end: event.target.value })} className="rounded-xl bg-surface-high px-3 py-2 text-xs text-white"/></>}</div>;
}
function EmptyConfig() { return <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-on-surface-variant"><AlertTriangle className="shrink-0 text-primary" size={19}/><p>Umami bağlantısı henüz yapılandırılmadı. Kullanıcı ve iş metriği verileri çalışmaya devam eder; trafik alanları env değerleri eklendiğinde otomatik dolar.</p></div>; }
function Unavailable() { return <div className="flex items-start gap-3 rounded-2xl border border-error/20 bg-error/5 p-4 text-sm text-on-surface-variant"><AlertTriangle className="shrink-0 text-error" size={19}/><p>Umami’ye şu anda ulaşılamıyor. Kullanıcı ve iş metrikleri kullanılabilir; trafik alanları servis yeniden erişilebilir olduğunda otomatik yenilenir.</p></div>; }
function Loading() { return <div className="h-64 animate-pulse rounded-3xl bg-surface-high"/>; }

export default function AnalyticsOverview() {
  const [period, setPeriod] = useState<AnalyticsPeriod>(defaultPeriod);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setError(''); void getOverview(period).then(setData).catch(() => setError('Analytics verileri yüklenemedi.')); }, [period]);
  const chart = useMemo(() => {
    const sessions = new Map(data?.series.sessions.map((item) => [item.x, item.y]));
    return data?.series.pageviews.map((item) => ({ date: item.x.slice(5, 10), pageviews: item.y, visitors: sessions.get(item.x) ?? 0 })) ?? [];
  }, [data]);
  if (!data && !error) return <Loading/>;
  return <div className="space-y-5">
    <div className="flex flex-col gap-3 rounded-3xl border border-outline/10 bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"><RangePicker value={period} onChange={setPeriod}/>{data?.ga4DashboardUrl && <a href={data.ga4DashboardUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-primary">GA4 Dashboard’unu Aç <ExternalLink size={15}/></a>}</div>
    {error && <p className="rounded-2xl bg-error/10 p-4 text-sm text-error">{error}</p>}{data && !data.configured && <EmptyConfig/>}
    {data?.configured && !data.available && <Unavailable/>}
    {data && <><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{[
      ['Bugünkü ziyaretçi', data.visitorKpis.today], ['Son 7 gün', data.visitorKpis.sevenDays], ['Son 30 gün', data.visitorKpis.thirtyDays],
      ['Sayfa görüntüleme', data.stats.pageviews], ['Oturum', data.stats.visits], ['Kayıtlı kullanıcı', data.users.total],
    ].map(([label, value]) => <div key={label} className="rounded-2xl border border-outline/10 bg-surface p-4"><p className="text-xs font-bold text-on-surface-variant">{label}</p><p className="mt-2 text-2xl font-black text-white">{Number(value).toLocaleString('tr-TR')}</p></div>)}</section>
    <section className="rounded-3xl border border-outline/10 bg-surface p-5"><div className="mb-5 flex items-end justify-between"><div><h2 className="font-headline text-xl font-black text-white">Trafik eğilimi</h2><p className="mt-1 text-xs text-on-surface-variant">Ziyaretçi ve sayfa görüntüleme</p></div><p className="text-sm font-black text-secondary">Dönüşüm %{data.conversionRate}</p></div><div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><defs><linearGradient id="views" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f4bd37" stopOpacity={0.35}/><stop offset="95%" stopColor="#f4bd37" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#ffffff12"/><XAxis dataKey="date" tick={{ fill: '#999', fontSize: 11 }}/><YAxis tick={{ fill: '#999', fontSize: 11 }}/><Tooltip contentStyle={{ background: '#181816', border: '1px solid #ffffff1a', borderRadius: 12 }}/><Area type="monotone" dataKey="pageviews" stroke="#f4bd37" fill="url(#views)" name="Sayfa"/><Area type="monotone" dataKey="visitors" stroke="#59d8b8" fill="transparent" name="Ziyaretçi"/></AreaChart></ResponsiveContainer></div></section></>}
  </div>;
}

function MetricTable({ title, items }: { title: string; items: Metric[] }) { return <section className="rounded-3xl border border-outline/10 bg-surface p-5"><h2 className="font-headline text-xl font-black text-white">{title}</h2><div className="mt-4 divide-y divide-outline/10">{items.map((item, index) => <div key={`${item.x}-${index}`} className="flex items-center justify-between gap-4 py-3"><span className="truncate text-sm text-on-surface">{item.x || 'Direct'}</span><span className="font-black text-primary">{item.y.toLocaleString('tr-TR')}</span></div>)}{items.length === 0 && <p className="py-8 text-center text-sm text-on-surface-variant">Henüz veri yok.</p>}</div></section>; }

export function AnalyticsTraffic({ type }: { type: 'top-pages' | 'referrers' | 'devices' }) {
  const [period, setPeriod] = useState<AnalyticsPeriod>(defaultPeriod); const [data, setData] = useState<any>(null);
  useEffect(() => { void getTraffic(type, period).then(setData); }, [type, period]);
  if (!data) return <Loading/>;
  return <div className="space-y-5"><RangePicker value={period} onChange={setPeriod}/>{!data.configured && <EmptyConfig/>}{data.configured && data.available === false && <Unavailable/>}{type === 'devices' ? <div className="grid gap-5 xl:grid-cols-3"><MetricTable title="Cihazlar" items={data.devices}/><MetricTable title="Tarayıcılar" items={data.browsers}/><MetricTable title="Ülkeler" items={data.countries}/></div> : <MetricTable title={type === 'top-pages' ? 'En çok ziyaret edilen sayfalar' : 'Trafik kaynakları'} items={data.items}/>}</div>;
}

export function AnalyticsFunnel() {
  const options = ['user_register', 'user_login', 'wallet_connect', 'youtube_connect', 'creator_application'];
  const [steps, setSteps] = useState(['user_register', 'wallet_connect', 'youtube_connect', 'creator_application']);
  const [data, setData] = useState<Array<{ step: string; users: number; conversionRate: number }> | null>(null);
  useEffect(() => { setData(null); void getFunnel(steps).then(setData); }, [steps]);
  if (!data) return <Loading/>;
  return <div className="space-y-5"><section className="rounded-3xl border border-outline/10 bg-surface p-5"><div className="flex items-center gap-2"><RefreshCw size={18} className="text-primary"/><h2 className="font-headline text-xl font-black text-white">Funnel adımları</h2></div><div className="mt-4 flex flex-wrap gap-2">{options.map((option) => { const checked = steps.includes(option); return <label key={option} className={`cursor-pointer rounded-xl px-3 py-2 text-xs font-bold ${checked ? 'bg-primary/15 text-primary' : 'bg-surface-high text-on-surface-variant'}`}><input type="checkbox" className="sr-only" checked={checked} onChange={() => setSteps((current) => checked ? (current.length > 1 ? current.filter((item) => item !== option) : current) : options.filter((item) => current.includes(item) || item === option))}/>{option.replaceAll('_', ' ')}</label>; })}</div></section><section className="rounded-3xl border border-outline/10 bg-surface p-5"><h2 className="font-headline text-xl font-black text-white">Kullanıcı edinme funnel’ı</h2><div className="mt-6 space-y-3">{data.map((item, index) => <div key={item.step} className="mx-auto rounded-2xl bg-surface-high p-4 text-center" style={{ width: `${Math.max(45, 100 - index * 14)}%` }}><p className="text-xs font-black uppercase tracking-wider text-on-surface-variant">{item.step.replaceAll('_', ' ')}</p><p className="mt-1 text-2xl font-black text-white">{item.users}</p><p className="text-xs text-secondary">%{item.conversionRate}</p></div>)}</div></section></div>;
}

export function AnalyticsContent() {
  const [period, setPeriod] = useState<AnalyticsPeriod>(defaultPeriod);
  const [groups, setGroups] = useState<Record<string, Array<{ contentId: string; views: number }>>>({});
  const definitions = [['video_open', 'Videolar'], ['news_open', 'Haberler'], ['coin_view', 'Coinler'], ['article_read', 'Makaleler']] as const;
  useEffect(() => { void Promise.all(definitions.map(async ([event]) => [event, await getContent(event, period)] as const)).then((rows) => setGroups(Object.fromEntries(rows))); }, [period]);
  return <div className="space-y-5"><RangePicker value={period} onChange={setPeriod}/><div className="grid gap-5 xl:grid-cols-2">{definitions.map(([event, title]) => <MetricTable key={event} title={title} items={(groups[event] ?? []).map((item) => ({ x: item.contentId, y: item.views }))}/>)}</div></div>;
}
