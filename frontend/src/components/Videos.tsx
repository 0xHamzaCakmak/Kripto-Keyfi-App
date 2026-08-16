import { useEffect, useState } from 'react';
import { Clapperboard, LayoutGrid, LoaderCircle, Play, Search, Smartphone, VideoOff, X } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { getApiErrorMessage } from '../services/apiClient';
import { getVideos, type PublicVideo, type VideoCounts } from '../services/videoService';

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
        <button type="button" autoFocus onClick={onClose} aria-label="Kapat" className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/75 text-white backdrop-blur transition hover:bg-error focus:outline-none focus:ring-2 focus:ring-primary">
          <X size={22} />
        </button>
        <div className={video.contentType === 'short' ? 'mx-auto aspect-[9/16] max-h-[88vh] w-full' : 'aspect-video w-full'}>
          <iframe className="h-full w-full" src={`https://www.youtube.com/embed/${video.youtubeVideoId}?autoplay=1`} title={video.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
        </div>
      </div>
    </div>
  );
}

function VideoCard({ video, onPlay }: { video: PublicVideo; onPlay: () => void }) {
  return (
    <button type="button" onClick={onPlay} className="group overflow-hidden rounded-[24px] border border-outline/10 bg-surface text-left transition hover:-translate-y-1 hover:border-primary/30 hover:bg-surface-high focus:outline-none focus:ring-2 focus:ring-primary">
      <div className="relative aspect-video overflow-hidden bg-surface-highest">
        {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><VideoOff className="text-on-surface-variant" size={36} /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
        <span className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary text-background shadow-xl transition group-hover:scale-110"><Play size={21} fill="currentColor" /></span>
        {video.duration && <span className="absolute bottom-3 right-3 rounded-lg bg-black/80 px-2 py-1 text-xs font-bold text-white">{video.duration}</span>}
        {video.contentType === 'short' && <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-error px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white"><Smartphone size={12} /> Shorts</span>}
      </div>
      <div className="p-5">
        {video.source !== 'admin_manual' && <span className={`mb-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${video.source === 'kriptokeyfi_auto' ? 'bg-primary/15 text-primary' : 'bg-secondary/10 text-secondary'}`}>{video.source === 'kriptokeyfi_auto' ? 'Resmî Kanal' : 'Creator'}</span>}
        <h2 className="line-clamp-2 font-headline text-lg font-bold leading-snug text-white group-hover:text-primary">{video.title}</h2>
        <div className="mt-3 flex items-center gap-2">{video.channelAvatarUrl && <img src={video.channelAvatarUrl} alt="" className="h-7 w-7 rounded-lg object-cover" />}<p className="text-sm font-bold text-on-surface">{video.channelName}</p></div>
        {video.publishedAt && <p className="mt-1 text-xs text-on-surface-variant">{formatPublishedAt(video.publishedAt)}</p>}
      </div>
    </button>
  );
}

export default function VideoCenter() {
  const [videos, setVideos] = useState<PublicVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<PublicVideo | null>(null);
  const [filter, setFilter] = useState<VideoFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [counts, setCounts] = useState<VideoCounts>({ all: 0, long: 0, short: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    getVideos({ contentType: filter, creator: debouncedSearch }).then((result) => { if (active) { setVideos(result.videos); setCounts(result.counts); } }).catch((reason) => { if (active) setError(getApiErrorMessage(reason, 'Videolar şu anda yüklenemiyor.')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [debouncedSearch, filter]);

  return (
    <div className="space-y-8">
      <section className="kk-gold-panel rounded-[32px] p-7 md:p-10">
        <p className="text-xs font-black uppercase tracking-[.24em] text-primary">Seçili yayınlar</p>
        <h1 className="mt-3 font-headline text-4xl font-extrabold tracking-tight text-white md:text-5xl">KriptoKeyfi Video Merkezi</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-on-surface-variant">Kripto ve Web3 dünyasından özenle seçilen YouTube yayınlarını tek yerde izleyin.</p>
      </section>

      <section className="rounded-[24px] border border-outline/10 bg-surface p-4 md:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1 xl:pb-0">
            {filterOptions.map((option) => {
              const Icon = option.icon;
              return <button key={option.value} type="button" onClick={() => setFilter(option.value)} aria-pressed={filter === option.value} className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${filter === option.value ? 'bg-primary text-background shadow-lg shadow-primary/10' : 'bg-surface-high text-on-surface-variant hover:text-white'}`}><Icon size={17} /><span>{option.label}</span><span className={`rounded-full px-2 py-0.5 text-[10px] ${filter === option.value ? 'bg-background/15' : 'bg-background/50'}`}>{counts[option.value]}</span></button>;
            })}
          </div>
          <label className="relative block w-full xl:max-w-sm">
            <span className="sr-only">YouTuber ara</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="YouTuber veya kanal ara..." className="w-full rounded-2xl border border-outline/10 bg-background/55 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-on-surface-variant focus:border-primary" />
          </label>
        </div>
      </section>

      {loading ? (
        <div className="flex min-h-56 items-center justify-center rounded-[24px] border border-outline/10 bg-surface"><LoaderCircle className="animate-spin text-primary" size={30} /><span className="ml-3 text-sm font-bold text-on-surface-variant">Videolar yükleniyor</span></div>
      ) : error ? (
        <div role="alert" className="rounded-[24px] border border-error/25 bg-error/10 p-8 text-center text-sm font-bold text-error">{error}</div>
      ) : videos.length === 0 ? (
        <div className="rounded-[24px] border border-outline/10 bg-surface p-10 text-center"><VideoOff className="mx-auto text-primary" size={38} /><h2 className="mt-4 font-headline text-2xl font-bold text-white">Video bulunamadı</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-on-surface-variant">Seçili filtreye veya YouTuber aramanıza uygun yayın bulunmuyor.</p></div>
      ) : (
        <section><div className="mb-5 flex items-end justify-between gap-4"><h2 className="font-headline text-2xl font-extrabold text-white">{filterOptions.find((option) => option.value === filter)?.label}</h2><p className="text-sm text-on-surface-variant">{videos.length} video</p></div><div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">{videos.map((video) => <VideoCard key={video.id} video={video} onPlay={() => setSelectedVideo(video)} />)}</div></section>
      )}

      {selectedVideo && <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} />}
    </div>
  );
}

export function VideoDetail() { return <Navigate to="/videos" replace />; }
export function ChannelProfile() { return <Navigate to="/videos" replace />; }
export function SavedVideosPage(_props: { type?: 'favorites' | 'watchLater' | 'followedChannels' }) { return <Navigate to="/videos" replace />; }
