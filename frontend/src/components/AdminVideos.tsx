import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Eye, EyeOff, Link2, LoaderCircle, PlaySquare, Plus, RefreshCw, RotateCcw, Trash2, X } from 'lucide-react';
import { getApiErrorMessage } from '../services/apiClient';
import { addVideo, getAdminVideos, refreshAdminVideo, restoreAdminVideo, setAdminVideoStatus, softDeleteAdminVideo, type AdminVideo } from '../services/videoService';

type View = 'active' | 'deleted';

export default function AdminVideos() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videos, setVideos] = useState<AdminVideo[]>([]);
  const [view, setView] = useState<View>('active');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<AdminVideo | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const visibleVideos = useMemo(() => videos.filter((video) => view === 'deleted' ? Boolean(video.deletedAt) : !video.deletedAt), [videos, view]);
  const activeCount = videos.filter((video) => !video.deletedAt).length;
  const deletedCount = videos.length - activeCount;

  useEffect(() => { getAdminVideos(true).then(setVideos).catch((reason) => setError(getApiErrorMessage(reason, 'Video listesi yüklenemedi.'))).finally(() => setLoading(false)); }, []);

  function replaceVideo(video: AdminVideo) { setVideos((items) => items.map((item) => item.id === video.id ? video : item)); }

  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (adding) return;
    setAdding(true); setError(''); setNotice('');
    try { const video = await addVideo(youtubeUrl); setVideos((items) => [video, ...items.filter((item) => item.id !== video.id)]); setYoutubeUrl(''); setNotice('Video başarıyla yayınlandı.'); }
    catch (reason) { setError(getApiErrorMessage(reason, 'Video eklenemedi.')); }
    finally { setAdding(false); }
  }

  async function run(id: number, action: () => Promise<AdminVideo>, message: string) {
    setBusyId(id); setError(''); setNotice('');
    try { replaceVideo(await action()); setNotice(message); }
    catch (reason) { setError(getApiErrorMessage(reason, 'Video işlemi tamamlanamadı.')); }
    finally { setBusyId(null); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget; setDeleteTarget(null);
    await run(target.id, () => softDeleteAdminVideo(target.id), 'Video silindi. Silinenler sekmesinden geri alabilirsiniz.');
  }

  return <div className="space-y-6">
    {notice && <div role="status" className="rounded-2xl border border-secondary/30 bg-secondary/10 p-4 text-sm font-bold text-secondary">{notice}</div>}
    {error && <div role="alert" className="rounded-2xl border border-error/30 bg-error/10 p-4 text-sm font-bold text-error">{error}</div>}

    <section className="rounded-[28px] border border-outline/10 bg-surface p-6 md:p-8">
      <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Link2 size={22} /></span><div><h2 className="font-headline text-2xl font-bold text-white">Tekil video ekle</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">YouTube video, Shorts veya youtu.be bağlantısını girin. Başlık, küçük resim ve süre otomatik alınır.</p></div></div>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3 md:flex-row"><label className="sr-only" htmlFor="youtube-url">YouTube video bağlantısı</label><input id="youtube-url" type="url" required value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="min-w-0 flex-1 rounded-2xl border border-outline/10 bg-background/60 px-5 py-3.5 text-sm text-white outline-none placeholder:text-outline focus:border-primary/60 focus:ring-2 focus:ring-primary/15" /><button type="submit" disabled={adding} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-black text-background disabled:opacity-60">{adding ? <LoaderCircle className="animate-spin" size={18} /> : <Plus size={18} />} {adding ? 'Ekleniyor' : 'Videoyu ekle'}</button></form>
    </section>

    <section className="rounded-[28px] border border-outline/10 bg-surface p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-headline text-xl font-bold text-white">Video moderasyonu</h2><p className="mt-1 text-xs text-on-surface-variant">Yayın görünürlüğünü ve YouTube metadata’sını yönetin</p></div><div className="flex gap-2"><button type="button" onClick={() => setView('active')} className={`rounded-full px-4 py-2 text-xs font-black ${view === 'active' ? 'bg-primary text-background' : 'bg-surface-high text-on-surface-variant'}`}>Aktif ({activeCount})</button><button type="button" onClick={() => setView('deleted')} className={`rounded-full px-4 py-2 text-xs font-black ${view === 'deleted' ? 'bg-error text-white' : 'bg-surface-high text-on-surface-variant'}`}>Silinenler ({deletedCount})</button></div></div>
      {loading ? <div className="flex min-h-32 items-center justify-center"><LoaderCircle className="animate-spin text-primary" size={24} /></div> : visibleVideos.length === 0 ? <div className="mt-6 rounded-2xl bg-background/50 p-8 text-center"><PlaySquare className="mx-auto text-on-surface-variant" size={30} /><p className="mt-3 text-sm font-bold text-white">Bu görünümde video bulunmuyor</p></div> : <div className="mt-6 divide-y divide-outline/10">{visibleVideos.map((video) => <article key={video.id} className="flex flex-col gap-4 py-4 first:pt-0 last:pb-0 lg:flex-row lg:items-center"><div className="aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-surface-high sm:w-40">{video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${video.status === 'published' ? 'bg-secondary/10 text-secondary' : 'bg-outline/10 text-on-surface-variant'}`}>{video.status === 'published' ? 'Yayında' : 'Gizli'}</span>{video.contentType === 'short' && <span className="rounded-full bg-error/10 px-2 py-1 text-[10px] font-black uppercase text-error">Shorts</span>}</div><h3 className="mt-2 line-clamp-2 text-sm font-bold text-white">{video.title}</h3><p className="mt-1 text-xs text-on-surface-variant">{video.channelName}{video.duration ? ` · ${video.duration}` : ''}</p></div><div className="flex flex-wrap items-center gap-2">{view === 'deleted' ? <button type="button" disabled={busyId === video.id} onClick={() => void run(video.id, () => restoreAdminVideo(video.id), 'Video geri alındı.')} className="inline-flex items-center gap-2 rounded-xl bg-secondary/10 px-3 py-2 text-xs font-black text-secondary"><RotateCcw size={15} /> Geri Al</button> : <><button type="button" disabled={busyId === video.id} onClick={() => void run(video.id, () => setAdminVideoStatus(video.id, video.status === 'published' ? 'hidden' : 'published'), video.status === 'published' ? 'Video gizlendi.' : 'Video yayınlandı.')} className="inline-flex items-center gap-2 rounded-xl bg-surface-high px-3 py-2 text-xs font-black text-on-surface-variant">{video.status === 'published' ? <EyeOff size={15} /> : <Eye size={15} />}{video.status === 'published' ? 'Gizle' : 'Yayınla'}</button><button type="button" disabled={busyId === video.id} onClick={() => void run(video.id, () => refreshAdminVideo(video.id), 'Video bilgileri YouTube’dan yenilendi.')} className="rounded-xl bg-primary/10 p-2.5 text-primary" aria-label="Metadata yenile"><RefreshCw size={16} className={busyId === video.id ? 'animate-spin' : ''} /></button><button type="button" disabled={busyId === video.id} onClick={() => setDeleteTarget(video)} className="rounded-xl bg-error/10 p-2.5 text-error" aria-label="Videoyu sil"><Trash2 size={16} /></button></>}<a href={`https://youtu.be/${video.youtubeVideoId}`} target="_blank" rel="noreferrer" aria-label="YouTube’da aç" className="rounded-xl bg-surface-high p-2.5 text-on-surface-variant hover:text-primary"><ExternalLink size={16} /></a></div></article>)}</div>}
    </section>

    {deleteTarget && <div className="fixed inset-0 z-[180] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-video-title"><button type="button" className="absolute inset-0 bg-black/80 backdrop-blur-sm" aria-label="İptal" onClick={() => setDeleteTarget(null)} /><div className="relative w-full max-w-md rounded-[24px] border border-outline/15 bg-surface p-6 shadow-2xl"><button type="button" onClick={() => setDeleteTarget(null)} className="absolute right-4 top-4 text-on-surface-variant" aria-label="Kapat"><X size={20} /></button><h3 id="delete-video-title" className="pr-8 font-headline text-xl font-bold text-white">Videoyu silmek istediğinize emin misiniz?</h3><p className="mt-3 text-sm leading-6 text-on-surface-variant">“{deleteTarget.title}” herkese açık sayfadan kaldırılacak. Daha sonra Silinenler sekmesinden geri alabilirsiniz.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl bg-surface-high px-4 py-2.5 text-sm font-bold text-white">Vazgeç</button><button type="button" onClick={() => void confirmDelete()} className="rounded-xl bg-error px-4 py-2.5 text-sm font-black text-white">Videoyu Sil</button></div></div></div>}
  </div>;
}
