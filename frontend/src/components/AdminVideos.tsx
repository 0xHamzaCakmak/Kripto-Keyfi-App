import { useEffect, useState } from 'react';
import { ExternalLink, Link2, LoaderCircle, PlaySquare, Plus } from 'lucide-react';
import { getApiErrorMessage } from '../services/apiClient';
import { addVideo, getVideos, type PublicVideo } from '../services/videoService';

export default function AdminVideos() {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videos, setVideos] = useState<PublicVideo[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    getVideos().then((result) => setVideos(result.videos)).catch((reason) => setError(getApiErrorMessage(reason, 'Video listesi yüklenemedi.'))).finally(() => setLoading(false));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const video = await addVideo(youtubeUrl);
      setVideos((items) => [video, ...items.filter((item) => item.id !== video.id)]);
      setYoutubeUrl('');
      setNotice('Video başarıyla yayınlandı.');
    } catch (reason) {
      setError(getApiErrorMessage(reason, 'Video eklenemedi.'));
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      {notice && <div role="status" className="rounded-2xl border border-secondary/30 bg-secondary/10 p-4 text-sm font-bold text-secondary">{notice}</div>}
      {error && <div role="alert" className="rounded-2xl border border-error/30 bg-error/10 p-4 text-sm font-bold text-error">{error}</div>}

      <section className="rounded-[28px] border border-outline/10 bg-surface p-6 md:p-8">
        <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Link2 size={22} /></span><div><h2 className="font-headline text-2xl font-bold text-white">Tekil video ekle</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">YouTube video, Shorts veya youtu.be bağlantısını girin. Başlık, küçük resim ve süre otomatik alınır.</p></div></div>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3 md:flex-row">
          <label className="sr-only" htmlFor="youtube-url">YouTube video bağlantısı</label>
          <input id="youtube-url" type="url" required value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="min-w-0 flex-1 rounded-2xl border border-outline/10 bg-background/60 px-5 py-3.5 text-sm text-white outline-none placeholder:text-outline focus:border-primary/60 focus:ring-2 focus:ring-primary/15" />
          <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-black text-background transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60">{busy ? <LoaderCircle className="animate-spin" size={18} /> : <Plus size={18} />} {busy ? 'Ekleniyor' : 'Videoyu ekle'}</button>
        </form>
      </section>

      <section className="rounded-[28px] border border-outline/10 bg-surface p-6 md:p-8">
        <div className="flex items-center justify-between"><div><h2 className="font-headline text-xl font-bold text-white">Yayınlanan videolar</h2><p className="mt-1 text-xs text-on-surface-variant">Video Merkezi’nde görünen içerikler</p></div><span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">{videos.length}</span></div>
        {loading ? <div className="flex min-h-32 items-center justify-center"><LoaderCircle className="animate-spin text-primary" size={24} /></div> : videos.length === 0 ? <div className="mt-6 rounded-2xl bg-background/50 p-8 text-center"><PlaySquare className="mx-auto text-on-surface-variant" size={30} /><p className="mt-3 text-sm font-bold text-white">Henüz video eklenmedi</p></div> : <div className="mt-6 divide-y divide-outline/10">{videos.map((video) => <article key={video.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0"><div className="aspect-video w-28 shrink-0 overflow-hidden rounded-xl bg-surface-high">{video.thumbnailUrl && <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />}</div><div className="min-w-0 flex-1"><h3 className="line-clamp-2 text-sm font-bold text-white">{video.title}</h3><p className="mt-1 text-xs text-on-surface-variant">{video.channelName}{video.duration ? ` · ${video.duration}` : ''}</p></div><a href={`https://youtu.be/${video.youtubeVideoId}`} target="_blank" rel="noreferrer" aria-label="YouTube’da aç" className="rounded-xl p-2.5 text-on-surface-variant hover:bg-surface-high hover:text-primary"><ExternalLink size={18} /></a></article>)}</div>}
      </section>
    </div>
  );
}
