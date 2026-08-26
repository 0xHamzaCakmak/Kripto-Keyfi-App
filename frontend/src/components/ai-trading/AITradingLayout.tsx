import { Activity, ChartNoAxesCombined, Database, LayoutDashboard, Orbit, ShieldAlert, Trophy } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../../lib/utils';

const tabs = [
  ['Genel Bakış', '/admin/trading/ai', LayoutDashboard, true],
  ['Arena', '/admin/trading/ai/arena', Orbit],
  ['Champions', '/admin/trading/ai/champions', Trophy],
  ['Memory', '/admin/trading/ai/memory', Database],
  ['Performance', '/admin/trading/ai/performance', ChartNoAxesCombined],
  ['Risk', '/admin/trading/ai/risk', ShieldAlert],
  ['Live hazırlık', '/admin/trading/ai/shadow-live', Activity],
] as const;

export default function AITradingLayout() {
  return <div className="space-y-5">
    <div className="rounded-2xl border border-outline/10 bg-surface p-2">
      <div className="flex gap-1 overflow-x-auto" aria-label="AI Trading alt menüsü">
        {tabs.map(([label, to, Icon, end]) => <NavLink key={to} to={to} end={end === true} className={({ isActive }) => cn('inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition-colors', isActive ? 'bg-surface-highest text-primary' : 'text-on-surface-variant hover:bg-surface-high hover:text-white')}><Icon size={15} />{label}</NavLink>)}
      </div>
    </div>
    <Outlet />
  </div>;
}
