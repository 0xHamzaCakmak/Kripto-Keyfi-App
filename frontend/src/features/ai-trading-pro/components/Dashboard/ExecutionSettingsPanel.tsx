import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../../../services/apiClient';
import { getTradingExecutionProfile, updateTradingExecutionProfile, type TradingExecutionProfile } from '../../../../services/tradingService';

export const executionSettingFields = [
  ['botAllocationUsdt', 'Bot başına teminat (USDT)', 0.01, undefined, 'any'],
  ['minInitialMarginUsdt', 'Asgari işlem teminatı (USDT)', 0.01, undefined, 'any'],
  ['maxInitialMargin', 'Azami emir teminatı (USDT; 0 = sınırsız)', 0, undefined, 'any'],
  ['maxOrderNotional', 'Azami emir büyüklüğü (USDT; 0 = sınırsız)', 0, undefined, 'any'],
  ['maxAccountOpenNotional', 'Hesap açık işlem limiti (USDT; 0 = sınırsız)', 0, undefined, 'any'],
  ['minLeverage', 'Asgari kaldıraç', 5, 20, '1'],
  ['maxLeverage', 'Azami kaldıraç', 5, 20, '1'],
  ['stopLossBps', 'Stop-loss (bps; 100 = %1)', 50, 1000, '1'],
  ['takeProfitBps', 'Kâr hedefi ROE (bps; 300 = %3, ücretler hariç)', 10, 5000, '1'],
  ['maxOrdersPerMinute', 'Dakikalık emir limiti (0 = sınırsız)', 0, undefined, '1'],
  ['maxDailyOrders', 'Günlük emir limiti (0 = sınırsız)', 0, undefined, '1'],
] as const;

export function ExecutionSettingsPanel({ accountId }: { accountId: string }) {
  const [profile, setProfile] = useState<TradingExecutionProfile | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void getTradingExecutionProfile(accountId).then((value) => { if (active) setProfile(value); })
        .catch((reason) => { if (active) { setProfile(null); setError(getApiErrorMessage(reason, 'İşlem durumu doğrulanamadı.')); } });
    };
    window.addEventListener('trading-execution-updated', refresh);
    return () => { active = false; window.removeEventListener('trading-execution-updated', refresh); };
  }, [accountId]);
  function accept(value: TradingExecutionProfile) {
    setProfile(value);
    setDraft(Object.fromEntries(executionSettingFields.map(([key]) => [key, String(value[key])])));
  }
  useEffect(() => {
    let active = true;
    setProfile(null); setError('');
    getTradingExecutionProfile(accountId).then((value) => { if (active) accept(value); })
      .catch((reason) => { if (active) setError(getApiErrorMessage(reason, 'İşlem ayarları alınamadı.')); });
    return () => { active = false; };
  }, [accountId, revision]);

  async function save(toggle = false) {
    if (!profile || busy) return;
    const payload = toggle ? { entryPaused: !profile.entryPaused } : Object.fromEntries(executionSettingFields.map(([key]) => [key, typeof profile[key] === 'number' ? Number(draft[key]) : draft[key]]));
    if (!toggle && Number(draft.minLeverage) > Number(draft.maxLeverage)) { setError('Asgari kaldıraç azami kaldıracı aşamaz.'); return; }
    if (!window.confirm(toggle ? `Bu demo hesabındaki otomatik işlemler ${profile.entryPaused ? 'başlatılsın' : 'durdurulsun'} mı?` : 'Bu demo hesabının merkezi işlem ayarları kaydedilsin mi?')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const value = await updateTradingExecutionProfile(accountId, payload);
      if (toggle) setProfile(value); else accept(value);
      setNotice(toggle ? (value.entryPaused ? 'Otomatik işlemler durduruldu.' : 'Otomatik işlemler başlatıldı.') : 'İşlem ayarları kaydedildi. Açık pozisyonların kaldıracı zorla değiştirilmez.');
    } catch (reason) { setError(getApiErrorMessage(reason, 'İşlem ayarları kaydedilemedi.')); }
    finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-[#2b3139] bg-[#1e2329] p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold text-[#eaecef]">Demo işlem ayarları</h2><button type="button" disabled={busy} onClick={() => setRevision((value) => value + 1)} className="text-xs text-[#00d2ff]">Ayarları yeniden yükle</button></div>
    {error && <p role="alert" className="mt-3 text-sm text-[#f84960]">{error}</p>}
    {notice && <p role="status" className="mt-3 text-sm text-[#02c076]">{notice}</p>}
    {!profile ? <p className="mt-4 text-sm text-[#848e9c]">{error ? 'Ayarlar alınamadı.' : 'Ayarlar yükleniyor…'}</p> : <>
      <p className="mt-3 text-sm text-[#f0b90b]">{profile.entryPaused ? 'Yeni emir girişi ve otomatik pozisyon yönetimi durdurulmuş.' : 'Yeni emir girişi ve otomatik pozisyon yönetimi açık.'}</p>
      <button type="button" disabled={busy} onClick={() => void save(true)} className="mt-3 rounded-lg border border-[#00d2ff]/40 px-4 py-2 text-sm text-[#00d2ff] disabled:opacity-40">{profile.entryPaused ? 'Otomatik işlemleri başlat' : 'Otomatik işlemleri durdur'}</button>
      <form onSubmit={(event) => { event.preventDefault(); void save(); }}><fieldset disabled={busy} className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {executionSettingFields.map(([key, label, min, max, step]) => <label key={key} className="text-xs text-[#848e9c]">{label}<input required type="number" min={min} max={max} step={step} value={draft[key] ?? ''} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 w-full rounded-lg border border-[#2b3139] bg-[#0b0e11] p-2 text-[#eaecef]"/></label>)}
        <button type="submit" className="self-end rounded-lg bg-[#00d2ff] p-2 font-bold text-[#0b0e11] disabled:opacity-40">{busy ? 'Kaydediliyor…' : 'Ayarları kaydet'}</button>
      </fieldset></form>
    </>}
  </section>;
}
