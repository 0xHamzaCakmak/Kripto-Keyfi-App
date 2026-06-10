import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BellPlus,
  CheckCircle2,
  Clock3,
  Heart,
  MessageCircle,
  Play,
  Search,
  Sparkles,
  ThumbsUp,
  UserPlus
} from 'lucide-react';
import { VIDEO_CATEGORIES, VIDEOS } from '../constants';
import { Video } from '../types';
import { cn } from '../lib/utils';

type SavedKind = 'favorites' | 'watchLater' | 'followedChannels';

function useSavedItems(kind: SavedKind) {
  const key = `kripto-keyfi-${kind}`;
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

function videoMatchesSearch(video: Video, query: string) {
  const term = query.trim().toLowerCase();
  if (!term) return true;

  return [
    video.title,
    video.channelName,
    video.category,
    ...video.tags
  ].some((field) => field.toLowerCase().includes(term));
}

function filterVideos(videos: Video[], query: string, category: string) {
  return videos.filter((video) => {
    const categoryMatch =
      category === 'Tümü' ||
      (category === 'Shorts' ? video.isShort : video.category === category);

    return categoryMatch && videoMatchesSearch(video, query);
  });
}

function VideoFilters({
  activeCategory,
  onCategoryChange
}: {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
      {VIDEO_CATEGORIES.map((category) => (
        <button
          key={category}
          type="button"
          onClick={() => onCategoryChange(category)}
          className={cn(
            'shrink-0 rounded-full px-5 py-2 text-xs font-bold uppercase tracking-wider transition-all',
            activeCategory === category
              ? 'bg-secondary text-background'
              : 'bg-surface-high text-on-surface-variant hover:bg-surface-highest hover:text-white'
          )}
        >
          {category}
        </button>
      ))}
    </div>
  );
}

function VideoActions({ video }: { video: Video }) {
  const favorites = useSavedItems('favorites');
  const watchLater = useSavedItems('watchLater');

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Favorilere ekle"
        onClick={(event) => {
          event.preventDefault();
          favorites.toggle(video.id);
        }}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl border transition-all',
          favorites.has(video.id)
            ? 'border-error/20 bg-error/10 text-error'
            : 'border-outline/10 bg-surface-high text-on-surface-variant hover:text-error'
        )}
      >
        <Heart size={16} fill={favorites.has(video.id) ? 'currentColor' : 'none'} />
      </button>
      <button
        type="button"
        aria-label="Daha sonra izle"
        onClick={(event) => {
          event.preventDefault();
          watchLater.toggle(video.id);
        }}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl border transition-all',
          watchLater.has(video.id)
            ? 'border-primary/20 bg-primary/10 text-primary'
            : 'border-outline/10 bg-surface-high text-on-surface-variant hover:text-primary'
        )}
      >
        <Clock3 size={16} />
      </button>
    </div>
  );
}

function VideoCard({ video, compact = false }: { video: Video; compact?: boolean }) {
  return (
    <Link
      to={`/videos/${video.id}`}
      className={cn(
        'group block overflow-hidden rounded-[24px] border border-outline/5 bg-surface transition-all hover:-translate-y-1 hover:bg-surface-high',
        video.isShort && 'md:max-w-[300px]'
      )}
    >
      <div className={cn('relative overflow-hidden bg-surface-highest', video.isShort ? 'aspect-[9/14]' : 'aspect-video')}>
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-80" />
        <span className="absolute bottom-3 right-3 rounded-lg bg-background/85 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
          {video.duration}
        </span>
        <span className="absolute left-3 top-3 rounded-lg bg-primary/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-background">
          {video.category}
        </span>
        {video.isShort && (
          <span className="absolute bottom-3 left-3 rounded-lg bg-tertiary/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-background">
            Shorts
          </span>
        )}
        <span className="absolute inset-0 m-auto flex h-12 w-12 scale-90 items-center justify-center rounded-full bg-background/70 text-white opacity-0 backdrop-blur transition-all group-hover:scale-100 group-hover:opacity-100">
          <Play size={18} fill="currentColor" />
        </span>
      </div>

      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className={cn('font-headline font-bold leading-snug text-white group-hover:text-primary', compact ? 'text-base line-clamp-2' : 'text-lg line-clamp-2')}>
            {video.title}
          </h3>
          <VideoActions video={video} />
        </div>

        <div className="flex items-center gap-3">
          <img src={video.channelAvatar} alt={video.channelName} className="h-9 w-9 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-bold text-on-surface">{video.channelName}</p>
              {video.channelVerified && <CheckCircle2 size={14} className="shrink-0 text-primary" />}
            </div>
            <p className="text-xs text-on-surface-variant">{video.viewCount} görüntülenme / {video.publishedAt}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function VideoGrid({ videos }: { videos: Video[] }) {
  if (!videos.length) {
    return (
      <div className="rounded-[24px] border border-outline/5 bg-surface p-10 text-center">
        <p className="font-headline text-xl font-bold text-white">Video bulunamadı</p>
        <p className="mt-2 text-sm text-on-surface-variant">Arama veya kategori filtresini değiştirerek tekrar deneyin.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}

function TrendingVideos({ videos }: { videos: Video[] }) {
  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-headline text-2xl font-extrabold text-white">Trend İçerikler</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Son dönemde öne çıkan kripto ve Web3 videoları.</p>
        </div>
        <Link to="/watch-later" className="hidden items-center gap-2 text-sm font-bold text-primary hover:underline sm:flex">
          İzleme listem
          <ArrowRight size={16} />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} compact />
        ))}
      </div>
    </section>
  );
}

export default function VideoCenter() {
  const params = useParams();
  const routeCategory = params.category ? decodeURIComponent(params.category) : 'Tümü';
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(routeCategory);

  const videos = useMemo(() => filterVideos(VIDEOS, query, activeCategory), [query, activeCategory]);
  const trending = VIDEOS.filter((video) => video.isTrending).slice(0, 3);

  return (
    <div className="space-y-10">
      <section className="rounded-[32px] border border-outline/5 bg-surface p-6 md:p-8">
        <div className="grid gap-8 xl:grid-cols-[1fr_360px] xl:items-end">
          <div>
            <h1 className="font-headline text-4xl font-extrabold tracking-tight text-white md:text-5xl">
              Kripto Keyfi Video Merkezi
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-on-surface-variant">
              Kripto, blockchain, Web3, DeFi, smart contract ve yazılım dünyasından seçilmiş video içerikleri tek yerde.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/favorites" className="rounded-xl bg-surface-high px-3 py-3 text-center text-sm font-bold text-on-surface hover:bg-surface-highest">
              Favoriler
            </Link>
            <Link to="/watch-later" className="rounded-xl bg-surface-high px-3 py-3 text-center text-sm font-bold text-on-surface hover:bg-surface-highest">
              Daha Sonra
            </Link>
            <Link to="/followed-channels" className="rounded-xl bg-surface-high px-3 py-3 text-center text-sm font-bold text-on-surface hover:bg-surface-highest">
              Kanallar
            </Link>
            <Link to="/creator/apply" className="rounded-xl bg-primary px-3 py-3 text-center text-sm font-bold text-background hover:opacity-90">
              Creator Başvurusu
            </Link>
          </div>
        </div>

        <div className="mt-8 space-y-5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-outline" size={20} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-full border-none bg-surface-high py-4 pl-12 pr-5 text-sm text-on-surface placeholder:text-outline/70 focus:ring-2 focus:ring-primary/25"
              placeholder="Video, kanal veya konu ara..."
              type="search"
            />
          </div>
          <VideoFilters activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
        </div>
      </section>

      <TrendingVideos videos={trending} />

      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-headline text-2xl font-extrabold text-white">Tüm Videolar</h2>
          <p className="text-sm font-medium text-on-surface-variant">{videos.length} içerik</p>
        </div>
        <VideoGrid videos={videos} />
      </section>
    </div>
  );
}

function AiSummaryBox({ video }: { video: Video }) {
  return (
    <section className="rounded-[24px] border border-primary/10 bg-primary/5 p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles size={18} />
        </span>
        <h2 className="font-headline text-xl font-bold text-white">AI Video Özeti</h2>
      </div>
      <p className="text-sm leading-7 text-on-surface">{video.aiSummary}</p>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">Ana başlıklar</h3>
          <div className="space-y-2">
            {video.aiTopics.map((topic) => (
              <p key={topic} className="rounded-xl bg-surface-high/70 px-3 py-2 text-sm text-on-surface">{topic}</p>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-primary">Önemli dakikalar</h3>
          <div className="space-y-2">
            {video.aiTimestamps.map((timestamp) => (
              <p key={`${timestamp.time}-${timestamp.label}`} className="rounded-xl bg-surface-high/70 px-3 py-2 text-sm text-on-surface">
                <span className="font-bold text-secondary">{timestamp.time}</span> {timestamp.label}
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CommentSection({ video }: { video: Video }) {
  const isLoggedIn = false;

  return (
    <section className="rounded-[24px] border border-outline/5 bg-surface p-6">
      <div className="mb-6 flex items-center gap-3">
        <MessageCircle className="text-primary" size={20} />
        <h2 className="font-headline text-xl font-bold text-white">Kripto Keyfi Yorumları</h2>
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
        {video.comments.length === 0 ? (
          <div className="rounded-2xl bg-surface-high/40 p-6 text-center text-sm text-on-surface-variant">
            Henüz yorum yok. İlk yorumu giriş yaptıktan sonra siz bırakabilirsiniz.
          </div>
        ) : (
          video.comments.map((comment) => (
            <article key={comment.id} className="flex gap-4 rounded-2xl bg-surface-high/40 p-4">
              <img src={comment.avatar} alt={comment.username} className="h-10 w-10 rounded-xl" />
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-sm font-bold text-white">{comment.username}</p>
                  <span className="text-[10px] text-on-surface-variant">{comment.date}</span>
                </div>
                <p className="text-sm leading-6 text-on-surface/90">{comment.content}</p>
                <div className="mt-3 flex items-center gap-4 text-xs font-bold text-on-surface-variant">
                  <button type="button" className="flex items-center gap-1 hover:text-primary">
                    <ThumbsUp size={14} /> {comment.likes}
                  </button>
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

function RelatedVideos({ currentVideo }: { currentVideo: Video }) {
  const related = VIDEOS.filter((video) => video.id !== currentVideo.id).sort((a, b) => {
    const aScore = Number(a.channelSlug === currentVideo.channelSlug) + Number(a.category === currentVideo.category);
    const bScore = Number(b.channelSlug === currentVideo.channelSlug) + Number(b.category === currentVideo.category);
    return bScore - aScore;
  }).slice(0, 5);

  return (
    <aside className="space-y-4 xl:sticky xl:top-32">
      <h2 className="font-headline text-xl font-bold text-white">Önerilen Videolar</h2>
      {related.map((video) => (
        <Link key={video.id} to={`/videos/${video.id}`} className="group flex gap-3 rounded-2xl bg-surface p-3 transition-colors hover:bg-surface-high">
          <div className={cn('relative w-32 shrink-0 overflow-hidden rounded-xl bg-surface-highest', video.isShort ? 'aspect-[9/12]' : 'aspect-video')}>
            <img src={video.thumbnailUrl} alt={video.title} className="h-full w-full object-cover" />
            <span className="absolute bottom-1 right-1 rounded bg-background/80 px-1.5 py-0.5 text-[9px] font-bold text-white">{video.duration}</span>
          </div>
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-bold text-white group-hover:text-primary">{video.title}</h3>
            <p className="mt-2 text-xs text-on-surface-variant">{video.channelName}</p>
            <p className="text-xs text-on-surface-variant">{video.viewCount} görüntülenme</p>
          </div>
        </Link>
      ))}
    </aside>
  );
}

export function VideoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const video = VIDEOS.find((item) => item.id === id);

  if (!video) {
    return (
      <div className="rounded-[24px] bg-surface p-10 text-center">
        <p className="font-headline text-xl font-bold text-white">Video bulunamadı</p>
        <Link to="/videos" className="mt-4 inline-flex text-primary hover:underline">Video merkezine dön</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-highest"
      >
        <ArrowLeft size={16} />
        Geri dön
      </button>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-[28px] border border-outline/5 bg-surface">
            <div className="aspect-video w-full bg-black">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${video.youtubeVideoId}`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="space-y-5 p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h1 className="font-headline text-2xl font-extrabold leading-tight text-white md:text-3xl">{video.title}</h1>
                  <p className="mt-2 text-sm text-on-surface-variant">{video.viewCount} görüntülenme / {video.publishedAt}</p>
                </div>
                <VideoActions video={video} />
              </div>

              <Link to={`/creators/${video.channelSlug}`} className="flex w-fit items-center gap-3 rounded-2xl bg-surface-high px-4 py-3 hover:bg-surface-highest">
                <img src={video.channelAvatar} alt={video.channelName} className="h-11 w-11 rounded-xl" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-white">{video.channelName}</p>
                    {video.channelVerified && <CheckCircle2 size={15} className="text-primary" />}
                  </div>
                  <p className="text-xs text-on-surface-variant">{video.channelSubscribers} abone</p>
                </div>
              </Link>

              <div className="rounded-2xl bg-surface-high/50 p-5">
                <p className={cn('text-sm leading-7 text-on-surface-variant', !expanded && 'line-clamp-3')}>{video.description}</p>
                <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-3 text-sm font-bold text-primary hover:underline">
                  {expanded ? 'Daha az göster' : 'Devamını göster'}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {video.tags.map((tag) => (
                  <Link key={tag} to={`/videos/category/${encodeURIComponent(video.category)}`} className="rounded-lg bg-surface-high px-3 py-1.5 text-xs font-bold text-primary">
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>
          </section>

          <AiSummaryBox video={video} />
          <CommentSection video={video} />
        </div>

        <RelatedVideos currentVideo={video} />
      </div>
    </div>
  );
}

export function ChannelProfile() {
  const { creatorSlug } = useParams();
  const follows = useSavedItems('followedChannels');
  const channelVideos = VIDEOS.filter((video) => video.channelSlug === creatorSlug);
  const channel = channelVideos[0];

  if (!channel) {
    return (
      <div className="rounded-[24px] bg-surface p-10 text-center">
        <p className="font-headline text-xl font-bold text-white">Kanal bulunamadı</p>
        <Link to="/videos" className="mt-4 inline-flex text-primary hover:underline">Video merkezine dön</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[32px] border border-outline/5 bg-surface">
        <div className="h-56 bg-surface-high">
          <img src={channel.channelBanner} alt={channel.channelName} className="h-full w-full object-cover opacity-70" />
        </div>
        <div className="-mt-12 flex flex-col gap-6 p-6 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <img src={channel.channelAvatar} alt={channel.channelName} className="h-24 w-24 rounded-[28px] border-4 border-surface" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-headline text-3xl font-extrabold text-white">{channel.channelName}</h1>
                {channel.channelVerified && <CheckCircle2 className="text-primary" size={22} />}
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">{channel.channelDescription}</p>
              <p className="mt-3 text-sm font-bold text-on-surface">{channel.channelSubscribers} abone / {channelVideos.length} video</p>
            </div>
          </div>
          <div className="flex gap-3">
            <a href={`https://www.youtube.com/@${channel.channelSlug}`} target="_blank" rel="noreferrer" className="rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-on-surface hover:bg-surface-highest">
              YouTube Kanalına Git
            </a>
            <button
              type="button"
              onClick={() => follows.toggle(channel.channelSlug)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all',
                follows.has(channel.channelSlug) ? 'bg-primary text-background' : 'bg-surface-high text-primary hover:bg-surface-highest'
              )}
            >
              <UserPlus size={16} />
              {follows.has(channel.channelSlug) ? 'Takip ediliyor' : 'Takip et'}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="space-y-5">
          <h2 className="font-headline text-2xl font-bold text-white">Son Videolar</h2>
          <VideoGrid videos={channelVideos} />
        </section>
        <aside className="rounded-[24px] border border-outline/5 bg-surface p-6 lg:self-start">
          <h2 className="font-headline text-xl font-bold text-white">Kategoriler</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {[...new Set(channelVideos.map((video) => video.category))].map((category) => (
              <Link key={category} to={`/videos/category/${encodeURIComponent(category)}`} className="rounded-lg bg-surface-high px-3 py-2 text-xs font-bold text-primary">
                {category}
              </Link>
            ))}
            {channelVideos.some((video) => video.isShort) && (
              <Link to="/videos/category/Shorts" className="rounded-lg bg-tertiary/10 px-3 py-2 text-xs font-bold text-tertiary">
                Shorts
              </Link>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export function SavedVideosPage({ type }: { type: 'favorites' | 'watchLater' | 'followedChannels' }) {
  const saved = useSavedItems(type);
  const title = type === 'favorites' ? 'Favoriler' : type === 'watchLater' ? 'İzleme Listem' : 'Takip Edilen Kanallar';
  const description = type === 'favorites'
    ? 'Favorilere eklediğiniz videolar burada görünür.'
    : type === 'watchLater'
      ? 'Daha sonra izlemek için ayırdığınız videolar.'
      : 'Takip ettiğiniz içerik üreticilerinin kanalları.';

  const savedVideos = type === 'followedChannels' ? [] : VIDEOS.filter((video) => saved.has(video.id));
  const followedChannels = [...new Map(VIDEOS.filter((video) => saved.has(video.channelSlug)).map((video) => [video.channelSlug, video])).values()];

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-outline/5 bg-surface p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {type === 'favorites' ? <Heart size={20} /> : type === 'watchLater' ? <Clock3 size={20} /> : <BellPlus size={20} />}
          </span>
          <div>
            <h1 className="font-headline text-4xl font-extrabold text-white">{title}</h1>
            <p className="mt-2 text-on-surface-variant">{description}</p>
          </div>
        </div>
      </section>

      {type === 'followedChannels' ? (
        followedChannels.length ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {followedChannels.map((channel) => (
              <Link key={channel.channelSlug} to={`/creators/${channel.channelSlug}`} className="rounded-[24px] border border-outline/5 bg-surface p-6 hover:bg-surface-high">
                <img src={channel.channelAvatar} alt={channel.channelName} className="mb-5 h-16 w-16 rounded-2xl" />
                <div className="flex items-center gap-2">
                  <h2 className="font-headline text-xl font-bold text-white">{channel.channelName}</h2>
                  {channel.channelVerified && <CheckCircle2 size={16} className="text-primary" />}
                </div>
                <p className="mt-2 text-sm text-on-surface-variant">{channel.channelSubscribers} abone</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptySavedState label="Henüz kanal takip etmiyorsunuz." />
        )
      ) : savedVideos.length ? (
        <VideoGrid videos={savedVideos} />
      ) : (
        <EmptySavedState label="Bu listede henüz içerik yok." />
      )}
    </div>
  );
}

function EmptySavedState({ label }: { label: string }) {
  return (
    <div className="rounded-[24px] border border-outline/5 bg-surface p-10 text-center">
      <p className="font-headline text-xl font-bold text-white">{label}</p>
      <Link to="/videos" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline">
        Video merkezine git
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
