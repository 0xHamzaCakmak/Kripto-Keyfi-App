import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Bot,
  BookOpen,
  Building2,
  ChartNoAxesCombined,
  CircleDollarSign,
  FileClock,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  ShieldAlert,
  SlidersHorizontal,
  Target,
  UsersRound,
  Link2,
  RadioTower,
  UserRoundCheck,
  BarChart3,
  MonitorSmartphone,
  Route,
  FileText,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../lib/utils';

export type AdminModuleTab = {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
};

type AdminModuleLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  tabs: AdminModuleTab[];
};

export function AdminModuleLayout({ eyebrow, title, description, tabs }: AdminModuleLayoutProps) {
  return (
    <div className="space-y-5">
      <header className="rounded-[28px] border border-outline/10 bg-surface p-4 md:p-5">
        <div className="px-1 pb-4">
          <p className="text-[10px] font-black uppercase tracking-[.22em] text-primary">{eyebrow}</p>
          <div className="mt-1 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <h1 className="font-headline text-2xl font-black text-white">{title}</h1>
            <p className="max-w-2xl text-xs leading-5 text-on-surface-variant md:text-right">{description}</p>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto rounded-2xl bg-background/55 p-1.5" aria-label={`${title} alt menüsü`}>
          {tabs.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => cn(
                'inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition-colors',
                isActive
                  ? 'bg-primary text-background shadow-[0_6px_22px_rgba(244,189,55,.16)]'
                  : 'text-on-surface-variant hover:bg-surface-high hover:text-white',
              )}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <Outlet />
    </div>
  );
}

const tradingTabs: AdminModuleTab[] = [
  { label: 'Genel Bakış', to: '/admin/trading', icon: LayoutDashboard, end: true },
  { label: 'AI Trading', to: '/admin/trading/ai', icon: Sparkles },
  { label: 'AI Trading Pro', to: '/admin/trading/ai-pro', icon: Sparkles },
  { label: 'Pozisyonlar', to: '/admin/trading/positions', icon: ChartNoAxesCombined },
  { label: 'Botlarım', to: '/admin/trading/bots', icon: ListChecks, end: true },
  { label: 'Bot Rehberi', to: '/admin/trading/guide', icon: BookOpen, end: true },
  { label: 'Manuel İşlem', to: '/admin/trading/manual', icon: SlidersHorizontal },
  { label: 'Borsa Hesapları', to: '/admin/trading/exchanges', icon: Building2 },
  { label: 'Emirler', to: '/admin/trading/orders', icon: FileClock },
  { label: 'Grid Bot', to: '/admin/trading/grid', icon: Gauge },
  { label: 'Kâr / Zarar', to: '/admin/trading/profit-loss', icon: CircleDollarSign },
  { label: 'Risk', to: '/admin/trading/risk', icon: ShieldAlert },
  { label: 'Sistem', to: '/admin/trading/system', icon: Activity },
];

const kolTabs: AdminModuleTab[] = [
  { label: 'Genel Bakış', to: '/admin/kol', icon: LayoutDashboard, end: true },
  { label: 'Influencer Listesi', to: '/admin/kol/intelligence', icon: UsersRound },
  { label: 'Prediction Review', to: '/admin/kol/predictions', icon: Target },
  { label: 'Kampanyalar', to: '/admin/kol/campaigns', icon: Megaphone },
];

const videoTabs: AdminModuleTab[] = [
  { label: 'Video Ekle', to: '/admin/videos', icon: Link2, end: true },
  { label: 'YouTuberlar', to: '/admin/videos/channels', icon: RadioTower },
  { label: 'Skor Kriterleri', to: '/admin/videos/scoring', icon: Gauge },
  { label: 'Creator Başvuruları', to: '/admin/videos/creators', icon: UserRoundCheck },
];

const analyticsTabs: AdminModuleTab[] = [
  { label: 'Genel Bakış', to: '/admin/analytics', icon: LayoutDashboard, end: true },
  { label: 'Sayfalar', to: '/admin/analytics/pages', icon: FileText },
  { label: 'Kaynaklar', to: '/admin/analytics/referrers', icon: RadioTower },
  { label: 'Cihazlar', to: '/admin/analytics/devices', icon: MonitorSmartphone },
  { label: 'Funnel', to: '/admin/analytics/funnel', icon: Route },
  { label: 'İçerikler', to: '/admin/analytics/content', icon: BarChart3 },
];

const chatTabs: AdminModuleTab[] = [
  { label: 'Oda Yönetimi', to: '/admin/chat', icon: MessageSquare, end: true },
];

export function TradingModuleLayout() {
  return <AdminModuleLayout eyebrow="Yönetim modülü" title="Trading Bot" description="Botlar, hesaplar, işlemler ve risk kontrolleri tek çalışma alanında." tabs={tradingTabs} />;
}

export function KolModuleLayout() {
  return <AdminModuleLayout eyebrow="Yönetim modülü" title="KOL Intelligence" description="Influencer verisi, tahmin doğruluğu ve kampanya operasyonlarını birlikte yönetin." tabs={kolTabs} />;
}

export function VideoModuleLayout() {
  return <AdminModuleLayout eyebrow="İçerik modülü" title="Videolar" description="YouTube bağlantılarını yönetin ve Video Merkezi’nde yayınlayın." tabs={videoTabs} />;
}

export function AnalyticsModuleLayout() {
  return <AdminModuleLayout eyebrow="Ölçüm modülü" title="Analytics" description="Trafik, kullanıcı dönüşümü ve içerik performansını tek çalışma alanında izleyin." tabs={analyticsTabs} />;
}

export function ChatModuleLayout() {
  return <AdminModuleLayout eyebrow="Topluluk modülü" title="Sohbet" description="Canlı topluluk odalarını, görünürlüklerini ve mesaj saklama durumunu yönetin." tabs={chatTabs} />;
}
