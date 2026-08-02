import { useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  BookOpen,
  Building2,
  ChartNoAxesCombined,
  ChevronLeft,
  CircleDollarSign,
  FileClock,
  Gauge,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldAlert,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { cn } from '../lib/utils';
import { logout } from '../services/authService';

const primaryLinks = [
  { label: 'Genel Bakış', to: '/admin', icon: LayoutDashboard, end: true },
  { label: 'Trading Bot', to: '/admin/trading', icon: Bot, end: true },
  { label: 'Borsa Hesapları', to: '/admin/trading/accounts', icon: Building2 },
];

const phaseThreeLinks = [
  { label: 'Botlarım', to: '/admin/trading/bots', icon: ListChecks, end: true },
  { label: 'Bot Rehberi', to: '/admin/trading/bots/guide', icon: BookOpen, end: false },
  { label: 'Manuel İşlem', to: '/admin/trading/manual', icon: SlidersHorizontal, end: false },
  { label: 'Açık Pozisyonlar', to: '/admin/trading/positions', icon: ChartNoAxesCombined, end: false },
  { label: 'Açık Emirler', to: '/admin/trading/orders', icon: FileClock, end: false },
  { label: 'Grid Bot', to: '/admin/trading/grid', icon: Gauge, end: false },
  { label: 'Kâr / Zarar', to: '/admin/trading/profit-loss', icon: CircleDollarSign, end: false },
  { label: 'Risk Yönetimi', to: '/admin/trading/risk', icon: ShieldAlert, end: false },
  { label: 'Sistem Durumu', to: '/admin/trading/system', icon: Activity, end: false },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  async function signOut() {
    await logout();
    navigate('/login');
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className={cn('flex items-center border-b border-outline/10 p-5', collapsed ? 'justify-center' : 'justify-between')}>
        {!collapsed && <div><p className="text-xs font-black uppercase tracking-[0.24em] text-primary">KriptoKeyfi</p><p className="mt-1 font-headline text-lg font-extrabold text-white">Yönetim Merkezi</p></div>}
        <button type="button" onClick={() => setCollapsed((value) => !value)} className="hidden rounded-xl p-2 text-on-surface-variant hover:bg-surface-highest hover:text-white lg:inline-flex" aria-label={collapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}>
          {collapsed ? <PanelLeftOpen size={19}/> : <PanelLeftClose size={19}/>} 
        </button>
        <button type="button" onClick={() => setMobileOpen(false)} className="rounded-xl p-2 text-on-surface-variant hover:bg-surface-highest lg:hidden" aria-label="Menüyü kapat"><X size={20}/></button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto p-3" aria-label="Admin menüsü">
        <div className="space-y-1">
          {[...primaryLinks, ...phaseThreeLinks].map(({ label, to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} title={collapsed ? label : undefined} className={({ isActive }) => cn('flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition-colors', collapsed && 'justify-center', isActive ? 'bg-primary/15 text-primary' : 'text-on-surface-variant hover:bg-surface-high hover:text-white')}>
              <Icon size={19}/>{!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </div>

      </nav>

      <div className="border-t border-outline/10 p-3">
        {!collapsed && <div className="mb-2 rounded-2xl bg-surface-high p-3"><p className="truncate text-sm font-bold text-white">{user?.fullName}</p><p className="mt-1 text-[10px] font-black uppercase tracking-wider text-secondary">Admin oturumu</p></div>}
        <NavLink to="/" title={collapsed ? 'Siteye dön' : undefined} className={cn('flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-on-surface-variant hover:bg-surface-high hover:text-white', collapsed && 'justify-center')}><ChevronLeft size={18}/>{!collapsed && 'Siteye dön'}</NavLink>
        <button type="button" onClick={() => void signOut()} title={collapsed ? 'Çıkış yap' : undefined} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-error hover:bg-error/10', collapsed && 'justify-center')}><LogOut size={18}/>{!collapsed && 'Çıkış yap'}</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-12rem)]">
      <button type="button" onClick={() => { setCollapsed(false); setMobileOpen(true); }} className="mb-4 inline-flex items-center gap-2 rounded-xl border border-outline/10 bg-surface px-4 py-3 text-sm font-bold text-white lg:hidden"><Menu size={19}/> Yönetim menüsü</button>

      <div className="flex gap-6">
        <aside className={cn('sticky top-24 hidden h-[calc(100vh-8.5rem)] shrink-0 overflow-hidden rounded-[28px] border border-outline/10 bg-surface transition-[width] duration-200 lg:block', collapsed ? 'w-20' : 'w-64')}>{sidebar}</aside>
        <section className="min-w-0 flex-1"><Outlet/></section>
      </div>

      <div className={cn('fixed inset-0 z-[70] lg:hidden', mobileOpen ? 'pointer-events-auto' : 'pointer-events-none')} aria-hidden={!mobileOpen}>
        <button type="button" aria-label="Menüyü kapat" onClick={() => setMobileOpen(false)} className={cn('absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity', mobileOpen ? 'opacity-100' : 'opacity-0')}/>
        <aside className={cn('absolute bottom-2 left-2 top-2 w-[min(88vw,320px)] overflow-hidden rounded-[28px] border border-outline/10 bg-surface shadow-2xl transition-transform', mobileOpen ? 'translate-x-0' : '-translate-x-[110%]')}>{sidebar}</aside>
      </div>
    </div>
  );
}
