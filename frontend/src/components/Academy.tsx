import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  CheckCircle2,
  Clock3,
  Copy,
  Eye,
  GraduationCap,
  Heart,
  Linkedin,
  MessageCircle,
  Search,
  Send,
  Share2,
  Sparkles,
  ThumbsUp,
  Twitter
} from 'lucide-react';
import { ACADEMY_ARTICLES, ACADEMY_CATEGORIES, ACADEMY_SERIES, ACADEMY_TAGS, GLOSSARY_TERMS } from '../constants';
import { AcademyArticle, AcademySeries, GlossaryTerm } from '../types';
import { cn } from '../lib/utils';

type AcademySavedKind = 'saved' | 'favorites' | 'readLater' | 'read';

function useAcademySaved(kind: AcademySavedKind) {
  const key = `kripto-keyfi-academy-${kind}`;
  const [items, setItems] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  });

  function toggle(id: string) {
    setItems((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }

  return { items, toggle, has: (id: string) => items.includes(id) };
}

function articleMatches(article: AcademyArticle, query: string) {
  const term = query.trim().toLowerCase();
  if (!term) return true;

  return [
    article.title,
    article.subtitle,
    article.excerpt,
    article.category,
    article.authorName,
    article.contentType,
    article.level,
    ...article.tags
  ].some((field) => field.toLowerCase().includes(term));
}

function filterArticles(articles: AcademyArticle[], query: string, category: string, tag: string, level: string, contentType: string) {
  return articles.filter((article) => {
    const categoryMatch = category === 'Tümü' || article.category === category;
    const tagMatch = tag === 'Tümü' || article.tags.includes(tag);
    const levelMatch = level === 'Tümü' || article.level === level;
    const typeMatch = contentType === 'Tümü' || article.contentType === contentType;
    return categoryMatch && tagMatch && levelMatch && typeMatch && articleMatches(article, query);
  });
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-outline/5 bg-surface p-10 text-center">
      <p className="font-headline text-xl font-bold text-white">{title}</p>
      <p className="mt-2 text-sm text-on-surface-variant">{description}</p>
    </div>
  );
}

function AcademyActions({ article }: { article: AcademyArticle }) {
  const saved = useAcademySaved('saved');
  const favorites = useAcademySaved('favorites');
  const readLater = useAcademySaved('readLater');
  const read = useAcademySaved('read');

  const actions = [
    { label: 'Kaydet', icon: Bookmark, active: saved.has(article.slug), onClick: () => saved.toggle(article.slug), activeClass: 'text-primary bg-primary/10 border-primary/20' },
    { label: 'Favori', icon: Heart, active: favorites.has(article.slug), onClick: () => favorites.toggle(article.slug), activeClass: 'text-error bg-error/10 border-error/20' },
    { label: 'Sonra Oku', icon: Clock3, active: readLater.has(article.slug), onClick: () => readLater.toggle(article.slug), activeClass: 'text-secondary bg-secondary/10 border-secondary/20' },
    { label: 'Okundu', icon: CheckCircle2, active: read.has(article.slug), onClick: () => read.toggle(article.slug), activeClass: 'text-tertiary bg-tertiary/10 border-tertiary/20' }
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={(event) => {
            event.preventDefault();
            action.onClick();
          }}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all',
            action.active ? action.activeClass : 'border-outline/10 bg-surface-high text-on-surface-variant hover:text-white'
          )}
        >
          <action.icon size={14} fill={action.icon === Heart && action.active ? 'currentColor' : 'none'} />
          {action.label}
        </button>
      ))}
    </div>
  );
}

function CategoryFilters({ active, onChange }: { active: string; onChange: (value: string) => void }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
      {ACADEMY_CATEGORIES.map((category) => (
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

function TagFilters({ active, onChange }: { active: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {['Tümü', ...ACADEMY_TAGS].slice(0, 18).map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onChange(tag)}
          className={cn(
            'rounded-lg px-3 py-2 text-xs font-bold transition-all',
            active === tag ? 'bg-primary text-background' : 'bg-surface-high text-primary hover:bg-surface-highest'
          )}
        >
          #{tag}
        </button>
      ))}
    </div>
  );
}

function AcademySearch({
  query,
  setQuery,
  level,
  setLevel,
  contentType,
  setContentType
}: {
  query: string;
  setQuery: (value: string) => void;
  level: string;
  setLevel: (value: string) => void;
  contentType: string;
  setContentType: (value: string) => void;
}) {
  const levels = ['Tümü', 'Başlangıç', 'Orta', 'İleri'];
  const types = ['Tümü', 'Makale', 'Rehber', 'Eğitim Serisi', 'Analiz', 'Akademik Çalışma', 'Rapor', 'Sözlük', 'Güvenlik Uyarısı'];

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={20} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-full border-none bg-surface-high py-4 pl-12 pr-5 text-sm text-on-surface placeholder:text-outline/70 focus:ring-2 focus:ring-primary/25"
          placeholder="Makale, rehber, konu veya etiket ara..."
          type="search"
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <select value={level} onChange={(event) => setLevel(event.target.value)} className="rounded-xl border-none bg-surface-high px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/25">
          {levels.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={contentType} onChange={(event) => setContentType(event.target.value)} className="rounded-xl border-none bg-surface-high px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/25">
          {types.map((item) => <option key={item}>{item}</option>)}
        </select>
      </div>
    </div>
  );
}

function AcademyHero({
  query,
  setQuery,
  level,
  setLevel,
  contentType,
  setContentType
}: {
  query: string;
  setQuery: (value: string) => void;
  level: string;
  setLevel: (value: string) => void;
  contentType: string;
  setContentType: (value: string) => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-outline/5 bg-surface p-6 md:p-8">
      <div className="absolute inset-0 opacity-20">
        <img src="https://picsum.photos/seed/kripto-academy-hero/1400/700" alt="Academy" className="h-full w-full object-cover" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/90 to-background/30" />
      <div className="relative grid gap-8 xl:grid-cols-[1fr_440px] xl:items-end">
        <div>
          <span className="mb-5 inline-flex rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.28em] text-primary">
            İçerik & Eğitim Merkezi
          </span>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            Kripto Keyfi Akademi
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-on-surface-variant">
            Kripto, blockchain, Web3, smart contract, güvenlik ve yazılım dünyasını sade, anlaşılır ve derinlemesine içeriklerle öğren.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/academy/series" className="rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-highest">Eğitim Serileri</Link>
            <Link to="/academy/glossary" className="rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-highest">Sözlük</Link>
            <Link to="/academy/reading-list" className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-background hover:opacity-90">Okuma Listem</Link>
          </div>
        </div>
        <AcademySearch query={query} setQuery={setQuery} level={level} setLevel={setLevel} contentType={contentType} setContentType={setContentType} />
      </div>
    </section>
  );
}

function ArticleCard({ article, featured = false }: { article: AcademyArticle; featured?: boolean }) {
  return (
    <Link to={`/academy/articles/${article.slug}`} className={cn('group block overflow-hidden rounded-[24px] border border-outline/5 bg-surface transition-all hover:-translate-y-1 hover:bg-surface-high', featured && 'lg:col-span-2')}>
      <div className={cn('relative overflow-hidden bg-surface-highest', featured ? 'aspect-[16/8]' : 'aspect-video')}>
        <img src={article.coverImage} alt={article.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/20 to-transparent" />
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
          <span className="rounded-lg bg-primary/90 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-background">{article.category}</span>
          <span className="rounded-lg bg-background/75 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">{article.level}</span>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-secondary">{article.contentType}</p>
            <h2 className={cn('font-headline font-bold leading-tight text-white group-hover:text-primary', featured ? 'text-2xl' : 'text-lg line-clamp-2')}>{article.title}</h2>
          </div>
          <AcademyActions article={article} />
        </div>
        <p className="line-clamp-2 text-sm leading-6 text-on-surface-variant">{article.excerpt}</p>
        <div className="flex items-center gap-3">
          <img src={article.authorAvatar} alt={article.authorName} className="h-9 w-9 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-on-surface">{article.authorName}</p>
            <p className="text-xs text-on-surface-variant">{article.publishedAt} / {article.readingTime}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-on-surface-variant">
            <span className="inline-flex items-center gap-1"><Eye size={13} /> {article.viewCount}</span>
            <span className="inline-flex items-center gap-1"><MessageCircle size={13} /> {article.commentCount}</span>
          </div>
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

function ArticleGrid({ articles }: { articles: AcademyArticle[] }) {
  if (!articles.length) {
    return <EmptyState title="İçerik bulunamadı" description="Arama, kategori, etiket veya seviye filtresini değiştirerek tekrar deneyin." />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {articles.map((article) => <ArticleCard key={article.slug} article={article} />)}
    </div>
  );
}

function SectionHeader({ title, actionTo }: { title: string; actionTo?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="font-headline text-2xl font-extrabold text-white">{title}</h2>
      {actionTo && (
        <Link to={actionTo} className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
          Tümünü gör <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}

function SeriesCard({ series }: { series: AcademySeries }) {
  return (
    <Link to={`/academy/series/${series.slug}`} className="group block rounded-[24px] border border-outline/5 bg-surface p-5 transition-all hover:-translate-y-1 hover:bg-surface-high">
      <img src={series.coverImage} alt={series.title} className="mb-5 aspect-video w-full rounded-2xl object-cover" />
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-lg bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">{series.level}</span>
        <span className="text-xs font-bold text-on-surface-variant">{series.totalLessons} bölüm / {series.totalReadingTime}</span>
      </div>
      <h3 className="mt-4 font-headline text-xl font-bold text-white group-hover:text-primary">{series.title}</h3>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-on-surface-variant">{series.description}</p>
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-xs font-bold text-on-surface-variant">
          <span>İlerleme</span>
          <span>{series.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-highest">
          <div className="h-full bg-secondary" style={{ width: `${series.progress}%` }} />
        </div>
      </div>
    </Link>
  );
}

function GlossarySection({ terms }: { terms: GlossaryTerm[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {terms.map((term) => (
        <Link key={term.slug} to={`/academy/glossary/${term.slug}`} className="rounded-2xl border border-outline/5 bg-surface p-5 transition-colors hover:bg-surface-high">
          <h3 className="font-headline text-lg font-bold text-white">{term.term}</h3>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">{term.shortDefinition}</p>
        </Link>
      ))}
    </div>
  );
}

export default function AcademyHome() {
  const params = useParams();
  const routeCategory = params.category ? decodeURIComponent(params.category) : 'Tümü';
  const routeTag = params.tag ? decodeURIComponent(params.tag) : 'Tümü';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(routeCategory);
  const [tag, setTag] = useState(routeTag);
  const [level, setLevel] = useState('Tümü');
  const [contentType, setContentType] = useState('Tümü');

  useEffect(() => setCategory(routeCategory), [routeCategory]);
  useEffect(() => setTag(routeTag), [routeTag]);

  const filtered = useMemo(() => filterArticles(ACADEMY_ARTICLES, query, category, tag, level, contentType), [query, category, tag, level, contentType]);
  const featured = ACADEMY_ARTICLES.filter((article) => article.isFeatured).slice(0, 4);
  const latest = [...ACADEMY_ARTICLES].slice(0, 4);
  const popular = ACADEMY_ARTICLES.filter((article) => article.isPopular);
  const quickGuides = ACADEMY_ARTICLES.filter((article) => article.contentType === 'Rehber' || article.contentType === 'Güvenlik Uyarısı');
  const academic = ACADEMY_ARTICLES.filter((article) => article.contentType === 'Akademik Çalışma' || article.category === 'Akademik Çalışmalar');

  return (
    <div className="space-y-10">
      <AcademyHero query={query} setQuery={setQuery} level={level} setLevel={setLevel} contentType={contentType} setContentType={setContentType} />
      <div className="space-y-5">
        <CategoryFilters active={category} onChange={setCategory} />
        <TagFilters active={tag} onChange={setTag} />
      </div>

      {(query || category !== 'Tümü' || tag !== 'Tümü' || level !== 'Tümü' || contentType !== 'Tümü') ? (
        <section>
          <SectionHeader title={`Filtrelenen İçerikler (${filtered.length})`} />
          <ArticleGrid articles={filtered} />
        </section>
      ) : (
        <>
          <section>
            <SectionHeader title="Öne Çıkan İçerikler" />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {featured.map((article, index) => <ArticleCard key={article.slug} article={article} featured={index === 0} />)}
            </div>
          </section>
          <section>
            <SectionHeader title="Yeni Eklenenler" />
            <ArticleGrid articles={latest} />
          </section>
          <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
            <div>
              <SectionHeader title="Popüler Okumalar" />
              <ArticleGrid articles={popular} />
            </div>
            <aside className="rounded-[24px] border border-outline/5 bg-surface p-6 xl:self-start">
              <SectionHeader title="Kısa Rehberler" />
              <div className="space-y-4">
                {quickGuides.map((article) => (
                  <Link key={article.slug} to={`/academy/articles/${article.slug}`} className="block rounded-2xl bg-surface-high/50 p-4 hover:bg-surface-high">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">{article.category}</p>
                    <h3 className="mt-2 font-headline text-base font-bold text-white">{article.title}</h3>
                    <p className="mt-2 text-xs text-on-surface-variant">{article.readingTime} / {article.level}</p>
                  </Link>
                ))}
              </div>
            </aside>
          </section>
          <section>
            <SectionHeader title="Eğitim Serileri" actionTo="/academy/series" />
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {ACADEMY_SERIES.map((series) => <SeriesCard key={series.slug} series={series} />)}
            </div>
          </section>
          <section>
            <SectionHeader title="Akademik Çalışmalar" />
            <ArticleGrid articles={academic} />
          </section>
          <section>
            <SectionHeader title="Sözlük / Kavramlar" actionTo="/academy/glossary" />
            <GlossarySection terms={GLOSSARY_TERMS.slice(0, 6)} />
          </section>
        </>
      )}
    </div>
  );
}

function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      const scrollTop = window.scrollY;
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(height > 0 ? Math.min(100, Math.round((scrollTop / height) * 100)) : 0);
    }

    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return <div className="fixed left-0 top-0 z-[60] h-1 bg-secondary transition-all" style={{ width: `${progress}%` }} />;
}

function TableOfContents({ article }: { article: AcademyArticle }) {
  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const content = (
    <div className="space-y-2">
      {article.content.map((block) => (
        <button key={block.id} type="button" onClick={() => scrollTo(block.id)} className="block w-full rounded-xl px-3 py-2 text-left text-sm text-on-surface-variant hover:bg-surface-high hover:text-white">
          {block.heading}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <details className="rounded-[20px] border border-outline/5 bg-surface p-4 lg:hidden">
        <summary className="cursor-pointer font-headline font-bold text-white">İçindekiler</summary>
        <div className="mt-4">{content}</div>
      </details>
      <aside className="hidden lg:block lg:sticky lg:top-32 lg:self-start rounded-[24px] border border-outline/5 bg-surface p-5">
        <h2 className="mb-4 font-headline text-lg font-bold text-white">İçindekiler</h2>
        {content}
      </aside>
    </>
  );
}

function ShareButtons({ article }: { article: AcademyArticle }) {
  const url = `${window.location.origin}/academy/articles/${article.slug}`;
  const buttons = [
    { label: 'LinkedIn', icon: Linkedin },
    { label: 'X', icon: Twitter },
    { label: 'WhatsApp', icon: Send },
    { label: 'Telegram', icon: Send },
    { label: 'Link', icon: Copy, copy: true }
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {buttons.map((button) => (
        <button
          key={button.label}
          type="button"
          onClick={() => button.copy && navigator.clipboard?.writeText(url)}
          className="inline-flex items-center gap-2 rounded-xl bg-surface-high px-3 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-highest hover:text-white"
        >
          <button.icon size={14} />
          {button.label}
        </button>
      ))}
    </div>
  );
}

function AiReadingBox({ article }: { article: AcademyArticle }) {
  return (
    <section className="rounded-[24px] border border-primary/10 bg-primary/5 p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles size={18} /></span>
        <h2 className="font-headline text-xl font-bold text-white">AI Destekli Okuma</h2>
      </div>
      <p className="text-sm leading-7 text-on-surface">{article.aiSummary}</p>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <InfoList title="5 maddede ana fikir" items={article.aiKeyPoints} />
        <InfoList title="Kimler okumalı?" items={article.aiWhoShouldRead} />
        <InfoList title="Öğreneceklerin" items={article.aiLearningOutcomes} />
        <InfoList title="İlgili kavramlar" items={article.relatedConcepts} />
      </div>
    </section>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">{title}</h3>
      <div className="space-y-2">
        {items.map((item) => <p key={item} className="rounded-xl bg-surface-high/70 px-3 py-2 text-sm text-on-surface">{item}</p>)}
      </div>
    </div>
  );
}

function AcademyCommentSection({ article }: { article: AcademyArticle }) {
  const isLoggedIn = false;

  return (
    <section className="rounded-[24px] border border-outline/5 bg-surface p-6">
      <div className="mb-6 flex items-center gap-3">
        <MessageCircle className="text-primary" size={20} />
        <h2 className="font-headline text-xl font-bold text-white">Yorumlar</h2>
      </div>
      {!isLoggedIn && <div className="mb-5 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-on-surface-variant">Yorum yapmak için giriş yapmalısınız.</div>}
      <textarea disabled={!isLoggedIn} className="mb-6 h-28 w-full resize-none rounded-2xl border-none bg-surface-high p-4 text-sm text-on-surface placeholder:text-outline/70 disabled:cursor-not-allowed disabled:opacity-60" placeholder="Yorumunuzu yazın..." />
      <div className="space-y-5">
        {article.comments.length === 0 ? (
          <EmptyState title="Yorum yok" description="Bu içerik için henüz yorum yapılmamış." />
        ) : (
          article.comments.map((comment) => (
            <article key={comment.id} className="flex gap-4 rounded-2xl bg-surface-high/40 p-4">
              <img src={comment.avatar} alt={comment.username} className="h-10 w-10 rounded-xl" />
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-sm font-bold text-white">{comment.username}</p>
                  <span className="text-[10px] text-on-surface-variant">{comment.date}</span>
                </div>
                <p className="text-sm leading-6 text-on-surface/90">{comment.content}</p>
                <div className="mt-3 flex items-center gap-4 text-xs font-bold text-on-surface-variant">
                  <button type="button" className="flex items-center gap-1 hover:text-primary"><ThumbsUp size={14} /> {comment.likes}</button>
                  <button type="button" className="hover:text-primary">Yanıtla</button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function RenderContentBlock({ block }: { block: AcademyArticle['content'][number] }) {
  const base = 'text-base leading-8 text-on-surface-variant';

  if (block.kind === 'code') {
    return <pre id={block.id} className="scroll-mt-28 overflow-x-auto rounded-2xl border border-outline/10 bg-background p-5 text-sm text-secondary"><code>{block.body}</code></pre>;
  }

  if (block.kind === 'quote') {
    return <blockquote id={block.id} className="scroll-mt-28 rounded-2xl border-l-4 border-secondary bg-surface-high p-5 text-base leading-8 text-on-surface">“{block.body}”</blockquote>;
  }

  if (block.kind === 'info' || block.kind === 'warning') {
    const Icon = block.kind === 'warning' ? AlertTriangle : Sparkles;
    return (
      <div id={block.id} className={cn('scroll-mt-28 rounded-2xl border p-5', block.kind === 'warning' ? 'border-error/20 bg-error/10' : 'border-primary/20 bg-primary/10')}>
        <div className="mb-2 flex items-center gap-2 font-headline font-bold text-white"><Icon size={18} /> {block.heading}</div>
        <p className={base}>{block.body}</p>
      </div>
    );
  }

  return (
    <section id={block.id} className="scroll-mt-28 space-y-3">
      <h2 className="font-headline text-2xl font-bold text-white">{block.heading}</h2>
      <p className={base}>{block.body}</p>
    </section>
  );
}

export function AcademyArticleDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const article = ACADEMY_ARTICLES.find((item) => item.slug === slug);

  if (!article) {
    return <EmptyState title="İçerik bulunamadı" description="Aradığınız akademi içeriği taşınmış veya kaldırılmış olabilir." />;
  }

  const related = ACADEMY_ARTICLES.filter((item) => item.slug !== article.slug && (item.category === article.category || item.authorName === article.authorName)).slice(0, 3);

  return (
    <div className="space-y-6">
      <ReadingProgressBar />
      <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-highest">
        <ArrowLeft size={16} /> Geri dön
      </button>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_330px]">
        <TableOfContents article={article} />
        <article className="space-y-6">
          <section className="overflow-hidden rounded-[32px] border border-outline/5 bg-surface">
            <img src={article.coverImage} alt={article.title} className="aspect-[16/8] w-full object-cover" />
            <div className="space-y-5 p-6 md:p-8">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-lg bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">{article.category}</span>
                <span className="rounded-lg bg-secondary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-secondary">{article.level}</span>
                <span className="rounded-lg bg-tertiary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-tertiary">{article.contentType}</span>
              </div>
              <h1 className="font-headline text-3xl font-extrabold leading-tight text-white md:text-5xl">{article.title}</h1>
              <p className="text-lg leading-8 text-on-surface-variant">{article.subtitle}</p>
              <div className="flex flex-col gap-5 border-y border-outline/5 py-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <img src={article.authorAvatar} alt={article.authorName} className="h-12 w-12 rounded-2xl" />
                  <div>
                    <p className="font-bold text-white">{article.authorName}</p>
                    <p className="text-xs text-on-surface-variant">{article.publishedAt} / Güncellendi: {article.updatedAt}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-on-surface-variant">
                  <span>{article.readingTime}</span>
                  <span>{article.viewCount} görüntülenme</span>
                  <span>{article.commentCount} yorum</span>
                </div>
              </div>
              <ShareButtons article={article} />
              <AcademyActions article={article} />
            </div>
          </section>

          <div className="rounded-[24px] border border-outline/5 bg-surface p-6 md:p-8 space-y-8">
            {article.content.map((block) => <RenderContentBlock key={block.id} block={block} />)}
          </div>

          <div className="flex flex-wrap gap-2">
            {article.tags.map((tag) => <Link key={tag} to={`/academy/tag/${encodeURIComponent(tag)}`} className="rounded-lg bg-surface-high px-3 py-2 text-xs font-bold text-primary">#{tag}</Link>)}
          </div>

          <AiReadingBox article={article} />
          <AcademyCommentSection article={article} />
        </article>
        <aside className="space-y-6 xl:sticky xl:top-32 xl:self-start">
          <section className="rounded-[24px] border border-outline/5 bg-surface p-5">
            <h2 className="font-headline text-lg font-bold text-white">Yazar</h2>
            <div className="mt-4 flex gap-3">
              <img src={article.authorAvatar} alt={article.authorName} className="h-12 w-12 rounded-2xl" />
              <div>
                <p className="font-bold text-white">{article.authorName}</p>
                <p className="mt-1 text-sm leading-6 text-on-surface-variant">{article.authorBio}</p>
              </div>
            </div>
          </section>
          <section className="rounded-[24px] border border-outline/5 bg-surface p-5">
            <h2 className="mb-4 font-headline text-lg font-bold text-white">İlgili İçerikler</h2>
            <div className="space-y-3">
              {related.map((item) => (
                <Link key={item.slug} to={`/academy/articles/${item.slug}`} className="block rounded-2xl bg-surface-high/50 p-4 hover:bg-surface-high">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{item.category}</p>
                  <h3 className="mt-2 line-clamp-2 text-sm font-bold text-white">{item.title}</h3>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function AcademySeriesList() {
  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-outline/5 bg-surface p-8">
        <h1 className="font-headline text-4xl font-extrabold text-white">Eğitim Serileri</h1>
        <p className="mt-3 text-on-surface-variant">Birbirine bağlı bölümlerle adım adım öğrenme yolları.</p>
      </section>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {ACADEMY_SERIES.map((series) => <SeriesCard key={series.slug} series={series} />)}
      </div>
    </div>
  );
}

export function AcademySeriesDetail() {
  const { slug } = useParams();
  const series = ACADEMY_SERIES.find((item) => item.slug === slug);
  const [completed, setCompleted] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`kripto-keyfi-series-${slug}`) || '[]');
    } catch {
      return [];
    }
  });

  if (!series) return <EmptyState title="Seri bulunamadı" description="Aradığınız eğitim serisi mevcut değil." />;

  function toggleLesson(articleSlug: string) {
    const next = completed.includes(articleSlug) ? completed.filter((item) => item !== articleSlug) : [...completed, articleSlug];
    setCompleted(next);
    localStorage.setItem(`kripto-keyfi-series-${slug}`, JSON.stringify(next));
  }

  const totalCompleted = series.lessons.filter((lesson) => lesson.completed || completed.includes(lesson.articleSlug)).length;
  const progress = Math.round((totalCompleted / series.lessons.length) * 100);
  const nextLesson = series.lessons.find((lesson) => !lesson.completed && !completed.includes(lesson.articleSlug)) || series.lessons[0];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[32px] border border-outline/5 bg-surface">
        <img src={series.coverImage} alt={series.title} className="aspect-[16/6] w-full object-cover opacity-80" />
        <div className="p-8">
          <span className="rounded-lg bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">{series.level}</span>
          <h1 className="mt-4 font-headline text-4xl font-extrabold text-white">{series.title}</h1>
          <p className="mt-3 max-w-3xl text-on-surface-variant">{series.description}</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <Metric label="Bölüm" value={`${series.totalLessons}`} />
            <Metric label="Toplam süre" value={series.totalReadingTime} />
            <Metric label="İlerleme" value={`${progress}%`} />
          </div>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-surface-highest"><div className="h-full bg-secondary" style={{ width: `${progress}%` }} /></div>
          <Link to={`/academy/articles/${nextLesson.articleSlug}`} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-background">
            Sıradaki bölüme geç <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      <section className="rounded-[24px] border border-outline/5 bg-surface p-6">
        <h2 className="mb-5 font-headline text-2xl font-bold text-white">Bölüm Listesi</h2>
        <div className="space-y-3">
          {series.lessons.map((lesson, index) => {
            const done = Boolean(lesson.completed || completed.includes(lesson.articleSlug));
            return (
              <div key={lesson.articleSlug} className="flex flex-col gap-3 rounded-2xl bg-surface-high/50 p-4 md:flex-row md:items-center md:justify-between">
                <Link to={`/academy/articles/${lesson.articleSlug}`} className="flex items-center gap-3">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl font-bold', done ? 'bg-secondary text-background' : 'bg-surface-highest text-on-surface')}>{index + 1}</span>
                  <div>
                    <p className="font-bold text-white">{lesson.title}</p>
                    <p className="text-xs text-on-surface-variant">{lesson.readingTime}</p>
                  </div>
                </Link>
                <button type="button" onClick={() => toggleLesson(lesson.articleSlug)} className={cn('rounded-xl px-4 py-2 text-sm font-bold', done ? 'bg-secondary/10 text-secondary' : 'bg-surface-high text-primary')}>
                  {done ? 'Tamamlandı' : 'Tamamla'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-high p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
      <p className="mt-1 font-headline text-2xl font-extrabold text-white">{value}</p>
    </div>
  );
}

export function GlossaryPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-outline/5 bg-surface p-8">
        <h1 className="font-headline text-4xl font-extrabold text-white">Sözlük / Kavramlar</h1>
        <p className="mt-3 text-on-surface-variant">Kripto ve Web3 dünyasında sık geçen temel kavramlar.</p>
      </section>
      <GlossarySection terms={GLOSSARY_TERMS} />
    </div>
  );
}

export function GlossaryDetail() {
  const { slug } = useParams();
  const term = GLOSSARY_TERMS.find((item) => item.slug === slug);

  if (!term) return <EmptyState title="Kavram bulunamadı" description="Aradığınız sözlük maddesi mevcut değil." />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-[32px] border border-outline/5 bg-surface p-8">
        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Sözlük</p>
        <h1 className="mt-3 font-headline text-4xl font-extrabold text-white">{term.term}</h1>
        <p className="mt-5 text-lg leading-8 text-on-surface">{term.fullDefinition}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {term.relatedTerms.map((item) => <span key={item} className="rounded-lg bg-surface-high px-3 py-2 text-xs font-bold text-primary">#{item}</span>)}
        </div>
      </section>
    </div>
  );
}

export function ReadingList() {
  const saved = useAcademySaved('saved');
  const favorites = useAcademySaved('favorites');
  const readLater = useAcademySaved('readLater');
  const read = useAcademySaved('read');
  const slugs = [...new Set([...saved.items, ...favorites.items, ...readLater.items, ...read.items])];
  const articles = ACADEMY_ARTICLES.filter((article) => slugs.includes(article.slug));

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-outline/5 bg-surface p-8">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BookOpen size={22} /></span>
          <div>
            <h1 className="font-headline text-4xl font-extrabold text-white">Okuma Listem</h1>
            <p className="mt-2 text-on-surface-variant">Kaydettiğiniz, favorilere aldığınız ve daha sonra okumak istediğiniz içerikler.</p>
          </div>
        </div>
      </section>
      {articles.length ? <ArticleGrid articles={articles} /> : <EmptyState title="Kaydedilmiş içerik yok" description="Akademi içeriklerinde kaydet, favori veya sonra oku butonlarını kullanarak listenizi oluşturabilirsiniz." />}
    </div>
  );
}
