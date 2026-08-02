import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BarChart3,
  MessageSquare,
  PlayCircle,
  Rocket,
  Users,
  Wallet
} from 'lucide-react';
import { ARTICLES, MESSAGES, PROJECTS } from '../constants';
import { HomeUpDownWidget } from './Games';
import { cn } from '../lib/utils';
import { useAuth } from '../auth/AuthContext';

const stats = [
  { label: 'Active Users', value: 'Yakında', icon: Users },
  { label: 'Listed Projects', value: 'Yakında', icon: Rocket },
  { label: 'Tracked Assets', value: 'Yakında', icon: Wallet },
  { label: 'Daily Signals', value: 'Yakında', icon: BarChart3 },
];

export default function Home() {
  const { user } = useAuth();
  const featuredProjects = PROJECTS.slice(0, 3);
  const latestArticles = ARTICLES.slice(0, 2);
  const pendingActions = user ? [
    ...(!user.profileCompleted ? [{ label: 'Profilini tamamla', to: '/profile' }] : []),
    ...(!user.username ? [{ label: 'Kullanıcı adını belirle', to: '/profile' }] : []),
    ...(!user.isEmailVerified ? [{ label: 'E-posta adresini doğrula', to: '/profile' }] : []),
    ...(!user.isWalletConnected ? [{ label: 'Cüzdanını bağla', to: '/connect-wallet' }] : []),
  ] : [];

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 xl:col-span-9 space-y-6">
        {user && (
          <section className="flex flex-col justify-between gap-4 rounded-[24px] border border-primary/10 bg-primary/5 p-5 md:flex-row md:items-center">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary">Hesabın</p><h2 className="mt-1 font-headline text-2xl font-black text-white">Hoş geldin, {user.fullName.split(' ')[0]}</h2><p className="mt-1 text-xs text-on-surface-variant">{pendingActions.length ? 'Hesabında tamamlayabileceğin işlemler var.' : 'Hesap profilin güncel.'}</p></div>
            {pendingActions.length > 0 && <div className="flex flex-wrap gap-2">{pendingActions.map((action) => <Link key={action.label} to={action.to} className="rounded-xl bg-surface-high px-3 py-2 text-xs font-bold text-primary hover:bg-surface-highest">{action.label}</Link>)}</div>}
          </section>
        )}
        <section className="relative overflow-hidden rounded-[32px] bg-surface border border-outline/5 p-8 md:p-10 min-h-[360px] flex flex-col justify-between">
          <div className="absolute inset-0">
            <img
              src="https://picsum.photos/seed/kripto-keyfi-home/1400/800"
              alt="Crypto market dashboard"
              className="h-full w-full object-cover opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/20" />
          </div>

          <div className="relative max-w-3xl space-y-6">
            <span className="inline-flex w-fit rounded-full bg-primary/12 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.28em] text-primary border border-primary/15">
              Web3 discovery platform
            </span>
            <div className="space-y-4">
              <h1 className="font-headline text-4xl md:text-6xl font-extrabold tracking-tight text-white">
                Kripto Keyfi
              </h1>
              <p className="max-w-2xl text-base md:text-lg leading-8 text-on-surface-variant">
                Portföy takibi, proje keşfi, içerik akışı ve topluluk sohbetini tek ekranda birleştiren kripto çalışma alanı.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/ecosystem"
                className="hero-gradient inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-background transition-all hover:shadow-[0_0_20px_rgba(141,172,255,0.35)]"
              >
                Explore Projects
                <ArrowRight size={16} />
              </Link>
              <Link
                to="/assets"
                className="inline-flex items-center gap-2 rounded-xl bg-surface-high px-5 py-3 text-sm font-bold text-on-surface transition-all hover:bg-surface-highest"
              >
                My Assets
                <Wallet size={16} />
              </Link>
            </div>
          </div>

          <div className="relative mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl bg-surface-high/80 border border-outline/5 p-4 backdrop-blur">
                <stat.icon className="mb-3 text-primary" size={18} />
                <div className="mb-1 flex items-center gap-2"><p className="font-headline text-sm font-extrabold text-white">{stat.value}</p><span className="rounded bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold text-primary">VERİ BEKLENİYOR</span></div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="font-headline text-lg font-bold text-white">Keşfedilecek örnek projeler</h2><span className="rounded-lg bg-primary/10 px-2 py-1 text-[9px] font-bold text-primary">ÖRNEK VERİ</span></div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {featuredProjects.map((project) => (
            <motion.article
              key={project.id}
              whileHover={{ y: -4 }}
              className="group rounded-[24px] bg-surface p-6 border border-outline/5 transition-all"
            >
              <div className="mb-6 flex items-start justify-between">
                <div className="h-12 w-12 overflow-hidden rounded-2xl bg-surface-high border border-outline/10">
                  <img src={project.icon} alt={project.name} className="h-full w-full object-cover" />
                </div>
                <span className={cn(
                  "rounded-lg border px-3 py-1 text-[10px] font-bold tracking-widest",
                  project.status === 'ACTIVE' ? 'border-secondary/20 bg-secondary/10 text-secondary' : 'border-primary/20 bg-primary/10 text-primary'
                )}>
                  {project.status}
                </span>
              </div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-primary">{project.category}</p>
              <h2 className="font-headline text-xl font-bold text-white">{project.name}</h2>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-on-surface-variant">{project.description}</p>
            </motion.article>
          ))}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-[24px] bg-surface border border-outline/5 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2"><h2 className="font-headline text-xl font-bold text-white">Latest Content</h2><span className="rounded bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold text-primary">ÖRNEK İÇERİK</span></div>
              <Link to="/insights" className="text-sm font-bold text-primary hover:underline">View All</Link>
            </div>
            <div className="space-y-4">
              {latestArticles.map((article) => (
                <Link key={article.id} to={`/insights/${article.id}`} className="group flex gap-4 rounded-2xl bg-surface-high/40 p-3 transition-colors hover:bg-surface-high">
                  <img src={article.image} alt={article.title} className="h-20 w-24 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-secondary">{article.category} / {article.readTime}</p>
                    <h3 className="line-clamp-2 font-headline text-sm font-bold text-white group-hover:text-primary">{article.title}</h3>
                    <p className="mt-2 text-xs text-on-surface-variant">{article.views} reads</p>
                  </div>
                </Link>
              ))}
              <div className="flex items-center justify-between rounded-2xl bg-surface-high/40 p-4">
                <div className="flex items-center gap-3">
                  <PlayCircle className="text-tertiary" size={24} />
                  <div>
                    <p className="font-headline text-sm font-bold text-white">Video Hub</p>
                    <p className="text-xs text-on-surface-variant">Market recaps and project walkthroughs</p>
                  </div>
                </div>
                <Link to="/videos" className="text-primary"><ArrowRight size={18} /></Link>
              </div>
            </div>
          </div>

          <HomeUpDownWidget />
        </section>
      </div>

      <aside className="col-span-12 xl:col-span-3">
        <div className="xl:sticky xl:top-32 rounded-[32px] bg-surface border border-outline/5 overflow-hidden">
          <header className="flex items-center justify-between border-b border-outline/5 p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MessageSquare size={18} />
              </span>
              <div>
                <h2 className="font-headline text-sm font-bold text-white">Global Chat</h2>
                <p className="text-[10px] font-medium text-secondary">Demo sohbet akışı</p>
              </div>
            </div>
          </header>

          <div className="max-h-[620px] space-y-5 overflow-y-auto p-5 no-scrollbar">
            {MESSAGES.map((msg) => (
              <div key={msg.id} className="flex gap-3">
                <img src={msg.user.avatar} alt={msg.user.name} className="h-9 w-9 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <p className="text-xs font-bold text-primary">{msg.user.name}</p>
                    <span className="text-[10px] text-on-surface-variant">{msg.timestamp}</span>
                  </div>
                  <p className="line-clamp-3 text-sm leading-6 text-on-surface/90">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-outline/5 p-5">
            <Link
              to="/chat"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-high py-3 text-sm font-bold text-primary transition-colors hover:bg-surface-highest"
            >
              Open Chat
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
