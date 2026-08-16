import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Clapperboard, Heart, LayoutGrid, LoaderCircle, Play, Search, Smartphone, Star, VideoOff, X } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getApiErrorMessage } from '../services/apiClient';
import { getFavoriteChannelIds, getPublicYoutubeChannels, getVideos, toggleFavoriteChannel, type PublicVideo, type PublicYoutubeChannel, type VideoCounts, type VideoPagination } from '../services/videoService';

type VideoFilter = 'all' | 'long' | 'short';

const filterOptions: Array<{ value: VideoFilter; label: string; icon: typeof LayoutGrid }> = [
  { value: 'all', label: 'Tüm Videolar', icon: LayoutGrid },
  { value: 'long', label: 'Uzun Videolar', icon: Clapperboard },
  { value: 'short', label: 'Shorts', icon: Smartphone },
];

function formatPublishedAt(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
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
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', closeOnEscape); };
  }, [onClose]);

  return <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={`${video.title} videosu`}>
    <button type="button" className="absolute inset-0 bg-black/85 backdrop-blur-sm" aria-label="Video oynatıcısını kapat" onClick={onClose} />
    <div className={`relative z-10 w-full overflow-hidden rounded-[24px] border border-outline/15 bg-black shadow-2xl ${video.contentType === 'short' ? 'max-w-sm' : 'max-w-5xl'}`}>
      <button type="button" autoFocus onClick={onClose} aria-label="Kapat" className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur transition hover:bg-error focus:outline-none focus:ring-2 focus:ring-primary"><X size={22} /></button>
      <div className={video.contentType === 'short' ? 'mx-auto aspect-[9/16] max-h-[88vh] w-full' : 'aspect-video w-full'}><iframe className="h-full w-full" src={`https://www.youtube.com/embed/${video.youtubeVideoId}?autoplay=1`} title={video.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>
    </div>
  </div>;
}

function VideoCard({ video, favorited, favoriteBusy, onPlay, onFavorite }: { video: PublicVideo; favorited: boolean; favoriteBusy: boolean; onPlay: () => void; onFavorite: () => void }) {
  return <article className="group overflow-hidden rounded-[24px] border border-outline/10 bg-surface transition hover:-translate-y-1 hover:border-primary/30 hover:bg-surface-high">
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
    <div className="flex items-center gap-3 px-5 pb-5 pt-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-highest ring-1 ring-outline/10"><ChannelAvatar name={video.channelName} url={video.channelAvatarUrl} /></div>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-on-surface">{video.channelName}</p>{video.publishedAt && <p className="mt-0.5 text-xs text-on-surface-variant">{formatPublishedAt(video.publishedAt)}</p>}</div>
      {video.channelId && <button type="button" disabled={favoriteBusy} onClick={onFavorite} aria-label={favorited ? `${video.channelName} kanalını favorilerden çıkar` : `${video.channelName} kanalını favorilere ekle`} aria-pressed={favorited} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition disabled:opacity-50 ${favorited ? 'bg-error/15 text-error' : 'bg-surface-high text-on-surface-variant hover:text-error'}`}><Heart size={18} fill={favorited ? 'currentColor' : 'none'} /></button>}
    </div>
  </article>;
}

export default function VideoCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<PublicVideo[]>([]);
  const [channels, setChannels] = useState<PublicYoutubeChannel[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [favoriteBusyId, setFavoriteBusyId] = useState<number | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<PublicVideo | null>(null);
  const [filter, setFilter] = useState<VideoFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [channelId, setChannelId] = useState<number | undefined>();
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState<VideoCounts>({ all: 0, long: 0, short: 0 });
  const [pagination, setPagination] = useState<VideoPagination>({ page: 1, limit: 24, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { getPublicYoutubeChannels().then(setChannels).catch(() => undefined); }, []);
  useEffect(() => {
    if (!user) { setFavoriteIds(new Set()); setFavoritesOnly(false); return; }
    getFavoriteChannelIds().then((ids) => setFavoriteIds(new Set(ids))).catch(() => undefined);
  }, [user]);
  useEffect(() => { const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 400); return () => window.clearTimeout(timer); }, [search]);
  useEffect(() => { setPage(1); }, [debouncedSearch, filter, channelId, favoritesOnly]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    getVideos({ contentType: filter, search: debouncedSearch, channelId, favoritesOnly, page, limit: 24 })
      .then((result) => { if (active) { setVideos(result.videos); setCounts(result.counts); setPagination(result.pagination); } })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason, 'Videolar şu anda yüklenemiyor.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [channelId, debouncedSearch, favoritesOnly, filter, page]);

  async function favorite(video: PublicVideo) {
    if (!user) { navigate('/login', { state: { from: '/videos' } }); return; }
    if (!video.channelId || favoriteBusyId) return;
    setFavoriteBusyId(video.channelId);
    try {
      const favorited = await toggleFavoriteChannel(video.channelId);
      setFavoriteIds((current) => { const next = new Set(current); if (favorited) next.add(video.channelId!); else next.delete(video.channelId!); return next; });
      if (!favorited && favoritesOnly) setVideos((current) => current.filter((item) => item.channelId !== video.channelId));
    } catch (reason) { setError(getApiErrorMessage(reason, 'Favori kanal güncellenemedi.')); }
    finally { setFavoriteBusyId(null); }
  }

  return <div className="space-y-8">
    <section className="kk-gold-panel rounded-[32px] p-7 md:p-10"><p className="text-xs font-black uppercase tracking-[.24em] text-primary">Seçili yayınlar</p><h1 className="mt-3 font-headline text-4xl font-extrabold tracking-tight text-white md:text-5xl">KriptoKeyfi Video Merkezi</h1><p className="mt-4 max-w-2xl text-base leading-7 text-on-surface-variant">Kripto ve Web3 dünyasından özenle seçilen YouTube yayınlarını tek yerde izleyin.</p></section>

    <section className="rounded-[24px] border border-outline/10 bg-surface p-4 md:p-5">
      <label className="relative block w-full"><span className="sr-only">Video veya YouTuber ara</span><Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Video veya YouTuber ara..." className="w-full rounded-2xl border border-outline/10 bg-background/55 py-3.5 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-on-surface-variant focus:border-primary" /></label>
      <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">{filterOptions.map((option) => { const Icon = option.icon; return <button key={option.value} type="button" onClick={() => setFilter(option.value)} aria-pressed={filter === option.value} className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${filter === option.value ? 'bg-primary text-background shadow-lg shadow-primary/10' : 'bg-surface-high text-on-surface-variant hover:text-white'}`}><Icon size={17} /><span>{option.label}</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${filter === option.value ? 'bg-background/15' : 'bg-background/50'}`}>{counts[option.value]}</span></button>; })}</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={channelId ?? ''} onChange={(event) => setChannelId(event.target.value ? Number(event.target.value) : undefined)} aria-label="YouTuber seç" className="rounded-2xl border border-outline/10 bg-surface-high px-4 py-3 text-sm font-bold text-white outline-none focus:border-primary"><option value="">Tüm YouTuberlar</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.channelName} ({channel.videoCount})</option>)}</select>
          {user && <button type="button" onClick={() => setFavoritesOnly((value) => !value)} aria-pressed={favoritesOnly} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${favoritesOnly ? 'bg-error text-white' : 'bg-surface-high text-on-surface-variant hover:text-white'}`}><Star size={17} fill={favoritesOnly ? 'currentColor' : 'none'} /> Favorilerim</button>}
        </div>
      </div>
    </section>

    {loading ? <div className="flex min-h-56 items-center justify-center rounded-[24px] border border-outline/10 bg-surface"><LoaderCircle className="animate-spin text-primary" size={30} /><span className="ml-3 text-sm font-bold text-on-surface-variant">Videolar yükleniyor</span></div>
      : error ? <div role="alert" className="rounded-[24px] border border-error/25 bg-error/10 p-8 text-center text-sm font-bold text-error">{error}</div>
      : videos.length === 0 ? <div className="rounded-[24px] border border-outline/10 bg-surface p-10 text-center"><VideoOff className="mx-auto text-primary" size={38} /><h2 className="mt-4 font-headline text-2xl font-bold text-white">Video bulunamadı</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-on-surface-variant">Seçili filtrelere uygun yayın bulunmuyor.</p></div>
      : <section><div className="mb-5 flex items-end justify-between gap-4"><h2 className="font-headline text-2xl font-extrabold text-white">{favoritesOnly ? 'Favori Kanallarım' : filterOptions.find((option) => option.value === filter)?.label}</h2><p className="text-sm text-on-surface-variant">{pagination.total} video</p></div><div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">{videos.map((video) => <VideoCard key={video.id} video={video} favorited={Boolean(video.channelId && favoriteIds.has(video.channelId))} favoriteBusy={favoriteBusyId === video.channelId} onPlay={() => setSelectedVideo(video)} onFavorite={() => void favorite(video)} />)}</div>{pagination.totalPages > 1 && <div className="mt-8 flex items-center justify-center gap-3"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-xl bg-surface-high p-3 text-white disabled:opacity-30"><ChevronLeft size={18} /></button><span className="text-sm font-bold text-on-surface-variant">{page} / {pagination.totalPages}</span><button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)} className="rounded-xl bg-surface-high p-3 text-white disabled:opacity-30"><ChevronRight size={18} /></button></div>}</section>}
    {selectedVideo && <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />}
  </div>;
}

export function VideoDetail() { return <Navigate to="/videos" replace />; }
export function ChannelProfile() { return <Navigate to="/videos" replace />; }
export function SavedVideosPage(_props: { type?: 'favorites' | 'watchLater' | 'followedChannels' }) { return <Navigate to="/videos" replace />; }
