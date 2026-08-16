import { useEffect, useMemo, useState } from 'react';
import { Calculator, LoaderCircle, RefreshCw, Save, UsersRound } from 'lucide-react';
import { getApiErrorMessage } from '../services/apiClient';
import {
  getYoutubeScoreOverview,
  recalculateYoutubeScores,
  updateYoutubeScoreWeights,
  type YoutubeScoreOverview,
  type YoutubeScoreWeights,
} from '../services/videoService';

type WeightKey = 'reach' | 'engagement' | 'viewPower' | 'consistency' | 'growth';

const criteria: Array<{ key: WeightKey; label: string; description: string }> = [
  { key: 'reach', label: 'Kitle Büyüklüğü', description: 'Kanalın güncel abone sayısı' },
  { key: 'engagement', label: 'Etkileşim Oranı', description: 'Son videolardaki beğeni ve yorum / izlenme oranı' },
  { key: 'viewPower', label: 'İzlenme Gücü', description: 'Ortalama izlenmenin abone sayısına oranı' },
  { key: 'consistency', label: 'Tutarlılık / Aktiflik', description: 'Son 90 gündeki video yayınlama sıklığı' },
  { key: 'growth', label: 'Büyüme Trendi', description: 'Son 30 gündeki abone artış yüzdesi' },
];

function formatNumber(value: number | null) {
  return value === null ? '—' : new Intl.NumberFormat('tr-TR').format(value);
}

function formatScore(value: number | null | undefined) {
  return value == null ? '—' : value.toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export default function AdminYoutubeScoring() {
  const [overview, setOverview] = useState<YoutubeScoreOverview | null>(null);
  const [weights, setWeights] = useState<Omit<YoutubeScoreWeights, 'updatedAt'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'save' | 'recalculate' | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const total = useMemo(() => weights ? criteria.reduce((sum, item) => sum + weights[item.key], 0) : 0, [weights]);

  useEffect(() => {
    getYoutubeScoreOverview()
      .then((data) => { setOverview(data); setWeights(data.weights); })
      .catch((reason) => setError(getApiErrorMessage(reason, 'Skor kriterleri yüklenemedi.')))
      .finally(() => setLoading(false));
  }, []);

  function setWeight(key: WeightKey, value: number) {
    setWeights((current) => current ? { ...current, [key]: Math.min(100, Math.max(0, value)) } : current);
  }

  async function save() {
    if (!weights || total !== 100 || busy) return;
    setBusy('save'); setError(''); setNotice('');
    try {
      const data = await updateYoutubeScoreWeights(weights);
      setOverview(data); setWeights(data.weights);
      setNotice('Skor ağırlıkları kaydedildi ve tüm kanal puanları yeniden hesaplandı.');
    } catch (reason) { setError(getApiErrorMessage(reason, 'Skor ağırlıkları kaydedilemedi.')); }
    finally { setBusy(null); }
  }

  async function recalculate() {
    if (busy) return;
    setBusy('recalculate'); setError(''); setNotice('');
    try {
      const data = await recalculateYoutubeScores();
      setOverview(data); setWeights(data.weights);
      setNotice('YouTuber puanları güncel verilerle yeniden hesaplandı.');
    } catch (reason) { setError(getApiErrorMessage(reason, 'Puanlar yeniden hesaplanamadı.')); }
    finally { setBusy(null); }
  }

  if (loading) return <div className="flex min-h-64 items-center justify-center"><LoaderCircle className="animate-spin text-primary" size={30} /></div>;

  return (
    <div className="space-y-6">
      {notice && <div role="status" className="rounded-2xl border border-secondary/30 bg-secondary/10 p-4 text-sm font-bold text-secondary">{notice}</div>}
      {error && <div role="alert" className="rounded-2xl border border-error/30 bg-error/10 p-4 text-sm font-bold text-error">{error}</div>}

      <section className="rounded-[28px] border border-outline/10 bg-surface p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Calculator size={22} /></span>
            <div><h2 className="font-headline text-2xl font-bold text-white">Skor Kriterleri</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">YouTuber güven skoru, kanalların birbirine göre normalize edilen verilerinden 100 üzerinden hesaplanır. Bu puanlar şimdilik yalnızca yönetim panelinde görünür.</p></div>
          </div>
          <div className={`rounded-2xl border px-5 py-3 text-center ${total === 100 ? 'border-secondary/30 bg-secondary/10 text-secondary' : 'border-error/30 bg-error/10 text-error'}`}><p className="text-[10px] font-black uppercase tracking-wider">Toplam Ağırlık</p><p className="mt-1 text-2xl font-black">%{total}</p></div>
        </div>

        {weights && <div className="mt-7 grid gap-4 lg:grid-cols-2">{criteria.map((item) => <label key={item.key} className="rounded-2xl border border-outline/10 bg-background/40 p-4"><span className="flex items-start justify-between gap-3"><span><span className="block text-sm font-black text-white">{item.label}</span><span className="mt-1 block text-xs leading-5 text-on-surface-variant">{item.description}</span></span><span className="text-lg font-black text-primary">%{weights[item.key]}</span></span><span className="mt-4 flex items-center gap-3"><input type="range" min="0" max="100" step="1" value={weights[item.key]} onChange={(event) => setWeight(item.key, Number(event.target.value))} className="min-w-0 flex-1 accent-primary" /><input aria-label={`${item.label} yüzdesi`} type="number" min="0" max="100" value={weights[item.key]} onChange={(event) => setWeight(item.key, Number(event.target.value))} className="w-20 rounded-xl border border-outline/10 bg-surface-high px-3 py-2 text-right text-sm font-black text-white outline-none focus:border-primary" /></span></label>)}</div>}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row"><button type="button" disabled={total !== 100 || Boolean(busy)} onClick={() => void save()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-background disabled:cursor-not-allowed disabled:opacity-40">{busy === 'save' ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />} Ağırlıkları kaydet</button><button type="button" disabled={Boolean(busy)} onClick={() => void recalculate()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface-high px-5 py-3 text-sm font-black text-white disabled:opacity-40">{busy === 'recalculate' ? <LoaderCircle className="animate-spin" size={17} /> : <RefreshCw size={17} />} Puanları yeniden hesapla</button></div>
      </section>

      <section className="rounded-[28px] border border-outline/10 bg-surface p-6 md:p-8">
        <div className="flex items-center justify-between gap-4"><div><h2 className="font-headline text-xl font-bold text-white">Skor önizlemesi</h2><p className="mt-1 text-xs text-on-surface-variant">{overview?.activeChannelCount ?? 0} aktif kanal · En az {overview?.minimumChannelCount ?? 5} kanal gerekir</p></div><UsersRound className="text-primary" size={24} /></div>
        {!overview?.eligible && <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">Karşılaştırılabilir skor üretmek için yeterli aktif kanal bulunmuyor.</div>}
        <div className="mt-6 overflow-x-auto rounded-2xl border border-outline/10">
          <table className="w-full min-w-[980px] text-left text-xs"><thead className="bg-background/60 text-on-surface-variant"><tr><th className="px-4 py-3">YouTuber</th><th className="px-4 py-3">Abone</th><th className="px-4 py-3">Toplam</th>{criteria.map((item) => <th key={item.key} className="px-4 py-3">{item.label}</th>)}</tr></thead><tbody className="divide-y divide-outline/10">{overview?.channels.map((channel) => <tr key={channel.id} className="bg-background/25 text-on-surface-variant hover:bg-background/45"><td className="px-4 py-3"><span className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-highest">{channel.avatarUrl ? <img src={channel.avatarUrl} alt="" className="h-full w-full object-cover" /> : <UsersRound size={17} />}</span><span><span className="block font-bold text-white">{channel.channelName}</span><span className="text-[10px] uppercase">{channel.status === 'active' ? 'Aktif' : 'Duraklatıldı'}</span></span></span></td><td className="px-4 py-3 font-bold text-white">{formatNumber(channel.subscriberCount)}</td><td className="px-4 py-3"><span className="rounded-lg bg-primary/15 px-2.5 py-1.5 font-black text-primary">{formatScore(channel.score?.total)}</span></td><td className="px-4 py-3">{formatScore(channel.score?.reach)}</td><td className="px-4 py-3">{formatScore(channel.score?.engagement)}</td><td className="px-4 py-3">{formatScore(channel.score?.viewPower)}</td><td className="px-4 py-3">{formatScore(channel.score?.consistency)}</td><td className="px-4 py-3">{formatScore(channel.score?.growth)}</td></tr>)}</tbody></table>
        </div>
        <p className="mt-4 text-xs leading-5 text-on-surface-variant">Büyüme puanı, en az iki farklı güne ait ve son 30 gün içinde kalan ölçüm oluşunca hesaplanır. Eksik ölçütün ağırlığı geçici olarak toplam puanın paydasına dahil edilmez.</p>
      </section>
    </div>
  );
}
