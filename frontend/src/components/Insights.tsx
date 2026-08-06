import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bookmark, Eye, Mail, Search, Share2 } from 'lucide-react';
import type { NewsArticle } from '../types';
import { getNews } from '../services/newsService';
import { cn } from '../lib/utils';
import NewsArtwork from './NewsArtwork';
import { trackNewsEvent } from '../services/newsAnalytics';

const categories = [
  ['Tümü', ''], ['Bitcoin', 'bitcoin'], ['Ethereum', 'ethereum'], ['Altcoin', 'altcoin'], ['DeFi', 'defi'], ['Web3', 'web3'], ['Borsa Haberleri', 'borsa-haberleri'], ['Regülasyon', 'regulasyon'], ['Güvenlik', 'guvenlik'], ['Analiz', 'analiz'], ['NFT', 'nft'], ['Yapay Zeka', 'yapay-zeka'],
] as const;
const fallbackTags = [{ name: 'Bitcoin', slug: 'bitcoin' }, { name: 'Ethereum', slug: 'ethereum' }, { name: 'ETF', slug: 'etf' }, { name: 'DeFi', slug: 'defi' }, { name: 'Web3', slug: 'web3' }, { name: 'XRP', slug: 'xrp' }];
const formatDate = (value: string) => new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const articlePath = (article: NewsArticle) => `/haberler/${article.slug}`;

function NewsImage({ article, className, eager = false }: { article: NewsArticle; className: string; eager?: boolean }) {
  return <NewsArtwork article={article} className={className} imageClassName="transition duration-500 group-hover:scale-105" eager={eager} />;
}

function ActionButtons({ article }: { article: NewsArticle }) {
  const [saved, setSaved] = useState(() => localStorage.getItem(`saved-news:${article.id}`) === '1');
  const toggle = () => {
    const next = !saved;
    setSaved(next);
    if (next) localStorage.setItem(`saved-news:${article.id}`, '1'); else localStorage.removeItem(`saved-news:${article.id}`);
  };
  const share = async () => {
    const url = new URL(articlePath(article), window.location.origin).toString();
    if (navigator.share) await navigator.share({ title: article.title, url }); else await navigator.clipboard?.writeText(url);
  };
  return <div className="flex gap-2"><button type="button" onClick={toggle} aria-label="Haberi kaydet" className="rounded-xl border border-outline/10 bg-surface-high p-2.5 text-on-surface-variant hover:text-primary"><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /></button><button type="button" onClick={() => void share()} aria-label="Haberi paylaş" className="rounded-xl border border-outline/10 bg-surface-high p-2.5 text-on-surface-variant hover:text-primary"><Share2 size={16} /></button></div>;
}

function NewsCard({ article }: { article: NewsArticle }) {
  return <article className="overflow-hidden rounded-[24px] border border-outline/10 bg-[#11110f]"><Link to={articlePath(article)} className="group block"><div className="relative aspect-[16/9]"><NewsImage article={article} className="h-full w-full"/><span className="absolute left-3 top-3 rounded-lg bg-primary px-3 py-1 text-[10px] font-black uppercase tracking-wider text-background">{article.category ?? 'Kripto'}</span></div></Link><div className="space-y-4 p-5"><div className="flex items-start justify-between gap-3"><Link to={articlePath(article)} className="font-headline text-xl font-extrabold leading-snug text-white hover:text-primary">{article.title}</Link><ActionButtons article={article}/></div>{article.excerpt && <p className="line-clamp-2 text-sm leading-6 text-[#aebbe0]">{article.excerpt}</p>}<div className="flex items-end justify-between gap-3 text-xs text-[#9aa3bd]"><div><p className="font-bold text-white">{article.source?.name ?? 'KriptoKeyfi'}</p><p className="mt-1">{formatDate(article.publishedAt)} / {article.readingTimeMinutes} dk</p></div><Link to={articlePath(article)} className="inline-flex items-center gap-1 text-primary"><Eye size={13}/> Özeti oku</Link></div><div className="flex flex-wrap gap-2">{article.tags.slice(0,3).map((tag) => <Link key={tag.slug} to={`/haberler/etiket/${tag.slug}`} className="rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">#{tag.name}</Link>)}</div></div></article>;
}

function Hero({ article }: { article: NewsArticle }) {
  return <Link to={articlePath(article)} className="group relative block min-h-[430px] overflow-hidden rounded-[28px] border border-outline/10 bg-surface"><NewsImage article={article} className="absolute inset-0 h-full w-full" eager/><div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent"/><div className="absolute inset-x-0 bottom-0 p-6 md:p-8"><div className="mb-4 flex gap-2"><span className="rounded-lg bg-primary px-3 py-1 text-[10px] font-black uppercase text-background">{article.category ?? 'Kripto'}</span><span className="rounded-lg bg-black/70 px-3 py-1 text-[10px] font-black uppercase text-white">{article.readingTimeMinutes} dk</span></div><h2 className="max-w-4xl font-headline text-3xl font-extrabold leading-tight text-white md:text-5xl">{article.title}</h2>{article.excerpt && <p className="mt-4 line-clamp-3 max-w-3xl text-base leading-7 text-[#c8d3f4]">{article.excerpt}</p>}<p className="mt-5 text-sm font-bold text-primary">Türkçe özeti oku →</p></div></Link>;
}

export default function Insights() {
  const { category: categorySlug, tag: tagSlug, topic: topicSlug } = useParams();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getNews({ q: query.trim().length > 1 ? query.trim() : undefined, category: categorySlug, tag: tagSlug, topic: topicSlug })
      .then((result) => { if (active) { setNews(result.articles); setError(''); } })
      .catch(() => active && setError('Haber akışı şu anda alınamadı.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [categorySlug, query, tagSlug, topicSlug]);

  const tagCounts = useMemo(() => {
    const values = new Map<string, { name: string; slug: string; count: number }>();
    news.forEach((article) => article.tags.forEach((tag) => values.set(tag.slug, { ...tag, count: (values.get(tag.slug)?.count ?? 0) + 1 })));
    return [...values.values()].sort((a,b) => b.count - a.count);
  }, [news]);
  const popularTags = tagCounts.length ? tagCounts.slice(0,14) : fallbackTags.map((tag) => ({ ...tag, count: 0 }));
  const topicHubs = tagCounts.filter((tag) => tag.count >= 2).slice(0,6);
  const activeLabel = categories.find(([,slug]) => slug === categorySlug)?.[0] ?? (tagSlug ? `#${tagSlug}` : topicSlug ? `${topicSlug.replaceAll('-',' ')} konusu` : 'KriptoKeyfi Haber Merkezi');
  const hero = news[0];
  const editorPicks = news.slice(1,4);
  const grid = news.slice(1);
  const breaking = news.slice(0,6);
  const popular = [...news].sort((a,b) => b.viewCount - a.viewCount).slice(0,5);

  return <div className="space-y-10"><section className="rounded-b-[34px] border border-outline/10 bg-[#11110f] p-6 md:p-8"><div className="grid gap-7 lg:grid-cols-[1fr_420px] lg:items-center"><div><p className="text-xs font-black uppercase tracking-[.18em] text-primary">Haber Merkezi</p><h1 className="mt-2 font-headline text-4xl font-extrabold capitalize tracking-tight text-white md:text-5xl">{activeLabel}</h1><p className="mt-3 max-w-3xl text-base leading-8 text-[#aebbe0]">Bitcoin, Ethereum, altcoinler, DeFi, Web3, regülasyonlar ve piyasa gelişmelerinden güncel Türkçe özetler.</p></div><div className="space-y-3"><label className="relative block"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7180a8]" size={19}/><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Haber, coin, konu veya etiket ara..." className="w-full rounded-full bg-[#1a1917] py-4 pl-12 pr-5 text-sm text-white outline-none ring-primary/30 focus:ring-2"/></label><Link to="/saved-news" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1a1917] px-4 py-3 text-sm font-bold text-primary">Kaydedilen Haberler <Bookmark size={15}/></Link></div></div></section>

  <nav aria-label="Haber kategorileri" className="flex gap-3 overflow-x-auto pb-2">{categories.map(([label,slug]) => <Link onClick={() => trackNewsEvent({ type: 'CATEGORY_CLICK', category: slug || 'tumu' })} key={label} to={slug ? `/haberler/kategori/${slug}` : '/haberler'} className={cn('shrink-0 rounded-full px-5 py-2 text-xs font-black uppercase tracking-wide', (categorySlug ?? '') === slug && !tagSlug && !topicSlug ? 'bg-secondary text-background' : 'bg-[#171614] text-[#aebbe0] hover:text-white')}>{label}</Link>)}</nav>
  {topicHubs.length > 0 && <nav aria-label="Yoğun konu merkezleri" className="flex flex-wrap items-center gap-2"><span className="mr-1 text-[10px] font-black uppercase tracking-wider text-on-surface-variant">Konu merkezleri</span>{topicHubs.map((tag) => <Link key={tag.slug} to={`/haberler/konu/${tag.slug}`} className="rounded-lg border border-outline/10 bg-surface px-3 py-2 text-xs font-bold text-primary">{tag.name} <span className="text-on-surface-variant">({tag.count})</span></Link>)}</nav>}
  {breaking.length > 0 && <div className="flex overflow-hidden rounded-xl border border-error/25 bg-error/10"><span className="shrink-0 bg-error px-4 py-3 text-xs font-black uppercase text-background">Son Dakika</span><div className="animate-marquee flex items-center gap-10 whitespace-nowrap px-5 text-sm font-bold text-white">{[...breaking,...breaking].map((item,index) => <Link key={`${item.id}-${index}`} to={articlePath(item)}>{item.title}</Link>)}</div></div>}
  {error && <div className="rounded-2xl border border-error/30 bg-error/10 p-4 text-on-surface">{error}</div>}
  {loading ? <div className="h-[430px] animate-pulse rounded-[28px] bg-surface-high"/> : hero ? <><section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]"><Hero article={hero}/><aside className="rounded-[28px] border border-outline/10 bg-[#11110f] p-5"><h2 className="font-headline text-2xl font-extrabold text-white">Editörün Seçtikleri</h2><div className="mt-5 space-y-4">{editorPicks.map((item) => <Link key={item.id} to={articlePath(item)} className="group flex gap-3 rounded-2xl bg-[#171614] p-3 hover:bg-surface-high"><NewsImage article={item} className="h-20 w-24 shrink-0 rounded-xl"/><div><p className="text-[10px] font-black uppercase tracking-wider text-secondary">{item.source?.name}</p><h3 className="mt-1 line-clamp-2 text-sm font-extrabold text-white">{item.title}</h3><p className="mt-2 text-xs text-[#8e98b4]">{item.readingTimeMinutes} dk</p></div></Link>)}</div></aside></section><div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"><main><h2 className="mb-5 font-headline text-3xl font-extrabold text-white">Son Haberler</h2><div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{grid.map((article) => <NewsCard key={article.id} article={article}/>)}</div></main><aside className="space-y-6"><section className="rounded-[28px] border border-outline/10 bg-[#11110f] p-6"><h2 className="font-headline text-2xl font-extrabold text-white">En Çok Okunan Haberler</h2><div className="mt-5 space-y-3">{popular.map((item,index) => <Link key={item.id} to={articlePath(item)} className="flex gap-3 rounded-2xl bg-[#171614] p-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-black text-primary">{index+1}</span><div><p className="text-sm font-bold text-white">{item.title}</p><p className="mt-1 text-xs text-[#8e98b4]">{item.viewCount} okuma</p></div></Link>)}</div></section><section className="rounded-[28px] border border-outline/10 bg-[#11110f] p-6"><h2 className="font-headline text-2xl font-extrabold text-white">Popüler Etiketler</h2><div className="mt-5 flex flex-wrap gap-2">{popularTags.map((tag) => <Link key={tag.slug} to={`/haberler/etiket/${tag.slug}`} className="rounded-lg bg-[#1a1917] px-3 py-2 text-xs font-bold text-primary">#{tag.name}</Link>)}</div></section><section className="rounded-[28px] border border-primary/20 bg-primary/5 p-6"><Mail className="text-primary"/><h2 className="mt-5 font-headline text-2xl font-extrabold text-white">Haftalık Kripto Özeti</h2><p className="mt-3 text-sm leading-6 text-[#9ca7c3]">Haftanın önemli kripto haberlerini ve güvenlik uyarılarını e-posta kutuna al.</p><input placeholder="E-posta adresi" className="mt-5 w-full rounded-xl bg-[#1a1917] px-4 py-3 text-sm text-white"/><button className="mt-3 w-full rounded-xl bg-primary px-4 py-3 text-sm font-black text-background">Abone Ol</button></section></aside></div></> : <div className="rounded-3xl bg-surface p-10 text-center text-on-surface-variant">Bu sayfada yayımlanmış yeterli haber bulunamadı.</div>}</div>;
}

export function SavedNewsPage() {
  return <div className="rounded-3xl bg-surface p-10 text-center text-on-surface-variant">Kaydettiğiniz haberler tarayıcınızda saklanır.</div>;
}
