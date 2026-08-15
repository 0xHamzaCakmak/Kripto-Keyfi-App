import { ArrowRight, BriefcaseBusiness, Target, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';

const workspaces = [
  {
    title: 'Influencer Listesi',
    description: 'KOL profillerini, sosyal hesaplarını, skorlarını ve veri güvenini yönetin.',
    to: '/admin/kol/intelligence',
    icon: UsersRound,
  },
  {
    title: 'Prediction Review',
    description: 'Kripto tahminlerini kaynak, hedef ve gerçekleşen sonuçla değerlendirin.',
    to: '/admin/kol/predictions',
    icon: Target,
  },
  {
    title: 'KOL Kampanyaları',
    description: 'Marka kampanyalarını, bütçeleri ve influencer atamalarını takip edin.',
    to: '/admin/kol/campaigns',
    icon: BriefcaseBusiness,
  },
] as const;

export default function KOLModuleOverview() {
  return (
    <section className="grid gap-4 lg:grid-cols-3">
      {workspaces.map(({ title, description, to, icon: Icon }) => (
        <Link key={to} to={to} className="group rounded-[26px] border border-outline/10 bg-surface p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface-high">
          <div className="flex items-start justify-between gap-4">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon size={20} /></span>
            <ArrowRight className="text-outline transition group-hover:translate-x-1 group-hover:text-primary" size={18} />
          </div>
          <h2 className="mt-6 font-headline text-xl font-black text-white">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">{description}</p>
        </Link>
      ))}
    </section>
  );
}
