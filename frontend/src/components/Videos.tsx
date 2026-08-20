import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Clapperboard, LayoutGrid, LoaderCircle, Play, Search, Smartphone,
  Star, ThumbsDown, ThumbsUp, UsersRound, VideoOff, X,
} from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getApiErrorMessage } from '../services/apiClient';
import {
  getFavoriteChannelIds, getPublicYoutubeChannels, getVideoReactions, getVideos, toggleFavoriteChannel,
  toggleVideoReaction, type PublicVideo, type PublicYoutubeChannel, type VideoCounts, type VideoPagination,
  type VideoReaction,
} from '../services/videoService';
import { trackPlatformEvent } from '../services/platformAnalytics';

type VideoFilter = 'all' | 'long' | 'short';
type CenterView = 'videos' | 'liked' | 'favorite-creators' | 'creators';

const filterOptions: Array<{ value: VideoFilter; label: string; icon: typeof LayoutGrid }> = [
  { value: 'all', label: 'Tüm Videolar', icon: LayoutGrid },
  { value: 'long', label: 'Uzun Videolar', icon: Clapperboard },
  { value: 'short', label: 'Shorts', icon: Smartphone },
];

function formatPublishedAt(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

function formatSubscriberCount(value: number | null) {
  if (value === null) return 'Abone verisi bekleniyor';
  return `${new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)} abone`;
}

function ChannelAvatar({ name, url }: { name: string; url: string | null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (!url || failed) return <span className="text-xs font-black text-primary">{name.slice(0, 1).toLocaleUpperCase('tr-TR')}</span>;
  return <img src={url} alt={`${name} profil resmi`} onError={() => setFailed(true)} className="h-full w-full object-cover" />;
}

function VideoModal({ video, onClose }: { video: PublicVideo; onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={`${video.title} videosu`}>
      <button type="button" className="absolute inset-0 bg-black/85 backdrop-blur-sm" aria-label="Video oynatıcısını kapat" onClick={onClose} />
      <div className={`relative z-10 w-full overflow-hidden rounded-[24px] border border-outline/15 bg-black shadow-2xl ${video.contentType === 'short' ? 'max-w-sm' : 'max-w-5xl'}`}>
        <button type="button" autoFocus onClick={onClose} aria-label="Kapat" className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur transition hover:bg-error focus:outline-none focus:ring-2 focus:ring-primary"><X size={22} /></button>
        <div className={video.contentType === 'short' ? 'mx-auto aspect-[9/16] max-h-[88vh] w-full' : 'aspect-video w-full'}>
          <iframe className="h-full w-full" src={`https://www.youtube.com/embed/${video.youtubeVideoId}?autoplay=1`} title={video.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
        </div>
      </div>
    </div>
  );
}

type VideoCardProps = {
  video: PublicVideo;
  creatorFavorited: boolean;
  creatorBusy: boolean;
  reaction: VideoReaction | undefined;
  reactionBusy: boolean;
  onPlay: () => void;
  onCreatorFavorite: () => void;
  onReaction: (reaction: VideoReaction) => void;
};

function VideoCard({ video, creatorFavorited, creatorBusy, reaction, reactionBusy, onPlay, onCreatorFavorite, onReaction }: VideoCardProps) {
  return (
    <article className="group overflow-hidden rounded-[24px] border border-outline/10 bg-surface transition hover:-translate-y-1 hover:border-primary/30 hover:bg-surface-high">
      <button type="button" onClick={onPlay} className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary">
        <div className="relative aspect-video overflow-hidden bg-surface-highest">
          {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><VideoOff className="text-on-surface-variant" size={36} /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
          <span className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-background shadow-xl transition group-hover:scale-110"><Play size={21} fill="currentColor" /></span>
          {video.duration && <span className="absolute bottom-3 right-3 rounded-lg bg-black/80 px-2 py-1 text-xs font-bold text-white">{video.duration}</span>}
          {video.contentType === 'short' && <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-error px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white"><Smartphone size={12} /> Shorts</span>}
        </div>
        <div className="px-5 pt-5">
          {video.source !== 'admin_manual' && <span className={`mb-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${video.source === 'kriptokeyfi_auto' ? 'bg-primary/15 text-primary' : 'bg-secondary/10 text-secondary'}`}>{video.source === 'kriptokeyfi_auto' ? 'Resmî Kanal' : 'Creator'}</span>}
          <h2 className="line-clamp-2 font-headline text-lg font-bold leading-snug text-white group-hover:text-primary">{video.title}</h2>
        </div>
      </button>
      <div className="flex items-center gap-2 px-5 pb-5 pt-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-highest ring-1 ring-outline/10"><ChannelAvatar name={video.channelName} url={video.channelAvatarUrl} /></div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-on-surface">{video.channelName}</p>
          {video.publishedAt && <p className="mt-0.5 text-xs text-on-surface-variant">{formatPublishedAt(video.publishedAt)}</p>}
        </div>
        <button type="button" disabled={reactionBusy} onClick={() => onReaction('like')} aria-label="Videoyu beğen" aria-pressed={reaction === 'like'} title="Beğen" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-50 ${reaction === 'like' ? 'bg-secondary/15 text-secondary' : 'bg-surface-high text-on-surface-variant hover:text-secondary'}`}><ThumbsUp size={17} fill={reaction === 'like' ? 'currentColor' : 'none'} /></button>
        <button type="button" disabled={reactionBusy} onClick={() => onReaction('dislike')} aria-label="Videoyu beğenme" aria-pressed={reaction === 'dislike'} title="Beğenme" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-50 ${reaction === 'dislike' ? 'bg-error/15 text-error' : 'bg-surface-high text-on-surface-variant hover:text-error'}`}><ThumbsDown size={17} fill={reaction === 'dislike' ? 'currentColor' : 'none'} /></button>
        {video.channelId && <button type="button" disabled={creatorBusy} onClick={onCreatorFavorite} aria-label={creatorFavorited ? `${video.channelName} YouTuber favorilerinden çıkar` : `${video.channelName} YouTuber favorilerine ekle`} aria-pressed={creatorFavorited} title="Favori YouTuber" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-50 ${creatorFavorited ? 'bg-primary/15 text-primary' : 'bg-surface-high text-on-surface-variant hover:text-primary'}`}><Star size={18} fill={creatorFavorited ? 'currentColor' : 'none'} /></button>}
      </div>
    </article>
  );
}

function CreatorCard({ channel, favorited, busy, onFavorite, onVideos }: { channel: PublicYoutubeChannel; favorited: boolean; busy: boolean; onFavorite: () => void; onVideos: () => void }) {
  return (
    <article className="rounded-[24px] border border-outline/10 bg-surface p-6 transition hover:border-primary/30 hover:bg-surface-high">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-highest ring-1 ring-outline/10"><ChannelAvatar name={channel.channelName} url={channel.avatarUrl} /></div>
        <div className="min-w-0 flex-1"><h2 className="truncate font-headline text-lg font-bold text-white">{channel.channelName}</h2><p className="mt-1 text-sm text-on-surface-variant">{formatSubscriberCount(channel.subscriberCount)} · {channel.videoCount} video</p></div>
        <button type="button" disabled={busy} onClick={onFavorite} aria-label={favorited ? 'Favori YouTuber listesinden çıkar' : 'Favori YouTuber listesine ekle'} aria-pressed={favorited} className={`flex h-11 w-11 items-center justify-center rounded-xl transition disabled:opacity-50 ${favorited ? 'bg-primary/15 text-primary' : 'bg-surface-high text-on-surface-variant hover:text-primary'}`}><Star size={19} fill={favorited ? 'currentColor' : 'none'} /></button>
      </div>
      <button type="button" onClick={onVideos} className="mt-5 w-full rounded-xl bg-primary/10 px-4 py-3 text-sm font-black text-primary transition hover:bg-primary hover:text-background">Videolarını görüntüle</button>
    </article>
  );
}

export default function VideoCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<PublicVideo[]>([]);
  const [channels, setChannels] = useState<PublicYoutubeChannel[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [reactions, setReactions] = useState<Map<number, VideoReaction>>(new Map());
  const [creatorBusyId, setCreatorBusyId] = useState<number | null>(null);
  const [reactionBusyId, setReactionBusyId] = useState<number | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<PublicVideo | null>(null);
  const [view, setView] = useState<CenterView>('videos');
  const [filter, setFilter] = useState<VideoFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [channelId, setChannelId] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState<VideoCounts>({ all: 0, long: 0, short: 0 });
  const [pagination, setPagination] = useState<VideoPagination>({ page: 1, limit: 24, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const favoriteChannels = useMemo(() => channels.filter((channel) => favoriteIds.has(channel.id)), [channels, favoriteIds]);
  const displayedCreators = useMemo(() => {
    const query = debouncedSearch.toLocaleLowerCase('tr-TR');
    return channels.filter((channel) => !query || channel.channelName.toLocaleLowerCase('tr-TR').includes(query));
  }, [channels, debouncedSearch]);

  useEffect(() => { getPublicYoutubeChannels().then(setChannels).catch(() => undefined); }, []);
  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      setReactions(new Map());
      if (view !== 'videos' && view !== 'creators') setView('videos');
      return;
    }
    Promise.all([getFavoriteChannelIds(), getVideoReactions()])
      .then(([ids, items]) => {
        setFavoriteIds(new Set(ids));
        setReactions(new Map(items.map((item) => [item.videoId, item.reaction])));
      })
      .catch(() => undefined);
  }, [user, view]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => { setPage(1); }, [debouncedSearch, filter, channelId, view]);
  useEffect(() => {
    if (view === 'creators') { setLoading(false); setError(''); return; }
    let active = true;
    setLoading(true);
    setError('');
    getVideos({
      contentType: filter,
      search: debouncedSearch,
      channelId,
      favoritesOnly: view === 'favorite-creators',
      likedOnly: view === 'liked',
      page,
      limit: 24,
    })
      .then((result) => {
        if (!active) return;
        setVideos(result.videos);
        setCounts(result.counts);
        setPagination(result.pagination);
      })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason, 'Videolar şu anda yüklenemiyor.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [channelId, debouncedSearch, filter, page, view]);

  function selectView(nextView: CenterView) {
    if (!user && (nextView === 'liked' || nextView === 'favorite-creators')) {
      navigate('/login', { state: { from: '/videos' } });
      return;
    }
    setView(nextView);
    setChannelId(undefined);
  }

  async function favoriteCreator(id: number) {
    if (!user) { navigate('/login', { state: { from: '/videos' } }); return; }
    if (creatorBusyId) return;
    setCreatorBusyId(id);
    try {
      const favorited = await toggleFavoriteChannel(id);
      setFavoriteIds((current) => {
        const next = new Set(current);
        if (favorited) next.add(id); else next.delete(id);
        return next;
      });
      if (!favorited && view === 'favorite-creators') {
        if (channelId === id) setChannelId(undefined);
        setVideos((current) => current.filter((video) => video.channelId !== id));
      }
    } catch (reason) {
      setError(getApiErrorMessage(reason, 'Favori YouTuber güncellenemedi.'));
    } finally {
      setCreatorBusyId(null);
    }
  }

  async function reactToVideo(videoId: number, reaction: VideoReaction) {
    if (!user) { navigate('/login', { state: { from: '/videos' } }); return; }
    if (reactionBusyId) return;
    setReactionBusyId(videoId);
    try {
      const nextReaction = await toggleVideoReaction(videoId, reaction);
      setReactions((current) => {
        const next = new Map(current);
        if (nextReaction) next.set(videoId, nextReaction); else next.delete(videoId);
        return next;
      });
      if (view === 'liked' && nextReaction !== 'like') setVideos((current) => current.filter((video) => video.id !== videoId));
    } catch (reason) {
      setError(getApiErrorMessage(reason, 'Video beğenisi güncellenemedi.'));
    } finally {
      setReactionBusyId(null);
    }
  }

  const heading = view === 'liked'
    ? 'Beğenilen Videolar'
    : view === 'favorite-creators'
      ? (channelId ? favoriteChannels.find((channel) => channel.id === channelId)?.channelName ?? 'Favori YouTuber Videoları' : 'Favori YouTuberların Tüm Videoları')
      : filterOptions.find((option) => option.value === filter)?.label;

  return (
    <div className="space-y-8">
      <section className="kk-gold-panel rounded-[32px] p-7 md:p-10">
        <p className="text-xs font-black uppercase tracking-[.24em] text-primary">Seçili yayınlar</p>
        <h1 className="mt-3 font-headline text-4xl font-extrabold tracking-tight text-white md:text-5xl">KriptoKeyfi Video Merkezi</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-on-surface-variant">Videoları tek tek beğenin, favori YouTuberlarınızı takip edin ve içeriklerini ayrı listelerde keşfedin.</p>
      </section>

      <section className="rounded-[24px] border border-outline/10 bg-surface p-4 md:p-5">
        <label className="relative block w-full">
          <span className="sr-only">Video veya YouTuber ara</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Video veya YouTuber ara..." className="w-full rounded-2xl border border-outline/10 bg-background/55 py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-on-surface-variant focus:border-primary" />
        </label>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button type="button" onClick={() => selectView('videos')} aria-pressed={view === 'videos'} className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${view === 'videos' ? 'bg-primary text-background' : 'bg-surface-high text-on-surface-variant hover:text-white'}`}><LayoutGrid size={17} /> Tüm Videolar</button>
          <button type="button" onClick={() => selectView('liked')} aria-pressed={view === 'liked'} className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${view === 'liked' ? 'bg-secondary text-background' : 'bg-surface-high text-on-surface-variant hover:text-white'}`}><ThumbsUp size={17} /> Beğenilen Videolar</button>
          <button type="button" onClick={() => selectView('favorite-creators')} aria-pressed={view === 'favorite-creators'} className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${view === 'favorite-creators' ? 'bg-primary text-background' : 'bg-surface-high text-on-surface-variant hover:text-white'}`}><Star size={17} fill={view === 'favorite-creators' ? 'currentColor' : 'none'} /> Favori YouTuberlar</button>
          <button type="button" onClick={() => selectView('creators')} aria-pressed={view === 'creators'} className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${view === 'creators' ? 'bg-primary text-background' : 'bg-surface-high text-on-surface-variant hover:text-white'}`}><UsersRound size={17} /> YouTuberları Görüntüle</button>
        </div>

        {view !== 'creators' && <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
            {filterOptions.map((option) => {
              const Icon = option.icon;
              return <button key={option.value} type="button" onClick={() => setFilter(option.value)} aria-pressed={filter === option.value} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition ${filter === option.value ? 'bg-primary/15 text-primary' : 'bg-background/45 text-on-surface-variant hover:text-white'}`}><Icon size={15} />{option.label}<span className="rounded-full bg-background/50 px-2 py-0.5 text-[10px]">{counts[option.value]}</span></button>;
            })}
          </div>
          {view === 'videos' && <select value={channelId ?? ''} onChange={(event) => setChannelId(event.target.value ? Number(event.target.value) : undefined)} aria-label="YouTuber seç" className="rounded-2xl border border-outline/10 bg-surface-high px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"><option value="">Tüm YouTuberlar</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.channelName} ({channel.videoCount})</option>)}</select>}
        </div>}
      </section>

      {view === 'creators' ? (
        displayedCreators.length === 0 ? <EmptyState title="YouTuber bulunamadı" /> : <section><div className="mb-5 flex items-end justify-between"><h2 className="font-headline text-2xl font-extrabold text-white">YouTuber Profilleri</h2><p className="text-sm text-on-surface-variant">{displayedCreators.length} YouTuber</p></div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{displayedCreators.map((channel) => <CreatorCard key={channel.id} channel={channel} favorited={favoriteIds.has(channel.id)} busy={creatorBusyId === channel.id} onFavorite={() => void favoriteCreator(channel.id)} onVideos={() => { setView('videos'); setChannelId(channel.id); }} />)}</div></section>
      ) : (
        <div className={view === 'favorite-creators' ? 'grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]' : ''}>
          {view === 'favorite-creators' && <aside className="h-fit rounded-[24px] border border-outline/10 bg-surface p-4 lg:sticky lg:top-24"><h2 className="px-2 font-headline text-lg font-bold text-white">Favori YouTuberlar</h2><div className="mt-3 space-y-1"><button type="button" onClick={() => setChannelId(undefined)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-bold transition ${channelId === undefined ? 'bg-primary text-background' : 'text-on-surface-variant hover:bg-surface-high hover:text-white'}`}><LayoutGrid size={17} /> Tüm Videolar</button>{favoriteChannels.map((channel) => <button key={channel.id} type="button" onClick={() => setChannelId(channel.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${channelId === channel.id ? 'bg-primary/15 text-primary' : 'text-on-surface-variant hover:bg-surface-high hover:text-white'}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-highest"><ChannelAvatar name={channel.channelName} url={channel.avatarUrl} /></span><span className="min-w-0"><span className="block truncate text-sm font-bold">{channel.channelName}</span><span className="block text-[10px] opacity-70">{channel.videoCount} video</span></span></button>)}</div>{favoriteChannels.length === 0 && <p className="px-2 py-5 text-xs leading-5 text-on-surface-variant">Henüz favori YouTuber eklemediniz. Video kartlarındaki yıldız simgesini kullanabilirsiniz.</p>}</aside>}
          <VideoResults loading={loading} error={error} videos={videos} heading={heading ?? 'Videolar'} pagination={pagination} page={page} favoriteIds={favoriteIds} reactions={reactions} creatorBusyId={creatorBusyId} reactionBusyId={reactionBusyId} onPage={setPage} onPlay={(video) => { setSelectedVideo(video); trackPlatformEvent('video_open', { video_id: video.id }); }} onCreatorFavorite={(video) => video.channelId && void favoriteCreator(video.channelId)} onReaction={(videoId, reaction) => void reactToVideo(videoId, reaction)} />
        </div>
      )}

      {selectedVideo && <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />}
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return <div className="rounded-[24px] border border-outline/10 bg-surface p-10 text-center"><VideoOff className="mx-auto text-primary" size={38} /><h2 className="mt-4 font-headline text-2xl font-bold text-white">{title}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-on-surface-variant">Seçili filtrelere uygun içerik bulunmuyor.</p></div>;
}

type VideoResultsProps = {
  loading: boolean;
  error: string;
  videos: PublicVideo[];
  heading: string;
  pagination: VideoPagination;
  page: number;
  favoriteIds: Set<number>;
  reactions: Map<number, VideoReaction>;
  creatorBusyId: number | null;
  reactionBusyId: number | null;
  onPage: (page: number | ((current: number) => number)) => void;
  onPlay: (video: PublicVideo) => void;
  onCreatorFavorite: (video: PublicVideo) => void;
  onReaction: (videoId: number, reaction: VideoReaction) => void;
};

function VideoResults({ loading, error, videos, heading, pagination, page, favoriteIds, reactions, creatorBusyId, reactionBusyId, onPage, onPlay, onCreatorFavorite, onReaction }: VideoResultsProps) {
  if (loading) return <div className="flex min-h-56 items-center justify-center rounded-[24px] border border-outline/10 bg-surface"><LoaderCircle className="animate-spin text-primary" size={30} /><span className="ml-3 text-sm font-bold text-on-surface-variant">Videolar yükleniyor</span></div>;
  if (error) return <div role="alert" className="rounded-[24px] border border-error/25 bg-error/10 p-8 text-center text-sm font-bold text-error">{error}</div>;
  if (videos.length === 0) return <EmptyState title="Video bulunamadı" />;
  return <section><div className="mb-5 flex items-end justify-between gap-4"><h2 className="font-headline text-2xl font-extrabold text-white">{heading}</h2><p className="text-sm text-on-surface-variant">{pagination.total} video</p></div><div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">{videos.map((video) => <VideoCard key={video.id} video={video} creatorFavorited={Boolean(video.channelId && favoriteIds.has(video.channelId))} creatorBusy={creatorBusyId === video.channelId} reaction={reactions.get(video.id)} reactionBusy={reactionBusyId === video.id} onPlay={() => onPlay(video)} onCreatorFavorite={() => onCreatorFavorite(video)} onReaction={(reaction) => onReaction(video.id, reaction)} />)}</div>{pagination.totalPages > 1 && <div className="mt-8 flex items-center justify-center gap-3"><button type="button" disabled={page <= 1} onClick={() => onPage((value) => Math.max(1, value - 1))} className="rounded-xl bg-surface-high p-3 text-white disabled:opacity-30"><ChevronLeft size={18} /></button><span className="text-sm font-bold text-on-surface-variant">{page} / {pagination.totalPages}</span><button type="button" disabled={page >= pagination.totalPages} onClick={() => onPage((value) => value + 1)} className="rounded-xl bg-surface-high p-3 text-white disabled:opacity-30"><ChevronRight size={18} /></button></div>}</section>;
}

export function VideoDetail() { return <Navigate to="/videos" replace />; }
export function ChannelProfile() { return <Navigate to="/videos" replace />; }
export function SavedVideosPage(_props: { type?: 'favorites' | 'watchLater' | 'followedChannels' }) { return <Navigate to="/videos" replace />; }
