import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Bookmark, Copy, Eye, Linkedin, MessageCircle, Send, Share2, ThumbsUp, Twitter } from 'lucide-react';
import { cn } from '../lib/utils';
import { getLatestNews, getNewsBySlug } from '../services/newsService';
import { NewsArticle } from '../types';

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

  return { toggle, has: (slug: string) => items.includes(slug) };
}

function ReadingProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(height > 0 ? Math.min(100, Math.round((window.scrollY / height) * 100)) : 0);
    }

    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return <div className="fixed left-0 top-0 z-[60] h-1 bg-secondary transition-all" style={{ width: `${progress}%` }} />;
}

function ShareButtons({ article }: { article: NewsArticle }) {
  const url = `${window.location.origin}/blog/${article.slug}`;
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

function CommentSection({ article }: { article: NewsArticle }) {
  const isLoggedIn = false;

  return (
    <section className="rounded-[24px] border border-outline/5 bg-surface p-6">
      <div className="mb-6 flex items-center gap-3">
        <MessageCircle className="text-primary" size={20} />
        <h2 className="font-headline text-xl font-bold text-white">Yorumlar</h2>
      </div>
      {!isLoggedIn && (
        <div className="mb-5 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-on-surface-variant">
          Yorum yapmak için giriş yapmalısınız.
        </div>
      )}
      <textarea
        disabled={!isLoggedIn}
        className="mb-6 h-28 w-full resize-none rounded-2xl border-none bg-surface-high p-4 text-sm text-on-surface placeholder:text-outline/70 disabled:cursor-not-allowed disabled:opacity-60"
        placeholder="Yorumunuzu yazın..."
      />
      <div className="space-y-5">
        {article.comments.length === 0 ? (
          <div className="rounded-2xl bg-surface-high/40 p-6 text-center text-sm text-on-surface-variant">
            Henüz yorum yok. İlk yorumu giriş yaptıktan sonra siz bırakabilirsiniz.
          </div>
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

function RelatedNews({ article }: { article: NewsArticle }) {
  const related = getLatestNews().filter((item) => item.slug !== article.slug && (item.category === article.category || item.tags.some((tag) => article.tags.includes(tag)))).slice(0, 5);

  return (
    <aside className="space-y-5 xl:sticky xl:top-32 xl:self-start">
      <section className="rounded-[24px] border border-outline/5 bg-surface p-5">
        <h2 className="font-headline text-xl font-bold text-white">İlgili Haberler</h2>
        <div className="mt-5 space-y-4">
          {related.map((item) => (
            <Link key={item.slug} to={`/blog/${item.slug}`} className="group flex gap-3 rounded-2xl bg-surface-high/40 p-3 hover:bg-surface-high">
              <img src={item.coverImage} alt={item.title} className="h-20 w-24 rounded-xl object-cover" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{item.category}</p>
                <h3 className="mt-1 line-clamp-2 text-sm font-bold text-white group-hover:text-primary">{item.title}</h3>
                <p className="mt-2 text-xs text-on-surface-variant">{item.readingTime} / {item.viewCount}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </aside>
  );
}

export default function ArticleDetail() {
  const { slug, id } = useParams();
  const navigate = useNavigate();
  const saved = useSavedNews();
  const article = getNewsBySlug(slug || id || '');

  if (!article) {
    return (
      <div className="rounded-[24px] bg-surface p-10 text-center">
        <p className="font-headline text-xl font-bold text-white">Haber bulunamadı</p>
        <Link to="/blog" className="mt-4 inline-flex text-primary hover:underline">Haber merkezine dön</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ReadingProgressBar />
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-highest"
      >
        <ArrowLeft size={16} />
        Geri dön
      </button>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <article className="space-y-6">
          <section className="overflow-hidden rounded-[32px] border border-outline/5 bg-surface">
            <img src={article.coverImage} alt={article.title} className="aspect-[16/8] w-full object-cover" />
            <div className="space-y-5 p-6 md:p-8">
              <div className="flex flex-wrap gap-2">
                <span className="rounded-lg bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">{article.category}</span>
                {article.isBreaking && <span className="rounded-lg bg-error/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-error">Son Dakika</span>}
              </div>
              <h1 className="font-headline text-3xl font-extrabold leading-tight text-white md:text-5xl">{article.title}</h1>
              <p className="text-lg leading-8 text-on-surface-variant">{article.excerpt}</p>
              <div className="flex flex-col gap-5 border-y border-outline/5 py-5 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <img src={article.authorAvatar} alt={article.authorName} className="h-12 w-12 rounded-2xl" />
                  <div>
                    <p className="font-bold text-white">{article.authorName}</p>
                    <p className="text-xs text-on-surface-variant">{article.sourceName} / {article.publishedAt}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-on-surface-variant">
                  <span>{article.readingTime}</span>
                  <span className="inline-flex items-center gap-1"><Eye size={14} /> {article.viewCount}</span>
                  <span>Güncellendi: {article.updatedAt}</span>
                </div>
              </div>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <ShareButtons article={article} />
                <button
                  type="button"
                  onClick={() => saved.toggle(article.slug)}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold',
                    saved.has(article.slug) ? 'bg-primary text-background' : 'bg-surface-high text-primary hover:bg-surface-highest'
                  )}
                >
                  <Bookmark size={16} fill={saved.has(article.slug) ? 'currentColor' : 'none'} />
                  {saved.has(article.slug) ? 'Kaydedildi' : 'Haberi Kaydet'}
                </button>
              </div>
            </div>
          </section>

          <section className="space-y-8 rounded-[24px] border border-outline/5 bg-surface p-6 md:p-8">
            {article.content.map((block) => (
              <div key={block.id} className="space-y-3">
                <h2 className="font-headline text-2xl font-bold text-white">{block.heading}</h2>
                <p className="text-base leading-8 text-on-surface-variant">{block.body}</p>
              </div>
            ))}
          </section>

          <div className="flex flex-wrap gap-2">
            {article.tags.map((tag) => (
              <Link key={tag} to={`/blog/tag/${encodeURIComponent(tag)}`} className="rounded-lg bg-surface-high px-3 py-2 text-xs font-bold text-primary">
                #{tag}
              </Link>
            ))}
          </div>

          <CommentSection article={article} />
        </article>

        <RelatedNews article={article} />
      </div>
    </div>
  );
}
