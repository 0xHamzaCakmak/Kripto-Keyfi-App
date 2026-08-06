import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BellRing, Download, ShieldCheck, WifiOff } from 'lucide-react';
import { MESSAGES, PROJECTS } from '../constants';
import type { NewsArticle } from '../types';
import { useAuth } from '../auth/AuthContext';
import { getNews } from '../services/newsService';
import { HomeUpDownWidget } from './Games';
import NewsArtwork from './NewsArtwork';

const projectDescriptions: Record<string, string> = {
  'Nebula DEX': 'Zincirler arası likidite ve yield fırsatlarını bir araya getiren yeni nesil merkeziyetsiz borsa.',
  'Titan Protocol': 'Web3 sermaye piyasaları için kurumsal odaklı borç verme ve likidite altyapısı.',
  'Zenith NFT': 'Üretici sanatçılara ve tekil eserlere odaklanan küratörlü dijital sanat pazarı.',
};

const chatCopy = [
  "BTC'de borsalara ani giriş var; kısa vadeli hareketlilik artabilir.",
  'Yeni ETH paritesi için likidite araçları güncelleniyor.',
  "Mainnet güncellemesi sonrası ETH ve staking gündemi yakından izleniyor.",
];

const formatDate = (value: string) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short' }).format(new Date(value));

export default function Home() {
  const { user } = useAuth();
  const [news, setNews] = useState<NewsArticle[]>([]);

  useEffect(() => {
    let active = true;
    getNews().then((result) => active && setNews(result.articles.slice(0, 3))).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const pendingActions = user ? [
    ...(!user.profileCompleted ? [{ label: 'Profilini tamamla', to: '/profile' }] : []),
    ...(!user.username ? [{ label: 'Kullanıcı adını belirle', to: '/profile' }] : []),
    ...(!user.isEmailVerified ? [{ label: 'E-postanı doğrula', to: '/profile' }] : []),
    ...(!user.isWalletConnected ? [{ label: 'Cüzdanını bağla', to: '/connect-wallet' }] : []),
  ] : [];

  return (
    <div className="space-y-8 md:space-y-12">
      {user && pendingActions.length > 0 && (
        <section className="flex flex-col gap-4 rounded-2xl border border-primary/15 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[.18em] text-primary">Hoş geldin, {user.fullName.split(' ')[0]}</p><p className="mt-1 text-sm text-on-surface-variant">Hesabında tamamlayabileceğin birkaç işlem var.</p></div>
          <div className="flex flex-wrap gap-2">{pendingActions.map((item) => <Link key={item.label} to={item.to} className="rounded-lg bg-surface-high px-3 py-2 text-xs font-bold text-primary">{item.label}</Link>)}</div>
        </section>
      )}

      <section className="relative overflow-hidden rounded-[30px] border border-outline/10 bg-[#0d0d12] p-6 sm:p-8 lg:p-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_50%_at_86%_8%,rgba(240,169,58,.12),transparent_65%),radial-gradient(ellipse_38%_45%_at_5%_95%,rgba(45,217,184,.07),transparent_65%)]" />
        <div className="relative grid gap-10 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,.8fr)] xl:items-start">
          <div className="py-3 lg:py-8">
            <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[.18em] text-secondary"><span className="h-2 w-2 rounded-full bg-secondary shadow-[0_0_0_4px_rgba(45,217,184,.13)]" /> Piyasa canlı — 24 saat kesintisiz</p>
            <h1 className="mt-6 max-w-[14ch] font-headline text-4xl font-extrabold leading-[1.03] tracking-[-.035em] text-white sm:text-5xl lg:text-6xl">Web3'te kaybolmadan, <span className="text-primary">keyifle</span> takip et.</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-on-surface-variant sm:text-lg">Haberler, proje keşfi, piyasa takibi ve topluluk sohbetini tek ekranda birleştiren Türkçe kripto çalışma alanı.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/haberler" className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-background">Haberleri Oku <ArrowRight size={16} /></Link>
              <Link to="/ecosystem" className="inline-flex items-center gap-2 rounded-xl border border-outline/20 bg-surface/60 px-5 py-3 text-sm font-bold text-white">Projeleri Keşfet</Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-10 gap-y-4 border-t border-outline/10 pt-6">
              <div><b className="block font-mono text-xl font-medium text-white">Canlı</b><span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Haber Akışı</span></div>
              <div><b className="block font-mono text-xl font-medium text-white">{PROJECTS.length}</b><span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Keşif Kartı</span></div>
              <div><b className="block font-mono text-xl font-medium text-white">24/7</b><span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Piyasa Takibi</span></div>
            </div>
          </div>

          <aside className="rounded-2xl border border-outline/10 bg-surface/90 p-5 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="flex items-center gap-3 border-b border-outline/10 pb-4"><span className="h-2 w-2 rounded-full bg-secondary shadow-[0_0_0_4px_rgba(45,217,184,.13)]"/><div><h2 className="text-sm font-bold text-white">Global Sohbet</h2><p className="text-[11px] text-on-surface-variant">Topluluk gündeminden kısa notlar</p></div></div>
            <div className="mt-5 space-y-5">{MESSAGES.slice(0, 3).map((message, index) => <div key={message.id} className="flex gap-3"><img src={message.user.avatar} alt="" className="h-9 w-9 rounded-full object-cover"/><div><p className="text-xs font-bold text-white">{message.user.name} <span className="ml-1 font-mono text-[9px] font-normal text-on-surface-variant">{message.timestamp}</span></p><p className="mt-1 text-xs leading-5 text-on-surface-variant">{chatCopy[index]}</p></div></div>)}</div>
            <Link to="/chat" className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-primary">Sohbeti Aç <ArrowRight size={15}/></Link>
          </aside>
        </div>
      </section>

      <section id="haberler" className="space-y-5">
        <div className="flex items-end justify-between gap-4"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">KriptoKeyfi Haber Merkezi</p><h2 className="mt-2 font-headline text-2xl font-bold text-white sm:text-3xl">Bugünün Öne Çıkanları</h2></div><Link to="/haberler" className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-on-surface-variant hover:text-primary">Tüm Haberler <ArrowRight size={15}/></Link></div>
        {news.length ? <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr_1fr]">{news.map((article, index) => <Link key={article.id} to={`/haberler/${article.slug}`} className="group overflow-hidden rounded-2xl border border-outline/10 bg-surface"><div className="relative aspect-[16/10]"><NewsArtwork article={article} className="absolute inset-0 h-full w-full" imageClassName="transition duration-500 group-hover:scale-105"/><span className="absolute left-3 top-3 rounded-md bg-black/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-primary backdrop-blur">{article.category ?? 'Kripto'}</span></div><div className="p-4 sm:p-5"><h3 className={`${index === 0 ? 'text-xl' : 'text-base'} font-headline font-bold leading-snug text-white group-hover:text-primary`}>{article.title}</h3><p className="mt-3 font-mono text-[10px] text-on-surface-variant">{formatDate(article.publishedAt)} · {article.readingTimeMinutes} dk okuma</p></div></Link>)}</div> : <div className="grid gap-5 lg:grid-cols-3">{[0,1,2].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl bg-surface"/>)}</div>}
      </section>

      <section id="kesfet" className="space-y-5">
        <div className="flex items-end justify-between gap-4"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-primary">Web3 Discovery</p><h2 className="mt-2 font-headline text-2xl font-bold text-white sm:text-3xl">Keşfedilecek Projeler</h2></div><Link to="/ecosystem" className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-on-surface-variant hover:text-primary">Tümünü Gör <ArrowRight size={15}/></Link></div>
        <div className="grid gap-5 md:grid-cols-3">{PROJECTS.slice(0,3).map((project) => <Link to="/ecosystem" key={project.id} className="rounded-2xl border border-outline/10 bg-surface p-5 transition hover:-translate-y-1 hover:border-primary/25"><div className="flex items-center justify-between"><img src={project.icon} alt="" className="h-11 w-11 rounded-xl object-cover"/><span className={`rounded-md px-2 py-1 text-[9px] font-black uppercase ${project.status === 'ACTIVE' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>{project.status}</span></div><p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{project.category}</p><h3 className="mt-2 font-headline text-lg font-bold text-white">{project.name}</h3><p className="mt-2 text-sm leading-6 text-on-surface-variant">{projectDescriptions[project.name] ?? project.description}</p></Link>)}</div>
      </section>

      <section className="rounded-[28px] border border-outline/10 bg-surface p-5 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr] lg:items-center"><div><p className="inline-flex items-center gap-2 rounded-full bg-secondary/10 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-secondary"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary"/> Canlı fiyatla çalışıyor</p><h2 className="mt-5 max-w-md font-headline text-3xl font-bold text-white">30 saniyede tahmin et, keyfini çıkar.</h2><p className="mt-4 max-w-lg text-sm leading-7 text-on-surface-variant">BTC fiyat yönünü tahmin ettiğin, gerçek zamanlı piyasa verisiyle çalışan eğlence oyunu.</p><p className="mt-3 text-xs leading-5 text-on-surface-variant">Eğlence amaçlıdır; yatırım tavsiyesi veya gerçek trade sistemi değildir.</p><Link to="/games" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-background">Keyfi Oyunlara Git <ArrowRight size={16}/></Link></div><HomeUpDownWidget/></div>
      </section>

      <PwaPromotion />

      <footer className="grid gap-8 border-t border-outline/10 py-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div><p className="font-headline text-xl font-black text-white">Kripto<span className="text-primary">Keyfi</span></p><p className="mt-3 max-w-xs text-sm leading-6 text-on-surface-variant">Web3'ü anlaşılır kılan Türkçe kripto çalışma alanı.</p></div>
        <FooterColumn title="Haberler" links={[['Bitcoin Haberleri','/haberler/kategori/bitcoin'],['Ethereum Haberleri','/haberler/kategori/ethereum'],['DeFi Haberleri','/haberler/kategori/defi']]}/>
        <FooterColumn title="Platform" links={[['Ekosistem','/ecosystem'],['Keyfi Oyunlar','/games'],['Akademi','/academy']]}/>
        <FooterColumn title="Topluluk" links={[['Global Sohbet','/chat'],['Videolar','/videos'],['Haber Merkezi','/haberler']]}/>
      </footer>
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return <div><h2 className="text-[10px] font-black uppercase tracking-[.16em] text-on-surface-variant">{title}</h2><div className="mt-4 space-y-3">{links.map(([label,to]) => <Link key={to} to={to} className="block text-sm text-on-surface-variant hover:text-white">{label}</Link>)}</div></div>;
}

function PwaPromotion() {
  const benefits = [
    { icon: Download, title: 'Tek dokunuşla kur', text: 'Ana ekranına ekle, uygulama gibi aç.' },
    { icon: WifiOff, title: 'Çevrimdışı erişim', text: 'Önbelleğe alınmış içerikleri bağlantısız görüntüle.' },
    { icon: BellRing, title: 'Bildirimlere hazır', text: 'Önemli içerik ve piyasa hareketlerini takip et.' },
    { icon: ShieldCheck, title: 'Güvenli ve güncel', text: 'HTTPS ve kontrollü güncelleme akışı.' },
  ];
  return <section className="kk-gold-panel overflow-hidden rounded-[28px] border border-primary/20"><div className="grid items-center gap-7 p-6 md:grid-cols-2 md:p-8"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-primary">KriptoKeyfi PWA</p><h2 className="mt-3 font-headline text-3xl font-bold text-white">Her yerde, uygulama akıcılığında.</h2><p className="mt-3 leading-7 text-on-surface-variant">Haber ve piyasa deneyimini ana ekranına taşı.</p><div className="mt-6 grid gap-3 sm:grid-cols-2">{benefits.map(({icon:Icon,title,text}) => <div key={title} className="rounded-xl border border-outline/10 bg-black/20 p-4"><Icon size={17} className="text-primary"/><h3 className="mt-2 text-sm font-bold text-white">{title}</h3><p className="mt-1 text-xs leading-5 text-on-surface-variant">{text}</p></div>)}</div></div><img src="/pwa/pwa-promo.png" alt="KriptoKeyfi PWA tanıtımı" className="w-full rounded-2xl border border-primary/20" loading="lazy"/></div></section>;
}
