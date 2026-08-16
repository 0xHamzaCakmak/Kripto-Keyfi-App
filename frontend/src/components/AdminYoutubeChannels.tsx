import { useEffect, useState } from 'react';
import { ExternalLink, LoaderCircle, Pause, Play, Plus, RadioTower, UsersRound } from 'lucide-react';
import { getApiErrorMessage } from '../services/apiClient';
import { addYoutubeChannel, getYoutubeChannels, setYoutubeChannelStatus, type YoutubeChannel } from '../services/videoService';

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Henüz senkronize edilmedi';
}

export default function AdminYoutubeChannels() {
  const [channels, setChannels] = useState<YoutubeChannel[]>([]);
  const [channelUrl, setChannelUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    getYoutubeChannels().then(setChannels).catch((reason) => setError(getApiErrorMessage(reason, 'Kanal listesi yüklenemedi.'))).finally(() => setLoading(false));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await addYoutubeChannel(channelUrl);
      setChannels((items) => [result.channel, ...items]);
      setChannelUrl('');
      setNotice(`${result.channel.channelName ?? 'Kanal'} eklendi; ${result.sync.created} video yayınlandı.`);
    } catch (reason) { setError(getApiErrorMessage(reason, 'YouTube kanalı eklenemedi.')); }
    finally { setBusy(false); }
  }

  async function toggle(channel: YoutubeChannel) {
    if (updatingId) return;
    setUpdatingId(channel.id); setError(''); setNotice('');
    try {
      const updated = await setYoutubeChannelStatus(channel.id, channel.status === 'active' ? 'paused' : 'active');
      setChannels((items) => items.map((item) => item.id === updated.id ? updated : item));
      setNotice(updated.status === 'active' ? 'Kanal senkronizasyonu yeniden etkinleştirildi.' : 'Kanal senkronizasyonu duraklatıldı; mevcut videolar korunuyor.');
    } catch (reason) { setError(getApiErrorMessage(reason, 'Kanal durumu güncellenemedi.')); }
    finally { setUpdatingId(null); }
  }

  return (
    <div className="space-y-6">
      {notice && <div role="status" className="rounded-2xl border border-secondary/30 bg-secondary/10 p-4 text-sm font-bold text-secondary">{notice}</div>}
      {error && <div role="alert" className="rounded-2xl border border-error/30 bg-error/10 p-4 text-sm font-bold text-error">{error}</div>}
      <section className="rounded-[28px] border border-outline/10 bg-surface p-6 md:p-8">
        <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UsersRound size={22} /></span><div><h2 className="font-headline text-2xl font-bold text-white">YouTuber ekle</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">Kanal ID, @kullanıcı adı veya YouTube kanal bağlantısı girin. Son videolar hemen alınır; yenileri otomatik takip edilir.</p></div></div>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3 md:flex-row">
          <label className="sr-only" htmlFor="youtube-channel-url">YouTube kanal bağlantısı</label>
          <input id="youtube-channel-url" required value={channelUrl} onChange={(event) => setChannelUrl(event.target.value)} placeholder="https://www.youtube.com/@kanal" className="min-w-0 flex-1 rounded-2xl border border-outline/10 bg-background/60 px-5 py-3.5 text-sm text-white outline-none placeholder:text-outline focus:border-primary/60 focus:ring-2 focus:ring-primary/15" />
          <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-black text-background disabled:cursor-wait disabled:opacity-60">{busy ? <LoaderCircle className="animate-spin" size={18} /> : <Plus size={18} />}{busy ? 'Kanal taranıyor' : 'Kanalı ekle'}</button>
        </form>
      </section>

      <section className="rounded-[28px] border border-outline/10 bg-surface p-6 md:p-8">
        <div className="flex items-center justify-between"><div><h2 className="font-headline text-xl font-bold text-white">Takip edilen kanallar</h2><p className="mt-1 text-xs text-on-surface-variant">Aktif kanallar periyodik olarak kontrol edilir</p></div><span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-black text-primary">{channels.length}</span></div>
        {loading ? <div className="flex min-h-36 items-center justify-center"><LoaderCircle className="animate-spin text-primary" size={26} /></div> : channels.length === 0 ? <div className="mt-6 rounded-2xl bg-background/50 p-9 text-center"><RadioTower className="mx-auto text-on-surface-variant" size={34} /><p className="mt-3 text-sm font-bold text-white">Henüz takip edilen kanal yok</p></div> : <div className="mt-6 grid gap-4 xl:grid-cols-2">{channels.map((channel) => <article key={channel.id} className="rounded-2xl border border-outline/10 bg-background/40 p-4"><div className="flex items-center gap-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-high text-primary">{channel.avatarUrl ? <img src={channel.avatarUrl} alt="" className="h-full w-full object-cover" /> : <UsersRound size={24} />}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate font-bold text-white">{channel.channelName ?? 'YouTube Kanalı'}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${channel.status === 'active' ? 'bg-secondary/10 text-secondary' : 'bg-outline/10 text-on-surface-variant'}`}>{channel.status === 'active' ? 'Aktif' : 'Duraklatıldı'}</span></div><p className="mt-1 text-xs text-on-surface-variant">{channel.videoCount} video · {formatDate(channel.lastSyncedAt)}</p></div>{channel.channelUrl && <a href={channel.channelUrl} target="_blank" rel="noreferrer" aria-label="Kanalı YouTube’da aç" className="rounded-xl p-2 text-on-surface-variant hover:bg-surface-high hover:text-primary"><ExternalLink size={17} /></a>}</div><button type="button" disabled={updatingId === channel.id} onClick={() => void toggle(channel)} className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black ${channel.status === 'active' ? 'bg-surface-high text-on-surface hover:text-error' : 'bg-secondary/10 text-secondary hover:bg-secondary/20'}`}>{updatingId === channel.id ? <LoaderCircle className="animate-spin" size={15} /> : channel.status === 'active' ? <Pause size={15} /> : <Play size={15} />}{channel.status === 'active' ? 'Senkronizasyonu duraklat' : 'Yeniden aktif et'}</button></article>)}</div>}
      </section>
    </div>
  );
}
