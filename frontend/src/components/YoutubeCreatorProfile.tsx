import { useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Link2, LoaderCircle, Send, Youtube } from 'lucide-react';
import { getApiErrorMessage } from '../services/apiClient';
import { addMyCreatorVideo, applyForYoutubeCreator, connectMyYoutubeChannel, getMyCreatorState, type MyCreatorState } from '../services/videoService';
import { trackUmamiEvent } from '../services/platformAnalytics';

const statusText = {
  not_applied: 'Başvuru yapılmadı', pending: 'Admin incelemesinde', approved: 'Onaylı Creator', rejected: 'Başvuru reddedildi', suspended: 'Creator hesabı askıda',
} as const;

export default function YoutubeCreatorProfile() {
  const [state, setState] = useState<MyCreatorState | null>(null);
  const [channelUrl, setChannelUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [busy, setBusy] = useState<'channel' | 'apply' | 'video' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    getMyCreatorState().then(setState).catch((reason) => setError(getApiErrorMessage(reason, 'YouTube Creator bilgileri yüklenemedi.')));
  }, []);

  async function connect(event: React.FormEvent) {
    event.preventDefault(); setBusy('channel'); setError(''); setNotice('');
    try {
      const channel = await connectMyYoutubeChannel(channelUrl);
      trackUmamiEvent('youtube_connect', { channel_id: channel.id });
      setState((current) => ({ channel, application: current?.application ?? { status: 'not_applied', appliedAt: null, approvedAt: null, rejectedAt: null } }));
      setChannelUrl(''); setNotice('YouTube kanalınız bağlandı. Şimdi YouTuber başvurunuzu gönderebilirsiniz.');
    } catch (reason) { setError(getApiErrorMessage(reason, 'YouTube kanalı bağlanamadı.')); }
    finally { setBusy(null); }
  }

  async function apply() {
    setBusy('apply'); setError(''); setNotice('');
    try { const application = await applyForYoutubeCreator(); trackUmamiEvent('creator_application'); setState((current) => current ? { ...current, application } : current); setNotice('YouTuber başvurunuz yönetim ekibine gönderildi.'); }
    catch (reason) { setError(getApiErrorMessage(reason, 'Başvuru gönderilemedi.')); }
    finally { setBusy(null); }
  }

  async function addVideo(event: React.FormEvent) {
    event.preventDefault(); setBusy('video'); setError(''); setNotice('');
    try { await addMyCreatorVideo(videoUrl); setVideoUrl(''); setNotice('Videonuz Video Merkezi’nde yayınlandı.'); }
    catch (reason) { setError(getApiErrorMessage(reason, 'Video paylaşılamadı.')); }
    finally { setBusy(null); }
  }

  return (
    <section className="rounded-[32px] border border-outline/5 bg-surface p-6 md:p-8">
      <div className="flex items-start gap-4"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-error/10 text-error"><Youtube size={24} /></span><div><h2 className="font-headline text-2xl font-bold text-white">YouTube Creator hesabı</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">Kanalınızı profilinize ekleyin ve YouTuber olmak için başvurun. Onaydan sonra yeni videolarınız otomatik olarak Video Merkezi’ne gelir.</p></div></div>
      {error && <div role="alert" className="mt-5 rounded-2xl border border-error/25 bg-error/10 p-4 text-sm font-bold text-error">{error}</div>}
      {notice && <div role="status" className="mt-5 rounded-2xl border border-secondary/25 bg-secondary/10 p-4 text-sm font-bold text-secondary">{notice}</div>}

      {!state ? <div className="flex min-h-28 items-center justify-center"><LoaderCircle className="animate-spin text-primary" size={26} /></div> : <div className="mt-6 space-y-5">
        {state.channel ? <div className="flex flex-col gap-4 rounded-2xl bg-background/45 p-4 sm:flex-row sm:items-center"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-surface-high">{state.channel.avatarUrl ? <img src={state.channel.avatarUrl} alt="" className="h-full w-full object-cover" /> : <Youtube className="text-error" />}</div><div className="min-w-0 flex-1"><p className="font-bold text-white">{state.channel.channelName}</p><p className="mt-1 text-xs text-on-surface-variant">{state.channel.videoCount} video · {statusText[state.application.status]}</p></div>{state.channel.channelUrl && <a href={state.channel.channelUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-surface-high px-3 py-2 text-xs font-bold text-primary"><ExternalLink size={14} /> Kanalı aç</a>}</div> : <form onSubmit={connect} className="space-y-3"><label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant" htmlFor="my-youtube-channel">YouTube kanal bağlantısı veya @handle</label><div className="flex flex-col gap-3 sm:flex-row"><input id="my-youtube-channel" required value={channelUrl} onChange={(event) => setChannelUrl(event.target.value)} placeholder="https://youtube.com/@kanalim" className="min-w-0 flex-1 rounded-2xl border border-outline/10 bg-surface-high px-4 py-3 text-sm text-white outline-none focus:border-primary"/><button disabled={busy !== null} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-background disabled:opacity-60">{busy === 'channel' ? <LoaderCircle className="animate-spin" size={17}/> : <Link2 size={17}/>} Kanalımı bağla</button></div><p className="text-xs text-on-surface-variant">Kanal, admin onayına kadar otomatik senkronizasyona başlamaz.</p></form>}

        {state.channel && ['not_applied', 'rejected'].includes(state.application.status) && <button type="button" onClick={() => void apply()} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-background disabled:opacity-60">{busy === 'apply' ? <LoaderCircle className="animate-spin" size={17}/> : <Send size={17}/>} YouTuber olarak başvur</button>}
        {state.application.status === 'pending' && <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4 text-sm font-bold text-primary">Başvurunuz inceleniyor. Onaylanana kadar kanal senkronizasyonu kapalıdır.</div>}
        {state.application.status === 'suspended' && <div className="rounded-2xl border border-error/20 bg-error/10 p-4 text-sm font-bold text-error">Creator hesabınız askıya alındı. Mevcut videolar korunur, yeni video senkronizasyonu durdurulur.</div>}
        {state.application.status === 'approved' && <form onSubmit={addVideo} className="rounded-2xl border border-secondary/15 bg-secondary/5 p-5"><div className="flex items-center gap-2 text-secondary"><CheckCircle2 size={18}/><p className="text-sm font-black">Creator hesabınız onaylandı</p></div><p className="mt-2 text-xs leading-5 text-on-surface-variant">Yeni videolar otomatik gelir. Daha eski bir videonuzu hemen paylaşmak isterseniz bağlantısını ekleyin.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><input type="url" required value={videoUrl} onChange={(event) => setVideoUrl(event.target.value)} placeholder="https://youtu.be/..." className="min-w-0 flex-1 rounded-xl border border-outline/10 bg-background/60 px-4 py-3 text-sm text-white outline-none focus:border-secondary"/><button disabled={busy !== null} className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-5 py-3 text-sm font-black text-background disabled:opacity-60">{busy === 'video' ? <LoaderCircle className="animate-spin" size={17}/> : <Send size={17}/>} Videoyu paylaş</button></div></form>}
      </div>}
    </section>
  );
}
