import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Bookmark, Clock3, Eye, Mail, Search, Share2 } from 'lucide-react';
import { NewsArticle } from '../types';
import { cn } from '../lib/utils';
import {
  getFeaturedNews,
  getLatestNews,
  getTrendingNews,
  NEWS_CATEGORIES,
  NEWS_TAGS,
  searchNews
} from '../services/newsService';

function useSavedNews() {
  const key = 'kripto-keyfi-saved-news';
  const [items, setItems] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  });

  function toggle(slug: string) {
    setItems((current) => {
      const next = current.includes(slug) ? current.filter((item) => item !== slug) : [...current, slug];
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }

  return { items, toggle, has: (slug: string) => items.includes(slug) };
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-outline/5 bg-surface p-10 text-center">
      <p className="font-headline text-xl font-bold text-white">{title}</p>
      <p className="mt-2 text-sm text-on-surface-variant">{description}</p>
    </div>
  );
}

function NewsSearch({ query, onChange }: { query: string; onChange: (value: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={20} />
      <input
        value={query}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-full border-none bg-surface-high py-4 pl-12 pr-5 text-sm text-on-surface placeholder:text-outline/70 focus:ring-2 focus:ring-primary/25"
        placeholder="Haber, coin, konu veya etiket ara..."
        type="search"
      />
    </div>
  );
}

function CategoryTabs({ active, onChange }: { active: string; onChange: (category: string) => void }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
      {NEWS_CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onChange(category)}
          className={cn(
            'shrink-0 rounded-full px-5 py-2 text-xs font-bold uppercase tracking-wider transition-all',
            active === category ? 'bg-secondary text-background' : 'bg-surface-high text-on-surface-variant hover:bg-surface-highest hover:text-white'
          )}
        >
          {category}
        </button>
      ))}
    </div>
  );
}

function BreakingNewsTicker({ news }: { news: NewsArticle[] }) {
  const items = news.filter((item) => item.isBreaking);

  return (
    <div className="overflow-hidden rounded-2xl border border-error/15 bg-error/10">
      <div className="flex items-center gap-4">
        <div className="shrink-0 bg-error px-4 py-3 text-xs font-black uppercase tracking-widest text-background">
          Son Dakika
        </div>
        <div className="animate-marquee gap-8 py-3">
          {[...items, ...items].map((item, index) => (
            <Link key={`${item.slug}-${index}`} to={`/blog/${item.slug}`} className="shrink-0 text-sm font-bold text-on-surface hover:text-white">
              {item.title}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function NewsHero({ article }: { article: NewsArticle }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
      <Link to={`/blog/${article.slug}`} className="group relative min-h-[460px] overflow-hidden rounded-[32px] border border-outline/5 bg-surface">
        <img src={article.coverImage} alt={article.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
        <div className="absolute bottom-0 max-w-4xl space-y-5 p-6 md:p-8">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg bg-primary/90 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-background">{article.category}</span>
            <span className="rounded-lg bg-background/70 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">{article.readingTime}</span>
          </div>
          <h1 className="font-headline text-3xl font-extrabold leading-tight text-white md:text-5xl">{article.title}</h1>
          <p className="max-w-3xl text-base leading-7 text-on-surface-variant">{article.excerpt}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
            <span>{article.publishedAt}</span>
            <span>{article.sourceName} / {article.authorName}</span>
          </div>
          <span className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background">
            Haberi Oku <ArrowRight size={16} />
          </span>
        </div>
      </Link>

      <div className="rounded-[32px] border border-outline/5 bg-surface p-6">
        <h2 className="font-headline text-xl font-bold text-white">Editörün Seçtikleri</h2>
        <div className="mt-5 space-y-4">
          {getLatestNews().filter((item) => item.isEditorPick).slice(0, 4).map((item) => (
            <Link key={item.slug} to={`/blog/${item.slug}`} className="group flex gap-3 rounded-2xl bg-surface-high/40 p-3 hover:bg-surface-high">
              <img src={item.coverImage} alt={item.title} className="h-20 w-24 rounded-xl object-cover" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">{item.category}</p>
                <h3 className="mt-1 line-clamp-2 text-sm font-bold text-white group-hover:text-primary">{item.title}</h3>
                <p className="mt-2 text-xs text-on-surface-variant">{item.readingTime} / {item.viewCount}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function NewsCard({ article }: { article: NewsArticle }) {
  const saved = useSavedNews();

  return (
    <Link to={`/blog/${article.slug}`} className="group block overflow-hidden rounded-[24px] border border-outline/5 bg-surface transition-all hover:-translate-y-1 hover:bg-surface-high">
      <div className="relative aspect-video overflow-hidden bg-surface-highest">
        <img src={article.coverImage} alt={article.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/70 via-transparent to-transparent" />
        <span className="absolute left-3 top-3 rounded-lg bg-primary/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-background">{article.category}</span>
        {article.isBreaking && <span className="absolute bottom-3 left-3 rounded-lg bg-error px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-background">Son Dakika</span>}
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-headline text-lg font-bold leading-snug text-white group-hover:text-primary">{article.title}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Haberi kaydet"
              onClick={(event) => {
                event.preventDefault();
                saved.toggle(article.slug);
              }}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl border transition-all',
                saved.has(article.slug) ? 'border-primary/20 bg-primary/10 text-primary' : 'border-outline/10 bg-surface-high text-on-surface-variant hover:text-primary'
              )}
            >
              <Bookmark size={15} fill={saved.has(article.slug) ? 'currentColor' : 'none'} />
            </button>
            <button
              type="button"
              aria-label="Haberi paylaş"
              onClick={(event) => event.preventDefault()}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-outline/10 bg-surface-high text-on-surface-variant hover:text-white"
            >
              <Share2 size={15} />
            </button>
          </div>
        </div>
        <p className="line-clamp-2 text-sm leading-6 text-on-surface-variant">{article.excerpt}</p>
        <div className="flex items-center gap-3">
          <img src={article.authorAvatar} alt={article.authorName} className="h-9 w-9 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-on-surface">{article.sourceName}</p>
            <p className="text-xs text-on-surface-variant">{article.publishedAt} / {article.readingTime}</p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs text-on-surface-variant"><Eye size={13} /> {article.viewCount}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {article.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-lg bg-surface-highest px-2 py-1 text-[10px] font-bold text-primary">#{tag}</span>
          ))}
        </div>
      </div>
    </Link>
  );
}

function LatestNewsGrid({ news }: { news: NewsArticle[] }) {
  if (!news.length) {
    return <EmptyState title="Haber bulunamadı" description="Arama, kategori veya etiket filtresini değiştirerek tekrar deneyin." />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {news.map((article) => <NewsCard key={article.slug} article={article} />)}
    </div>
  );
}

function NewsletterBox() {
  return (
    <div className="rounded-[24px] border border-primary/10 bg-primary/5 p-6">
      <Mail className="mb-4 text-primary" size={24} />
      <h3 className="font-headline text-xl font-bold text-white">Haftalık Kripto Özeti</h3>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">
        Haftanın en önemli kripto haberlerini, analizlerini ve güvenlik uyarılarını e-posta kutuna al.
      </p>
      <div className="mt-5 space-y-3">
        <input className="w-full rounded-xl border-none bg-surface-high px-4 py-3 text-sm text-on-surface placeholder:text-outline/70" placeholder="E-posta adresi" type="email" />
        <button className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-background">Abone Ol</button>
      </div>
    </div>
  );
}

function PopularTags({ activeTag, onTag }: { activeTag: string; onTag: (tag: string) => void }) {
  return (
    <div className="rounded-[24px] border border-outline/5 bg-surface p-6">
      <h3 className="font-headline text-xl font-bold text-white">Popüler Etiketler</h3>
      <div className="mt-5 flex flex-wrap gap-2">
        {NEWS_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => onTag(tag)}
            className={cn('rounded-lg px-3 py-2 text-xs font-bold transition-all', activeTag === tag ? 'bg-primary text-background' : 'bg-surface-high text-primary hover:bg-surface-highest')}
          >
            #{tag}
          </button>
        ))}
      </div>
    </div>
  );
}

function NewsSidebar({ activeTag, onTag }: { activeTag: string; onTag: (tag: string) => void }) {
  const trending = getTrendingNews();
  const breaking = getLatestNews().filter((item) => item.isBreaking);

  return (
    <aside className="space-y-6 xl:sticky xl:top-32 xl:self-start">
      <div className="rounded-[24px] border border-outline/5 bg-surface p-6">
        <h3 className="font-headline text-xl font-bold text-white">En Çok Okunan Haberler</h3>
        <div className="mt-5 space-y-4">
          {trending.map((item, index) => (
            <Link key={item.slug} to={`/blog/${item.slug}`} className="flex gap-3 rounded-2xl bg-surface-high/40 p-3 hover:bg-surface-high">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-black text-primary">{index + 1}</span>
              <div>
                <h4 className="line-clamp-2 text-sm font-bold text-white">{item.title}</h4>
                <p className="mt-1 text-xs text-on-surface-variant">{item.viewCount} okunma</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="rounded-[24px] border border-outline/5 bg-surface p-6">
        <h3 className="font-headline text-xl font-bold text-white">Son Dakika</h3>
        <div className="mt-5 space-y-3">
          {breaking.map((item) => (
            <Link key={item.slug} to={`/blog/${item.slug}`} className="block rounded-2xl bg-error/10 p-4 text-sm font-bold text-on-surface hover:text-white">
              {item.title}
            </Link>
          ))}
        </div>
      </div>
      <PopularTags activeTag={activeTag} onTag={onTag} />
      <NewsletterBox />
    </aside>
  );
}

function SectionHeader({ title, actionTo }: { title: string; actionTo?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="font-headline text-2xl font-extrabold text-white">{title}</h2>
      {actionTo && <Link to={actionTo} className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">Tümünü gör <ArrowRight size={16} /></Link>}
    </div>
  );
}

export default function Insights() {
  const params = useParams();
  const routeCategory = params.category ? decodeURIComponent(params.category) : 'Tümü';
  const routeTag = params.tag ? decodeURIComponent(params.tag) : 'Tümü';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(routeCategory);
  const [tag, setTag] = useState(routeTag);

  useEffect(() => setCategory(routeCategory), [routeCategory]);
  useEffect(() => setTag(routeTag), [routeTag]);

  const latest = getLatestNews();
  const hero = getFeaturedNews()[0] || latest[0];
  const filtered = useMemo(() => {
    const searched = searchNews(query);
    return searched.filter((item) => {
      const categoryMatch = category === 'Tümü' || item.category === category;
      const tagMatch = tag === 'Tümü' || item.tags.includes(tag);
      return categoryMatch && tagMatch;
    });
  }, [query, category, tag]);

  const marketAnalyses = latest.filter((item) => item.category === 'Analiz' || item.tags.includes('ETF'));
  const security = latest.filter((item) => item.category === 'Güvenlik');
  const regulation = latest.filter((item) => item.category === 'Regülasyon');
  const web3 = latest.filter((item) => item.category === 'Web3' || item.tags.includes('Layer-2'));

  return (
    <div className="space-y-10">
      <section className="rounded-[32px] border border-outline/5 bg-surface p-6 md:p-8">
        <div className="grid gap-8 xl:grid-cols-[1fr_420px] xl:items-end">
          <div>
            <span className="mb-5 inline-flex rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">
              Kripto Haber Merkezi
            </span>
            <h1 className="font-headline text-4xl font-extrabold tracking-tight text-white md:text-5xl">
              Kripto Keyfi Haber Merkezi
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-on-surface-variant">
              Bitcoin, Ethereum, altcoinler, DeFi, Web3, regülasyonlar ve piyasa gelişmelerinden en güncel haberler.
            </p>
          </div>
          <div className="space-y-4">
            <NewsSearch query={query} onChange={setQuery} />
            <Link to="/saved-news" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-primary hover:bg-surface-highest">
              Kaydedilen Haberler <Bookmark size={16} />
            </Link>
          </div>
        </div>
      </section>

      <CategoryTabs active={category} onChange={setCategory} />
      <BreakingNewsTicker news={latest} />
      <NewsHero article={hero} />

      {(query || category !== 'Tümü' || tag !== 'Tümü') ? (
        <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div>
            <SectionHeader title={`Haber Sonuçları (${filtered.length})`} />
            <LatestNewsGrid news={filtered} />
          </div>
          <NewsSidebar activeTag={tag} onTag={setTag} />
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-10">
            <section>
              <SectionHeader title="Son Haberler" />
              <LatestNewsGrid news={latest.slice(0, 6)} />
            </section>
            <section>
              <SectionHeader title="Öne Çıkan Haberler" />
              <LatestNewsGrid news={getFeaturedNews()} />
            </section>
            <section>
              <SectionHeader title="Piyasa Analizleri" />
              <LatestNewsGrid news={marketAnalyses} />
            </section>
            <section>
              <SectionHeader title="Güvenlik Uyarıları" />
              <LatestNewsGrid news={security} />
            </section>
            <section>
              <SectionHeader title="Regülasyon Haberleri" />
              <LatestNewsGrid news={regulation} />
            </section>
            <section>
              <SectionHeader title="Web3 & Blockchain Gelişmeleri" />
              <LatestNewsGrid news={web3} />
            </section>
          </div>
          <NewsSidebar activeTag={tag} onTag={setTag} />
        </div>
      )}
    </div>
  );
}

export function SavedNewsPage() {
  const saved = useSavedNews();
  const news = getLatestNews().filter((item) => saved.has(item.slug));

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-outline/5 bg-surface p-8">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Bookmark size={22} /></span>
          <div>
            <h1 className="font-headline text-4xl font-extrabold text-white">Kaydedilen Haberler</h1>
            <p className="mt-2 text-on-surface-variant">Daha sonra okumak için kaydettiğiniz haberler.</p>
          </div>
        </div>
      </section>
      {news.length ? <LatestNewsGrid news={news} /> : <EmptyState title="Kaydedilmiş haber yok" description="Haber kartlarındaki kaydet butonunu kullanarak listenizi oluşturabilirsiniz." />}
    </div>
  );
}
