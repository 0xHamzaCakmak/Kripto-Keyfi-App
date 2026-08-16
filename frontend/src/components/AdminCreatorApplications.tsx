import { useEffect, useMemo, useState } from 'react';
import { Ban, Check, ExternalLink, LoaderCircle, UserRoundCheck, X } from 'lucide-react';
import { getApiErrorMessage } from '../services/apiClient';
import { getCreatorApplications, reviewCreatorApplication, type AdminCreatorApplication, type CreatorApplicationState } from '../services/videoService';

const filters: Array<{ value: 'all' | CreatorApplicationState['status']; label: string }> = [
  { value: 'all', label: 'Tümü' }, { value: 'pending', label: 'Bekleyen' }, { value: 'approved', label: 'Onaylanan' }, { value: 'rejected', label: 'Reddedilen' }, { value: 'suspended', label: 'Askıdaki' },
];
const statusLabels: Record<CreatorApplicationState['status'], string> = {
  not_applied: 'Başvurmadı', pending: 'Bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi', suspended: 'Askıda',
};

export default function AdminCreatorApplications() {
  const [items, setItems] = useState<AdminCreatorApplication[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('pending');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { getCreatorApplications().then(setItems).catch((reason) => setError(getApiErrorMessage(reason, 'Creator başvuruları yüklenemedi.'))).finally(() => setLoading(false)); }, []);
  const visible = useMemo(() => filter === 'all' ? items : items.filter((item) => item.application.status === filter), [filter, items]);

  async function review(item: AdminCreatorApplication, status: 'approved' | 'rejected' | 'suspended') {
    setBusyId(item.user.id); setError(''); setNotice('');
    try {
      const result = await reviewCreatorApplication(item.user.id, status);
      setItems((current) => current.map((entry) => entry.user.id === item.user.id ? { ...entry, application: result.application, channel: entry.channel ? { ...entry.channel, status: status === 'approved' ? 'active' : 'paused' } : null } : entry));
      setNotice(status === 'approved' ? 'Creator onaylandı; bundan sonraki yeni videolar otomatik olarak aktarılacak.' : status === 'rejected' ? 'Creator başvurusu reddedildi.' : 'Creator askıya alındı; yeni video senkronizasyonu durduruldu.');
    } catch (reason) { setError(getApiErrorMessage(reason, 'Başvuru durumu güncellenemedi.')); }
    finally { setBusyId(null); }
  }

  return <div className="space-y-6">
    {notice && <div role="status" className="rounded-2xl border border-secondary/25 bg-secondary/10 p-4 text-sm font-bold text-secondary">{notice}</div>}
    {error && <div role="alert" className="rounded-2xl border border-error/25 bg-error/10 p-4 text-sm font-bold text-error">{error}</div>}
    <section className="rounded-[28px] border border-outline/10 bg-surface p-6 md:p-8"><div className="flex items-start gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UserRoundCheck size={23}/></span><div><h2 className="font-headline text-2xl font-bold text-white">Creator başvuruları</h2><p className="mt-2 text-sm text-on-surface-variant">Bağlanan YouTube kanallarını inceleyin ve otomatik yayın yetkisini yönetin.</p></div></div><div className="mt-6 flex gap-2 overflow-x-auto">{filters.map((option) => <button key={option.value} onClick={() => setFilter(option.value)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black ${filter === option.value ? 'bg-primary text-background' : 'bg-surface-high text-on-surface-variant'}`}>{option.label}</button>)}</div></section>
    {loading ? <div className="flex min-h-48 items-center justify-center"><LoaderCircle className="animate-spin text-primary" size={28}/></div> : visible.length === 0 ? <div className="rounded-[28px] border border-outline/10 bg-surface p-10 text-center text-sm text-on-surface-variant">Bu durumda Creator başvurusu bulunmuyor.</div> : <div className="grid gap-4 xl:grid-cols-2">{visible.map((item) => <article key={item.user.id} className="rounded-[24px] border border-outline/10 bg-surface p-5"><div className="flex items-center gap-4"><div className="h-14 w-14 overflow-hidden rounded-2xl bg-surface-high">{item.channel?.avatarUrl || item.user.avatarUrl ? <img src={item.channel?.avatarUrl ?? item.user.avatarUrl ?? ''} alt="" className="h-full w-full object-cover"/> : null}</div><div className="min-w-0 flex-1"><h3 className="truncate font-bold text-white">{item.channel?.channelName ?? item.user.name ?? item.user.username}</h3><p className="mt-1 truncate text-xs text-on-surface-variant">@{item.user.username} · {item.user.email}</p><p className="mt-1 text-xs text-primary">{item.channel?.videoCount ?? 0} video · {statusLabels[item.application.status]}</p></div>{item.channel?.channelUrl && <a href={item.channel.channelUrl} target="_blank" rel="noreferrer" className="rounded-xl p-2 text-on-surface-variant hover:text-primary"><ExternalLink size={17}/></a>}</div><div className="mt-5 grid grid-cols-3 gap-2"><button disabled={busyId === item.user.id} onClick={() => void review(item, 'approved')} className="inline-flex items-center justify-center gap-1 rounded-xl bg-secondary/10 px-3 py-2.5 text-xs font-black text-secondary"><Check size={14}/>Onayla</button><button disabled={busyId === item.user.id} onClick={() => void review(item, 'rejected')} className="inline-flex items-center justify-center gap-1 rounded-xl bg-error/10 px-3 py-2.5 text-xs font-black text-error"><X size={14}/>Reddet</button><button disabled={busyId === item.user.id} onClick={() => void review(item, 'suspended')} className="inline-flex items-center justify-center gap-1 rounded-xl bg-surface-high px-3 py-2.5 text-xs font-black text-on-surface-variant"><Ban size={14}/>Askıya al</button></div></article>)}</div>}
  </div>;
}
