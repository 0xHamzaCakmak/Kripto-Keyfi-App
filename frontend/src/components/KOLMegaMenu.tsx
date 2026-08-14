import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, BarChart3, BookOpen, BriefcaseBusiness, ChevronDown, DatabaseZap, Globe2, LayoutDashboard } from 'lucide-react';
import { KOL_COUNTRIES } from '../data/kolCatalog';
import { cn } from '../lib/utils';

const productLinks = [
  { label: 'KOL Explorer', detail: 'Skor, ülke ve uzmanlığa göre keşfet', to: '/kol-intelligence', icon: Globe2 },
  { label: 'Kampanyalar', detail: 'Kampanya oluştur ve performansı ölç', to: '/company/campaigns', icon: BriefcaseBusiness },
  { label: 'KOL Dashboard', detail: 'Fiyatlarını, tekliflerini ve performansını yönet', to: '/kol/dashboard', icon: LayoutDashboard },
  { label: 'Skor Metodolojisi', detail: 'Puanların nasıl hesaplandığını incele', to: '/kol-intelligence/methodology', icon: BookOpen },
  { label: 'Veri Kaynakları', detail: 'KOL verisinin nasıl toplandığını ve doğrulandığını gör', to: '/kol-intelligence/data-sources', icon: DatabaseZap },
];

export function KOLMegaMenu({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname, location.search]);

  return <div
    className="relative"
    onMouseEnter={() => setOpen(true)}
    onMouseLeave={() => setOpen(false)}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
  >
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      aria-haspopup="menu"
      aria-expanded={open}
      className={cn('inline-flex items-center gap-1.5 pb-1 transition-colors hover:text-white', active ? 'border-b-2 border-primary text-primary' : 'text-on-surface-variant')}
    >
      KOL Intelligence <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')}/>
    </button>

    {open && <div className="absolute right-0 top-full z-[70] w-[min(92vw,860px)] pt-5" role="menu">
      <div className="overflow-hidden rounded-[24px] border border-outline/15 bg-surface shadow-2xl shadow-black/60">
        <div className="grid lg:grid-cols-[1.45fr_.75fr]">
          <section className="p-6">
            <div className="mb-5 flex items-center justify-between border-b border-outline/10 pb-4">
              <div><p className="text-[10px] font-black uppercase tracking-[.24em] text-primary">Ülkeye göre keşfet</p><h2 className="mt-1 font-headline text-lg font-black text-white">Kripto KOL pazarları</h2></div>
              <Link to="/kol-intelligence" className="inline-flex items-center gap-1 text-xs font-bold text-tertiary hover:text-primary">Tümünü gör <ArrowRight size={13}/></Link>
            </div>
            <div className="grid grid-cols-2 gap-x-7 gap-y-1 sm:grid-cols-3">
              {KOL_COUNTRIES.map((country, index) => <Link key={country.code} role="menuitem" to={`/kol-intelligence?country=${encodeURIComponent(country.name)}`} className={cn('group flex items-center justify-between rounded-lg px-2 py-2 text-xs font-bold transition-colors hover:bg-surface-high hover:text-white', index === 0 ? 'text-primary' : 'text-on-surface-variant')}><span>{country.name}</span><span className="text-[9px] font-black text-outline group-hover:text-primary">{country.code}</span></Link>)}
            </div>
          </section>
          <aside className="border-t border-outline/10 bg-background/35 p-5 lg:border-l lg:border-t-0">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[.22em] text-on-surface-variant">Intelligence araçları</p>
            <div className="space-y-1">{productLinks.map(({ label, detail, to, icon: Icon }) => <Link key={to} role="menuitem" to={to} className="group flex gap-3 rounded-xl p-3 hover:bg-surface-high"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon size={17}/></span><span><span className="block text-xs font-black text-white">{label}</span><span className="mt-1 block text-[10px] leading-4 text-on-surface-variant">{detail}</span></span></Link>)}</div>
            <Link to="/kol-intelligence/methodology" className="mt-4 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/8 p-3 text-xs font-black text-primary"><span className="inline-flex items-center gap-2"><BarChart3 size={15}/> KOL Score nasıl çalışır?</span><ArrowRight size={14}/></Link>
          </aside>
        </div>
      </div>
    </div>}
  </div>;
}

export function KOLMobileMenu() {
  const [open, setOpen] = useState(false);
  return <div className="rounded-2xl border border-primary/20 bg-primary/8">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-4 font-headline text-base font-semibold text-primary"><span>KOL Intelligence</span><ChevronDown size={17} className={cn('transition-transform', open && 'rotate-180')}/></button>
    {open && <div className="border-t border-primary/15 p-3"><div className="grid grid-cols-2 gap-1">{KOL_COUNTRIES.map((country) => <Link key={country.code} to={`/kol-intelligence?country=${encodeURIComponent(country.name)}`} className="rounded-lg px-2 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-high hover:text-white">{country.name}</Link>)}</div><div className="mt-3 grid gap-2"><Link to="/kol-intelligence/data-sources" className="flex items-center justify-between rounded-xl border border-primary/20 px-3 py-3 text-xs font-black text-primary">Veri Kaynakları <DatabaseZap size={14}/></Link><Link to="/kol-intelligence" className="flex items-center justify-between rounded-xl bg-primary px-3 py-3 text-xs font-black text-background">KOL Explorer’a git <ArrowRight size={14}/></Link></div></div>}
  </div>;
}
