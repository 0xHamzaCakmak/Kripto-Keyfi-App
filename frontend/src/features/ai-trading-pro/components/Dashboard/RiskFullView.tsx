import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { getApiErrorMessage } from '../../../../services/apiClient';
import { aiTradingApi, type TradingRiskProfile, type TradingRiskEvent } from '../../../../services/aiTradingService';
import { riskDetailFields, buildRiskDetailsPayload, saveRiskDetails, setRiskKillSwitch } from '../../services/backendRisk';
import { ExecutionSettingsPanel } from './ExecutionSettingsPanel';

export function RiskFullView({ accountId, accountName }: { accountId: string | null; accountName?: string }) {
  return <div id="risk-full-view" className="space-y-5">
    <header className="rounded-2xl border border-[#2b3139] bg-[#1e2329] p-5">
      <h1 className="flex items-center gap-2 text-xl font-bold"><ShieldAlert/> Risk ve Bot Ayarları</h1>
      <p className="mt-2 text-sm text-[#848e9c]">{accountName ?? 'Hesap seçilmedi'} · Bot başına teminat, TP/SL, kaldıraç, emir limitleri ve acil durdurma üstte seçilen hesap için burada yönetilir.</p>
    </header>
    {accountId ? <><ExecutionSettingsPanel key={`execution:${accountId}`} accountId={accountId}/><RiskDetails key={accountId} accountId={accountId} accountName={accountName}/></> : <p className="text-sm text-[#848e9c]">Risk ayarlarını görmek için üst menüden aktif demo hesabı seçin.</p>}
  </div>;
}

function RiskDetails({ accountId, accountName }: { accountId: string; accountName?: string }) {
  const [profile, setProfile] = useState<TradingRiskProfile | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<TradingRiskEvent[]>([]);
  const [error, setError] = useState('');
  const [eventsError, setEventsError] = useState('');
  const [eventsLoading, setEventsLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  function accept(value: TradingRiskProfile) {
    setProfile(value);
    setDraft({ ...Object.fromEntries(riskDetailFields.map(([key]) => [key, String(value[key])])), marginModePolicy: value.marginModePolicy, allowedSymbols: value.allowedSymbols?.join(', ') ?? '', blockedSymbols: value.blockedSymbols?.join(', ') ?? '' });
  }
  useEffect(() => {
    let active = true;
    setProfile(null); setError(''); setEventsError(''); setEvents([]); setEventsLoading(true);
    void aiTradingApi.riskProfile(accountId).then((value) => { if (active) accept(value); }).catch((reason) => { if (active) setError(getApiErrorMessage(reason, 'Risk profili alınamadı.')); });
    void aiTradingApi.riskEvents(accountId).then((value) => { if (active) setEvents(value); }).catch((reason) => { if (active) setEventsError(getApiErrorMessage(reason, 'Risk olayları alınamadı.')); }).finally(() => { if (active) setEventsLoading(false); });
    return () => { active = false; };
  }, [accountId, revision]);

  async function save() {
    if (!profile || busy) return;
    try { buildRiskDetailsPayload(draft); } catch (reason) { setError((reason as Error).message); return; }
    if (!window.confirm(`${accountName ?? 'Seçili hesap'} için ayrıntılı risk limitleri kaydedilsin mi?`)) return;
    setBusy(true); setError(''); setNotice('');
    try { accept(await saveRiskDetails(accountId, draft)); setNotice('Risk limitleri sunucuya kaydedildi.'); }
    catch (reason) { setError(getApiErrorMessage(reason, 'Risk limitleri kaydedilemedi.')); }
    finally { setBusy(false); }
  }
  async function toggle(scope: 'ACCOUNT' | 'GLOBAL') {
    if (!profile || busy) return;
    const active = !(scope === 'GLOBAL' ? profile.globalKillSwitch : profile.accountKillSwitch);
    const target = scope === 'GLOBAL' ? 'TÜM HESAPLAR (global)' : (accountName ?? 'Seçili hesap');
    const reason = window.prompt(`${target}: acil durdurmayı ${active ? 'etkinleştirme' : 'kaldırma'} gerekçesi (3–500 karakter)`);
    if (reason === null) return;
    if (reason.trim().length < 3 || reason.trim().length > 500) { setError('Gerekçe 3–500 karakter olmalı.'); return; }
    if (!window.confirm(`${target} için acil durdurma ${active ? 'etkinleştirilsin' : 'kaldırılsın'} mı?`)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await setRiskKillSwitch(accountId, scope, active, reason.trim());
      setNotice('Acil durdurma değişikliği sunucu tarafından kabul edildi.');
      // Do not discard the unsaved detail draft when changing the switch.
      setProfile(await aiTradingApi.riskProfile(accountId));
    } catch (reason) { setProfile(null); setError(getApiErrorMessage(reason, 'Acil durdurma durumu doğrulanamadı; yeniden yükleyin.')); }
    finally { setBusy(false); }
  }
  const inputClass = 'mt-1 w-full rounded-lg border border-[#2b3139] bg-[#0b0e11] p-2 text-[#eaecef]';
  return <>
    <section className="space-y-4 rounded-2xl border border-[#2b3139] bg-[#1e2329] p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="font-bold">Ayrıntılı risk limitleri ve acil durdurma</h2><button type="button" disabled={busy} onClick={() => setRevision((value) => value + 1)} className="text-xs text-[#00d2ff]">Yeniden yükle</button></div>
      {error && <p role="alert" className="text-sm text-[#f84960]">{error}</p>}
      {notice && <p role="status" className="text-sm text-[#02c076]">{notice}</p>}
      {!profile ? <p className="text-sm text-[#848e9c]">{error ? 'Risk durumu doğrulanamadı.' : 'Risk profili yükleniyor…'}</p> : <>
        <p className="text-xs text-[#848e9c]">Risk motoru: {profile.enabled ? 'Etkin' : 'Devre dışı'} · Stop-loss: {profile.stopLossRequired ? 'Zorunlu' : '—'} · Son kayıt: {new Date(profile.updatedAt).toLocaleString('tr-TR')}</p>
        <div className="grid gap-4 md:grid-cols-2">{(['ACCOUNT', 'GLOBAL'] as const).map((scope) => {
          const active = scope === 'GLOBAL' ? profile.globalKillSwitch : profile.accountKillSwitch;
          return <div key={scope} className="rounded-xl border border-[#f84960]/30 p-4"><h3 className="font-bold">{scope === 'GLOBAL' ? 'Global acil durdurma · tüm hesaplar' : 'Seçili hesap acil durdurması'}</h3><p className="my-2 text-sm">{active ? 'Etkin' : 'Kapalı'} · {(scope === 'GLOBAL' ? profile.globalKillSwitchReason : profile.killSwitchReason) || 'Gerekçe yok'}</p><button type="button" disabled={busy} onClick={() => void toggle(scope)} className="rounded-lg border border-[#f84960]/40 px-3 py-2 text-sm text-[#f84960] disabled:opacity-40">{active ? 'Durdurmayı kaldır' : 'Acil durdurmayı etkinleştir'}</button></div>;
        })}</div>
        <form onSubmit={(event) => { event.preventDefault(); void save(); }}><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {riskDetailFields.map(([key, label, min, max, step]) => <label key={key} className="text-xs text-[#848e9c]">{label}<input className={inputClass} required type="number" min={min} max={max} step={step} value={draft[key] ?? ''} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}/></label>)}
          <label className="text-xs text-[#848e9c]">Marjin politikası<select className={inputClass} value={draft.marginModePolicy} onChange={(event) => setDraft((current) => ({ ...current, marginModePolicy: event.target.value }))}><option value="ISOLATED_ONLY">Yalnızca izole</option><option value="ALLOW_CROSS">Cross kullanılabilir</option></select></label>
          {(['allowedSymbols', 'blockedSymbols'] as const).map((key) => <label key={key} className="text-xs text-[#848e9c]">{key === 'allowedSymbols' ? 'İzinli pariteler (boş = kısıtlama yok)' : 'Engelli pariteler'}<input className={inputClass} placeholder="BTCUSDT, ETHUSDT" value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}/></label>)}
          <button type="submit" className="self-end rounded-lg bg-[#00d2ff] p-2 font-bold text-[#0b0e11] disabled:opacity-40">{busy ? 'İşleniyor…' : 'Ayrıntılı limitleri kaydet'}</button>
        </fieldset></form>
      </>}
    </section>
    <section className="rounded-2xl border border-[#2b3139] bg-[#1e2329] p-5"><h2 className="mb-3 font-bold">Son risk olayları</h2>{eventsError ? <p role="alert" className="text-sm text-[#f84960]">{eventsError}</p> : events.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{['Zaman', 'Karar', 'Kod', 'Açıklama'].map((label) => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{events.map((event) => <tr key={event.id} className="border-t border-[#2b3139]"><td className="p-2">{new Date(event.occurredAt).toLocaleString('tr-TR')}</td><td className="p-2">{event.decision}</td><td className="p-2">{event.code}</td><td className="p-2">{event.message}</td></tr>)}</tbody></table></div> : <p className="text-sm text-[#848e9c]">{!eventsLoading ? 'Risk olayı bulunmuyor.' : 'Risk olayları bekleniyor.'}</p>}</section>
  </>;
}
