import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, ChevronRight, ExternalLink, Share2, Sparkles } from 'lucide-react';
import type { NewsArticle } from '../types';
import { getNewsBySlug, saveNews, unsaveNews } from '../services/newsService';
import { applyNewsSeo } from '../lib/newsSeo';
import NewsArtwork from './NewsArtwork';
import { trackNewsEvent } from '../services/newsAnalytics';

const formatDate = (value: string) => new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
const slugify = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const categoryRouteSlug = (value: string | null) => {
  const text = slugify(value ?? '');
  if (/bitcoin|btc/.test(text)) return 'bitcoin';
  if (/ethereum|eth/.test(text)) return 'ethereum';
  if (/defi/.test(text)) return 'defi';
  if (/web3|blockchain/.test(text)) return 'web3';
  if (/borsa|exchange|binance|coinbase/.test(text)) return 'borsa-haberleri';
  if (/regulasyon|sec|cftc/.test(text)) return 'regulasyon';
  if (/guvenlik|hack|security/.test(text)) return 'guvenlik';
  if (/nft/.test(text)) return 'nft';
  if (/yapay-zeka|artificial-intelligence|ai/.test(text)) return 'yapay-zeka';
  return 'altcoin';
};

export default function ArticleDetail() {
  const { slug } = useParams();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [related, setRelated] = useState<NewsArticle[]>([]);
  const [popular, setPopular] = useState<NewsArticle[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const summaryRef = useRef<HTMLElement | null>(null);
  const readingStartedAt = useRef(0);
  const maximumScrollDepth = useRef(0);
  const summaryViewed = useRef(false);

  useEffect(() => {
    if (!slug) return;
    setArticle(null);
    setError('');
    getNewsBySlug(slug).then((data) => {
      setArticle(data.article);
      setRelated(data.related);
      setPopular(data.popular);
      setSaved(data.saved);
      applyNewsSeo(data.article);
    }).catch(() => setError('Haber bulunamadı veya şu anda erişilemiyor.'));
  }, [slug]);

  useEffect(() => {
    if (!article) return;
    readingStartedAt.current = performance.now(); maximumScrollDepth.current = 0; summaryViewed.current = false;
    let summarySeen = false;
    const updateDepth = () => { const available = Math.max(1, document.documentElement.scrollHeight - innerHeight); maximumScrollDepth.current = Math.max(maximumScrollDepth.current, Math.min(100, Math.round(scrollY / available * 100))); };
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) summarySeen = true; }, { threshold: 0.45 });
    if (summaryRef.current) observer.observe(summaryRef.current);
    addEventListener('scroll', updateDepth, { passive: true }); updateDepth();
    const timer = window.setInterval(() => {
      const durationMs = Math.round(performance.now() - readingStartedAt.current);
      if (!summaryViewed.current && summarySeen && durationMs >= 10_000 && maximumScrollDepth.current >= 35) {
        summaryViewed.current = true;
        trackNewsEvent({ type: 'NEWS_SUMMARY_VIEW', articleId: article.id, sourceSlug: article.source?.slug, category: article.category ?? undefined, summaryWordCount: article.aiSummary?.wordCount ?? article.excerpt?.split(/\s+/).filter(Boolean).length ?? 0, durationMs, scrollDepth: maximumScrollDepth.current });
      }
    }, 1_000);
    return () => { clearInterval(timer); observer.disconnect(); removeEventListener('scroll', updateDepth); };
  }, [article]);

  const sidebarTags = useMemo(() => {
    const tags = new Map<string,string>();
    [article, ...related, ...popular].filter(Boolean).forEach((item) => item?.tags.forEach((tag) => tags.set(tag.slug, tag.name)));
    return [...tags].slice(0,14);
  }, [article, popular, related]);

  async function toggleSave() {
    if (!article) return;
    try { if (saved) await unsaveNews(article.id); else await saveNews(article.id); setSaved(!saved); }
    catch { setError('Haber kaydetmek için giriş yapmanız gerekiyor.'); }
  }
  async function share() {
    const url = window.location.href;
    if (navigator.share) await navigator.share({ title: article?.title, url }); else await navigator.clipboard?.writeText(url);
  }

  if (error && !article) return <div className="rounded-3xl bg-surface p-10 text-center"><p className="text-white">{error}</p><Link className="mt-4 inline-block text-primary" to="/haberler">Haber merkezine dön</Link></div>;
  if (!article) return <div className="h-80 animate-pulse rounded-3xl bg-surface-high"/>;

  const sourceName = article.source?.name ?? 'orijinal kaynak';
  const categorySlug = categoryRouteSlug(article.category);
  const localSourceLogo = article.source?.logoUrl?.startsWith('/') ? article.source.logoUrl : null;
  const summaryWordCount = article.aiSummary?.wordCount ?? article.excerpt?.split(/\s+/).filter(Boolean).length ?? 0;
  const engagement = () => ({ durationMs: Math.max(0, Math.round(performance.now() - readingStartedAt.current)), scrollDepth: maximumScrollDepth.current, summaryWordCount });
  const trackCategory = () => trackNewsEvent({ type: 'CATEGORY_CLICK', articleId: article.id, category: article.category ?? categorySlug });

  return <div className="mx-auto max-w-[1420px] space-y-6">
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 overflow-hidden text-xs text-on-surface-variant">
      <Link to="/" className="shrink-0 hover:text-primary">Anasayfa</Link><ChevronRight size={13}/><Link to="/haberler" className="shrink-0 hover:text-primary">Haberler</Link><ChevronRight size={13}/><Link onClick={trackCategory} to={`/haberler/kategori/${categorySlug}`} className="shrink-0 capitalize hover:text-primary">{article.category ?? 'Kripto'}</Link><ChevronRight size={13}/><span className="truncate text-white">{article.title}</span>
    </nav>

    {article.archivedAt && <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 text-sm text-on-surface">Bu haber arşivlenmiştir. Güncel bilgi için orijinal kaynağı kontrol edebilirsiniz.</div>}

    <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_350px]">
      <main className="min-w-0 space-y-6">
        <article className="overflow-hidden rounded-[32px] border border-outline/10 bg-[#11110f]">
          <div className="relative aspect-[16/8]"><NewsArtwork article={article} className="absolute inset-0 h-full w-full" eager/><div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#11110f] via-transparent to-transparent"/></div>
          <div className="space-y-7 p-6 md:p-10">
            <div className="flex flex-wrap gap-2"><Link onClick={trackCategory} to={`/haberler/kategori/${categorySlug}`} className="rounded-lg bg-primary px-3 py-1 text-xs font-black uppercase text-background">{article.category ?? 'Haber'}</Link>{article.tags.map((tag) => <Link key={tag.slug} to={`/haberler/etiket/${tag.slug}`} className="rounded-lg bg-surface-high px-3 py-1 text-xs text-on-surface-variant hover:text-primary">#{tag.name}</Link>)}</div>
            <h1 className="font-headline text-3xl font-extrabold leading-tight text-white md:text-5xl">{article.title}</h1>
            <div className="flex flex-col gap-4 border-y border-outline/10 py-5 text-sm text-on-surface-variant sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3">{localSourceLogo ? <img src={localSourceLogo} alt="" className="h-9 w-9 rounded-lg object-contain"/> : <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/5 font-black text-primary">{sourceName.slice(0,1)}</span>}<span><b className="text-white">{sourceName}</b><br/>{formatDate(article.publishedAt)}</span></div><span>{article.readingTimeMinutes} dk özet okuma</span></div>
            <section ref={summaryRef} className="rounded-3xl border border-primary/20 bg-primary/5 p-6 md:p-8"><div className="flex items-center gap-2 text-primary"><Sparkles size={19}/><h2 className="font-headline text-lg font-extrabold uppercase tracking-wide">Türkçe Haber Özeti</h2></div>{article.excerpt ? article.excerpt.split(/\n{2,}/).map((paragraph,index) => <p key={index} className="mt-5 text-lg leading-8 text-[#d2d8e9]">{paragraph}</p>) : <p className="mt-5 text-base leading-7 text-on-surface-variant">Bu haber için Türkçe özet hazırlanıyor.</p>}<p className="mt-5 text-xs leading-5 text-[#8e98b4]">Özet, kaynağın paylaşılmasına izin verdiği başlık ve kısa açıklama kullanılarak hazırlanır; tam metin kopyalanmaz. Yatırım tavsiyesi değildir.</p></section>
            {article.aiSummary && <section className="border-t border-outline/10 pt-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-primary">KriptoKeyfi Editoryal Katkısı</p><h2 className="mt-2 font-headline text-2xl font-extrabold text-white">Yorum ve olası etkiler</h2></div>{article.aiSummary.needsReview && <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold text-amber-300">Sınırlı kaynak verisi</span>}</div><p className="mt-3 text-xs leading-5 text-[#8e98b4]">Bu bölüm kaynak metni değildir; koşullu KriptoKeyfi değerlendirmesidir.</p><div className="mt-6 space-y-5 text-[17px] leading-8 text-[#c8d0e4]">{article.aiSummary.whyItMatters && <p><strong className="font-black text-white">Neden önemli? </strong>{article.aiSummary.whyItMatters}</p>}{article.aiSummary.marketImpact && <p><strong className="font-black text-white">Olası etkiler: </strong>{article.aiSummary.marketImpact}</p>}{article.aiSummary.watchOuts && <p><strong className="font-black text-white">Takip edilecekler: </strong>{article.aiSummary.watchOuts}</p>}</div></section>}
          </div>
        </article>

        <section className="rounded-3xl border border-primary/25 bg-primary/[0.04] p-6 md:flex md:items-center md:justify-between md:gap-6"><div className="flex items-center gap-4">{localSourceLogo ? <img src={localSourceLogo} alt={`${sourceName} logosu`} width="48" height="48" loading="lazy" decoding="async" className="h-12 w-12 rounded-xl bg-white object-contain p-1"/> : <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 font-black text-primary">{sourceName.slice(0,1)}</div>}<div><p className="font-bold text-white">Bu özet {sourceName} kaynağından derlenmiştir.</p><p className="mt-1 text-sm text-on-surface-variant">Orijinal haber ve tüm ayrıntılar için kaynağı ziyaret edin.</p></div></div><a onClick={() => trackNewsEvent({ type: 'NEWS_SOURCE_CLICK', articleId: article.id, sourceSlug: article.source?.slug, category: article.category ?? undefined, ...engagement() })} href={article.originalUrl} target="_blank" rel="nofollow noopener noreferrer" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-primary px-5 py-4 text-center text-sm font-black text-primary hover:bg-primary/10 md:mt-0 md:w-auto">Haberin devamını {sourceName} üzerinde oku <ExternalLink size={17}/></a></section>

        <nav aria-label="Haber işlemleri" className="flex flex-col gap-3 rounded-2xl border border-outline/10 bg-[#11110f] p-4 sm:flex-row sm:flex-wrap sm:items-center"><button onClick={toggleSave} className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-primary"><Bookmark size={16} fill={saved ? 'currentColor' : 'none'}/>{saved ? 'Kaydedildi' : 'Haberi kaydet'}</button><button onClick={() => void share()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-on-surface"><Share2 size={16}/> Haberi paylaş</button><Link to="/haberler" className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 px-4 py-3 text-sm font-bold text-primary sm:ml-auto"><ArrowLeft size={16}/> Haber merkezine dön</Link></nav>

        {related.length > 0 && <section><h2 className="mb-4 font-headline text-2xl font-bold text-white">İlgili haberler</h2><div className="grid gap-4 sm:grid-cols-2">{related.slice(0,4).map((item) => <Link onClick={() => trackNewsEvent({ type: 'RELATED_NEWS_CLICK', articleId: article.id, sourceSlug: article.source?.slug, category: article.category ?? undefined, targetArticleId: item.slug, ...engagement() })} key={item.id} to={`/haberler/${item.slug}`} className="group overflow-hidden rounded-2xl border border-outline/10 bg-[#11110f] hover:border-primary/25"><NewsArtwork article={item} className="aspect-[16/8] w-full" imageClassName="transition duration-500 group-hover:scale-105"/><div className="p-4"><p className="text-[10px] font-black uppercase tracking-wider text-primary">{item.source?.name ?? item.category ?? 'Haber'}</p><h3 className="mt-2 line-clamp-2 font-bold text-white group-hover:text-primary">{item.title}</h3></div></Link>)}</div></section>}
        {error && <p className="text-sm text-error">{error}</p>}
      </main>

      <aside className="space-y-6 xl:sticky xl:top-28">
        <section className="rounded-[28px] border border-outline/10 bg-[#11110f] p-5"><h2 className="font-headline text-xl font-extrabold text-white">En Çok Okunan</h2><div className="mt-4 space-y-3">{popular.map((item,index) => <Link key={item.id} to={`/haberler/${item.slug}`} className="flex gap-3 rounded-2xl bg-[#171614] p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-black text-primary">{index+1}</span><div><h3 className="line-clamp-2 text-sm font-bold text-white">{item.title}</h3><p className="mt-1 text-[10px] text-on-surface-variant">{item.viewCount} okuma</p></div></Link>)}</div></section>
        {sidebarTags.length > 0 && <section className="rounded-[28px] border border-outline/10 bg-[#11110f] p-5"><h2 className="font-headline text-xl font-extrabold text-white">Popüler Etiketler</h2><div className="mt-4 flex flex-wrap gap-2">{sidebarTags.map(([tagSlug,name]) => <Link key={tagSlug} to={`/haberler/etiket/${tagSlug}`} className="rounded-lg bg-[#1a1917] px-3 py-2 text-xs font-bold text-primary">#{name}</Link>)}</div></section>}
      </aside>
    </div>
  </div>;
}
