import React, { useEffect, useRef, useState } from 'react';
import { Grid, Plus, X } from 'lucide-react';
import { getCoinIcon } from '../CoinIcons';
import { getApiErrorMessage } from '../../../../services/apiClient';
import { confirmDemoGrid, controlDemoGrid, getDemoGrids, getGridSymbols, previewDemoGrid, type GridBot, type GridInput, type GridPlan, type GridPreview, type GridSymbols } from '../../../../services/gridDemoService';

const field = 'mt-1 w-full rounded-lg border border-[#2b3139] bg-[#0b0e11] px-3 py-2 text-sm text-[#eaecef] outline-none focus:border-[#02c076] disabled:opacity-40';
const button = 'rounded-lg border border-[#2b3139] px-3 py-2 text-xs font-bold disabled:opacity-40';
const money = (value: string | number | null | undefined) => value == null ? 'Hesaplanamadı' : Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 8 });
const statusName: Record<string, string> = { STARTING: 'HAZIRLANIYOR', RUNNING: 'ÇALIŞIYOR', PAUSED: 'DURAKLATILDI', STOPPED: 'SONLANDIRILDI', ERROR: 'KONTROL GEREKLİ', RISK_BLOCKED: 'RİSK ENGELİ', RECONCILING: 'KONTROL EDİLİYOR' };

export function GridBotView({ accountId, accountName, accountType }: { accountId: string | null; accountName?: string; accountType?: string }) {
  const [snapshot, setSnapshot] = useState<{ accountId: string | null; bots: GridBot[] }>({ accountId: null, bots: [] });
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [creating, setCreating] = useState(false), [detailId, setDetailId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0), [working, setWorking] = useState(false), [closing, setClosing] = useState<GridBot | null>(null);
  const generation = useRef(0);
  useEffect(() => { generation.current++; setCreating(false); setDetailId(null); setClosing(null); setError(''); setWorking(false); }, [accountId]);
  useEffect(() => {
    let cancelled = false, busy = false;
    setSnapshot({ accountId, bots: [] });
    if (!accountId) return;
    const refresh = async () => {
      if (busy) return; busy = true; setLoading(true);
      try { const bots = await getDemoGrids(accountId); if (!cancelled) { setSnapshot({ accountId, bots }); setError(''); } }
      catch (e) { if (!cancelled) setError(getApiErrorMessage(e, 'Grid botları alınamadı.')); }
      finally { busy = false; if (!cancelled) setLoading(false); }
    };
    void refresh(); const timer = window.setInterval(() => void refresh(), 10000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [accountId, revision]);
  const bots = snapshot.accountId === accountId ? snapshot.bots : [], detail = bots.find(b => b.id === detailId);
  const operate = async (bot: GridBot, action: 'PAUSE' | 'RESUME' | 'CLOSE') => {
    if (!accountId || working || bot.exchangeAccountId !== accountId) return;
    const version = generation.current; setWorking(true);
    try { await controlDemoGrid(bot.id, accountId, action); if (version === generation.current) { setClosing(null); setRevision(r => r + 1); } }
    catch (e) { if (version === generation.current) setError(getApiErrorMessage(e, 'Grid işlemi tamamlanamadı.')); }
    finally { if (version === generation.current) setWorking(false); }
  };
  return <div id="grid-bot-view" className="w-full space-y-5 animate-in fade-in duration-200">
    <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-6 shadow-xl flex items-center justify-between gap-3">
      <div className="flex items-center gap-3.5"><div className="w-12 h-12 rounded-xl bg-[#0b0e11] border border-[#02c076]/40 flex items-center justify-center text-[#02c076] shadow-[0_0_15px_rgba(2,192,118,0.25)]"><Grid className="w-6 h-6"/></div><div><div className="flex items-center gap-2 flex-wrap"><h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef]">Grid Bot (Otomatik Dalga Al-Sat Stratejisi)</h1><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30">YATAY PİYASA ROBOTU</span></div><p className="text-xs text-[#848e9c] mt-0.5">Belirlediğiniz fiyat aralıklarında otomatik limit alım-satım ızgaraları oluşturur.</p></div></div>
      <button type="button" disabled={!accountId} onClick={() => setCreating(true)} className="flex shrink-0 items-center gap-1.5 px-4 py-2 bg-[#02c076] hover:bg-[#02c076]/90 text-[#0b0e11] font-bold rounded-xl text-xs shadow-[0_0_15px_rgba(2,192,118,0.3)] transition-all disabled:opacity-40"><Plus className="w-4 h-4"/><span>Yeni Grid Bot Kur</span></button>
    </div>
    {error && <p role="alert" className="rounded-xl border border-[#f84960]/30 bg-[#f84960]/10 p-3 text-sm text-[#f84960]">{error} {bots.length > 0 && 'Son veriler güncel olmayabilir.'}</p>}
    {!accountId ? <p className="p-6 text-sm text-[#848e9c]">Üst menüden bağlı bir demo borsa hesabı seçin.</p> : <>
      {bots.length === 0 && <div className="rounded-2xl border border-[#2b3139] bg-[#1e2329]/80 p-8 text-center text-sm text-[#848e9c]">{loading ? 'Grid botları yükleniyor…' : error ? 'Grid listesi doğrulanamadı.' : `${accountName ?? 'Seçili hesap'} için henüz grid bot yok.`}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{bots.map(bot => <article key={bot.id} className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-5 shadow-xl flex flex-col justify-between"><button type="button" onClick={() => setDetailId(bot.id)} className="w-full text-left">
        <div className="flex items-center justify-between pb-3 border-b border-[#2b3139] mb-3"><div className="flex items-center gap-2 font-bold text-[#eaecef]">{getCoinIcon(bot.symbol, 18)}<span>{bot.symbol}</span></div><span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${bot.state === 'RUNNING' ? 'bg-[#02c076]/15 text-[#02c076] border-[#02c076]/30' : 'bg-[#f0b90b]/15 text-[#f0b90b] border-[#f0b90b]/30'}`}>{statusName[bot.state] ?? bot.state}</span></div>
        <div className="space-y-2 text-xs font-['JetBrains_Mono',monospace] mb-4"><Row label="Fiyat Aralığı:" value={`${money(bot.input.lowerPrice)} – ${money(bot.input.upperPrice)} USDT`}/><Row label="Grid Izgara Sayısı:" value={`${bot.plan.prices.length} Seviye`} cyan/><Row label="Yatırım Miktarı:" value={`${money(bot.input.investment)} USDT`}/><Row label="Eşleşen İşlem:" value={String(bot.runtime.matched)}/></div>
        <div className="p-3 bg-[#0b0e11]/80 rounded-xl border border-[#2b3139] flex items-center justify-between font-['JetBrains_Mono',monospace]"><div><span className="text-[10px] text-[#848e9c] block">Grid Kârı</span><span className={`text-sm font-bold ${(Number(bot.runtime.realized) + Number(bot.runtime.pendingRealized ?? 0) - Number(bot.runtime.fees) - Number(bot.runtime.pendingFees ?? 0)) >= 0 ? 'text-[#02c076]' : 'text-[#f84960]'}`}>{money(bot.runtime.feesComplete ? (Number(bot.runtime.realized) + Number(bot.runtime.pendingRealized ?? 0) - Number(bot.runtime.fees) - Number(bot.runtime.pendingFees ?? 0)) : null)} USDT</span></div><span className="text-[11px] text-[#848e9c]">{bot.input.marketType} {bot.input.marketType === 'FUTURES' && `${bot.input.direction} · ${bot.input.leverage}x`}</span></div>
      </button></article>)}</div>
    </>}
    {creating && accountId && <GridSetup key={accountId} accountId={accountId} accountName={accountName ?? ''} accountType={accountType} onClose={() => setCreating(false)} onCreated={bot => { setCreating(false); setDetailId(bot.id); setRevision(r => r + 1); }}/>}
    {detail && <Modal title={`${detail.symbol} · ${detail.name}`} onClose={() => setDetailId(null)}><div className="space-y-4 text-sm">
      <p className="text-[#848e9c]">{statusName[detail.state]} · {detail.stateReason}</p>{detail.lastError && <p role="alert" className="text-[#f84960]">{detail.lastError}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="Gerçekleşen brüt" value={String(Number(detail.runtime.realized) + Number(detail.runtime.pendingRealized ?? 0))}/><Metric label="Komisyon" value={detail.runtime.feesComplete ? String(Number(detail.runtime.fees) + Number(detail.runtime.pendingFees ?? 0)) : null}/><Metric label="Açık kâr/zarar" value={detail.runtime.unrealized}/><Metric label="Funding (+ gelir / − gider)" value={detail.runtime.funding}/><Metric label="Toplam net sonuç" value={detail.totalNet}/><Metric label="Son piyasa fiyatı" value={detail.runtime.markPrice ?? detail.plan.currentPrice}/></div>
      {!detail.runtime.feesComplete && <p className="text-[#f0b90b]">Komisyonların USDT karşılığı eksik; toplam net sonuç doğrulanmadı.</p>}
      <PlanTable input={detail.input} plan={detail.plan} bot={detail}/>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={working || !!error || detail.state !== 'RUNNING'} onClick={() => void operate(detail, 'PAUSE')}>Duraklat</button><button className={button} disabled={working || !!error || detail.state !== 'PAUSED'} onClick={() => void operate(detail, 'RESUME')}>Devam et</button><button className={`${button} text-[#f84960]`} disabled={working || !!error || detail.state === 'STOPPED'} onClick={() => setClosing(detail)}>Botu sonlandır ve kapat</button></div>
      <p className="text-xs text-[#848e9c]">Duraklatma giriş emirlerini iptal eder; açık pozisyonların kapanış ve korumaları sürer. Sonlandırma bu botun emirlerini iptal eder ve kalan miktarı piyasa emriyle kapatır.</p>
    </div></Modal>}
    {closing && <Modal title="Grid botu sonlandır" onClose={() => !working && setClosing(null)}><p className="mb-5 text-sm">{accountName} hesabındaki {closing.symbol} grid emirleri iptal edilecek ve bu botun kalan miktarı piyasa emriyle kapatılacak.</p><button className={`${button} bg-[#f84960] text-white`} disabled={working} onClick={() => void operate(closing, 'CLOSE')}>{working ? 'İşleniyor…' : 'Onayla ve sonlandır'}</button></Modal>}
  </div>;
}

function GridSetup({ accountId, accountName, accountType, onClose, onCreated }: { accountId: string; accountName: string; accountType?: string; onClose: () => void; onCreated: (bot: GridBot) => void }) {
  const spot = accountType === 'SPOT';
  const [form, setForm] = useState<GridInput>({ exchangeAccountId: accountId, name: '', symbol: '', marketType: spot ? 'SPOT' : 'FUTURES', direction: spot ? 'LONG' : 'NEUTRAL', spacingType: 'ARITHMETIC', lowerPrice: '', upperPrice: '', interval: '', investment: '', leverage: spot ? 1 : 2, reservePercent: 30, maxLoss: '', stopLowerPrice: '', stopUpperPrice: '' });
  const [symbols, setSymbols] = useState<GridSymbols | null>(null), [preview, setPreview] = useState<GridPreview | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [now, setNow] = useState(Date.now());
  const alive = useRef(true), submitting = useRef(false);
  useEffect(() => { alive.current = true; getGridSymbols(accountId).then(value => { if (alive.current) setSymbols(value); }).catch(e => { if (alive.current) setError(getApiErrorMessage(e, 'Pariteler alınamadı.')); }); return () => { alive.current = false; }; }, [accountId]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const change = <K extends keyof GridInput>(key: K, value: GridInput[K]) => { setForm(f => ({ ...f, [key]: value })); setPreview(null); setError(''); };
  const buildPreview = async (event: React.FormEvent) => {
    event.preventDefault(); if (submitting.current) return; submitting.current = true; setBusy(true); setError('');
    try { const value = await previewDemoGrid({ ...form, ...(!form.stopUpperPrice || form.direction === 'LONG' ? { stopUpperPrice: undefined } : {}) }); if (alive.current) setPreview(value); }
    catch (e) { if (alive.current) setError(getApiErrorMessage(e, 'Grid önizlemesi hazırlanamadı.')); }
    finally { submitting.current = false; if (alive.current) setBusy(false); }
  };
  const confirm = async () => {
    if (!preview || submitting.current || Date.parse(preview.expiresAt) <= Date.now()) return;
    submitting.current = true; setBusy(true); setError('');
    try { const bot = await confirmDemoGrid(preview); if (alive.current) onCreated(bot); }
    catch (e) { if (alive.current) setError(getApiErrorMessage(e, 'Başlatma sonucu alınamadı. Aynı önizlemeyle tekrar kontrol edebilirsiniz.')); }
    finally { submitting.current = false; if (alive.current) setBusy(false); }
  };
  const expires = preview ? Math.max(0, Math.ceil((Date.parse(preview.expiresAt) - now) / 1000)) : 0;
  return <Modal title={preview ? 'Emir listesini kontrol edin' : 'Yeni Grid Bot Kur'} onClose={() => !busy && onClose()}>
    <p className="mb-4 rounded-lg border border-[#02c076]/30 bg-[#02c076]/5 p-3 text-sm">{accountName} · DEMO / TESTNET</p>{error && <p role="alert" className="mb-4 text-sm text-[#f84960]">{error}</p>}
    {!preview && <details className="mb-4 rounded-lg border border-[#2b3139] bg-[#0b0e11]/50 p-3 text-xs text-[#848e9c]">
      <summary className="cursor-pointer font-semibold text-[#00d2ff]">Testnet başlangıç önerileri ve nötr grid koşulları</summary>
      <ul className="mt-3 list-disc space-y-2 pl-4">
        <li>Nötr futures grid: parite başına pozisyon sınırı en az 2, hesap toplam sınırı en az 2 ve iki yön için boş kapasite gerekir. Hesapta hedge (çift yön) modu gerekir. Bu limitler burada otomatik değiştirilmez.</li>
        <li>İlk deneme: futures 2x kaldıraç, %30 rezerv. Hesabın asgari/azami kaldıraç aralığı 2x’e izin vermelidir; örneğin asgari 5x ise önce merkezi risk ayarını gözden geçirin. Spotta kaldıraç 1x ve yalnızca alış/satış yönü kullanılır.</li>
        <li>Örnek bant: güncel fiyatın yaklaşık %3 altı ile %3 üstü; aralık %0,5–1 veya bunun USDT karşılığı. Bunlar test şablonudur; bant ve adım güncel oynaklığa, fiyat adımına ve komisyona göre seçilmelidir.</li>
        <li>Örnek maksimum zarar: ayırdığınız test bütçesinin %5’i. Alt stop bandın altında, SHORT/nötr için üst stop bandın üstünde olmalı; önizlemedeki toplam stop kaybı bu bütçeye sığmalıdır.</li>
        <li>Minimum emir tutarı yetmiyorsa önce grid sayısını azaltın / aralığı büyütün. Önizleme geçmeden başlatmayın. Grid fiyat aralığı, botların ROE kâr hedefinden ayrı bir ayardır.</li>
      </ul>
    </details>}
    {!preview ? <form onSubmit={event => void buildPreview(event)} className="space-y-4"><fieldset disabled={busy} className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
      <label className="text-xs text-[#848e9c]">Bot adı<input required minLength={3} maxLength={80} value={form.name} onChange={e => change('name', e.target.value)} className={field}/></label>
      <label className="text-xs text-[#848e9c]">Piyasa<select value={form.marketType} onChange={e => { const next = e.target.value as GridInput['marketType']; setForm(f => ({ ...f, marketType: next, direction: next === 'SPOT' ? 'LONG' : 'NEUTRAL', leverage: next === 'SPOT' ? 1 : 2 })); }} className={field}><option value="SPOT">Spot</option><option value="FUTURES">Futures</option></select></label>
      <label className="text-xs text-[#848e9c]">Coin / parite<select required value={form.symbol} onChange={e => change('symbol', e.target.value)} className={field}><option value="">{symbols ? 'Parite seçin' : 'Pariteler yükleniyor…'}</option>{symbols?.symbols.map(s => <option key={s.symbol}>{s.symbol}</option>)}</select></label>
      <label className="text-xs text-[#848e9c]">Grid yönü<select value={form.direction} disabled={form.marketType === 'SPOT'} onChange={e => change('direction', e.target.value as GridInput['direction'])} className={field}><option value="NEUTRAL">Nötr · Long ve Short</option><option value="LONG">{form.marketType === 'SPOT' ? 'Alış / Satış' : 'Long'}</option><option value="SHORT">Short</option></select></label>
      <label className="text-xs text-[#848e9c]">Aralık türü<select value={form.spacingType} onChange={e => change('spacingType', e.target.value as GridInput['spacingType'])} className={field}><option value="ARITHMETIC">Sabit fiyat farkı · USDT</option><option value="GEOMETRIC">Sabit oran · %</option></select></label>
      <label className="text-xs text-[#848e9c]">Kaldıraç<input type="number" min={1} max={5} disabled={form.marketType === 'SPOT'} value={form.leverage} onChange={e => change('leverage', Number(e.target.value))} className={field}/></label>
      {([['lowerPrice', 'Alt fiyat · USDT'], ['upperPrice', 'Üst fiyat · USDT'], ['interval', form.spacingType === 'ARITHMETIC' ? 'İşlem aralığı · USDT' : 'İşlem aralığı · %'], ['investment', form.marketType === 'SPOT' ? 'Ayrılan sermaye · USDT' : 'Ayrılan teminat · USDT'], ['maxLoss', 'Maksimum bot zararı · USDT'], ['stopLowerPrice', 'Alt stop fiyatı · USDT']] as const).map(([key, label]) => <label key={key} className="text-xs text-[#848e9c]">{label}<input required type="number" min="0.00000001" step="any" value={form[key]} onChange={e => change(key, e.target.value)} className={field}/></label>)}
      {form.marketType === 'FUTURES' && form.direction !== 'LONG' && <label className="text-xs text-[#848e9c]">Üst stop fiyatı · USDT<input required type="number" min="0.00000001" step="any" value={form.stopUpperPrice} onChange={e => change('stopUpperPrice', e.target.value)} className={field}/></label>}
      <label className="text-xs text-[#848e9c]">Ayrılacak rezerv · %<input required type="number" min={20} max={80} value={form.reservePercent} onChange={e => change('reservePercent', Number(e.target.value))} className={field}/></label>
    </fieldset>
      {symbols && symbols.marketType !== form.marketType && <p role="alert" className="text-sm text-[#f0b90b]">Seçili API hesabı {symbols.marketType} hesabıdır. {form.marketType} için üst menüden uyumlu demo hesap seçin.</p>}
      <p className="text-xs leading-5 text-[#848e9c]">Futures izole marjin kullanır. Kaldıraç artışı emir miktarını büyütmez. Önizleme emir göndermez; listeyi gördükten sonra ayrıca onaylayacaksınız.</p><button type="submit" disabled={busy || !symbols || symbols.marketType !== form.marketType} className={`${button} bg-[#02c076] text-[#0b0e11]`}>{busy ? 'Hesaplanıyor…' : 'Emirleri önizle'}</button>
    </form> : <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Metric label="Önizleme anındaki fiyat" value={preview.plan.currentPrice}/><Metric label="Toplam emir büyüklüğü" value={preview.plan.totalNotional}/><Metric label="Gerekli başlangıç teminatı" value={preview.plan.initialMargin}/><Metric label="Ayrılan rezerv" value={preview.plan.reserve}/><Metric label="Stoplarda tahmini kayıp" value={preview.plan.estimatedStopLoss}/></div>
      <p className="text-sm">{preview.input.marketType} · {preview.input.direction} · {preview.input.leverage}x · {preview.plan.intervalCount} aralık / {preview.plan.prices.length} seviye</p><PlanTable input={preview.input} plan={preview.plan}/>
      <div className="space-y-1 text-xs leading-5 text-[#848e9c]">{preview.plan.warnings.map(w => <p key={w}>{w}</p>)}<p>Fiyat 2.500 iken 2.600’den normal alış limit emri beklemez; daha ucuz fiyattan gerçekleşebilir. Yukarı kırılımda long için stop emri gerekir. Bu grid başlangıçta fiyatın altındaki long/alış ve üstündeki short girişlerini gönderir.</p></div>
      <p className={expires ? 'text-xs text-[#848e9c]' : 'text-sm text-[#f0b90b]'}>{expires ? `Önizleme ${expires} saniye geçerli. Fiyat seviyeleri aşılırsa yeniden önizleme istenir.` : 'Önizlemenin süresi doldu. Fiyatları yeniden kontrol edin.'}</p>
      <div className="flex gap-3"><button type="button" className={button} disabled={busy} onClick={() => { setPreview(null); setError(''); }}>Düzenle / yeniden önizle</button><button type="button" disabled={busy || expires === 0} onClick={() => void confirm()} className={`${button} bg-[#02c076] text-[#0b0e11]`}>{busy ? 'Onay işleniyor…' : 'Onayla ve demo grid başlat'}</button></div>
    </div>}
  </Modal>;
}
function Row({ label, value, cyan }: { label: string; value: string; cyan?: boolean }) { return <div className="flex justify-between gap-3"><span className="text-[#848e9c]">{label}</span><span className={`${cyan ? 'text-[#00d2ff]' : 'text-[#eaecef]'} font-bold text-right`}>{value}</span></div>; }
function Metric({ label, value }: { label: string; value: string | null }) { return <div className="rounded-lg border border-[#2b3139] bg-[#0b0e11] p-3"><p className="text-[10px] text-[#848e9c]">{label}</p><p className="mt-1 text-sm font-bold">{money(value)}{value !== null ? ' USDT' : ''}</p></div>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; root.current?.focus(); return () => previous?.focus(); }, []);
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-3 sm:p-6"><div ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Tab') { const nodes = root.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)'); if (!nodes?.length) { e.preventDefault(); return; } const first = nodes[0], last = nodes[nodes.length - 1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } } }} className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-[#2b3139] bg-[#1e2329] p-5 shadow-2xl"><div className="mb-5 flex items-center justify-between gap-3"><h2 className="text-lg font-bold">{title}</h2><button type="button" aria-label="Pencereyi kapat" onClick={onClose} className={button}><X size={18}/></button></div>{children}</div></div>;
}
export function PlanTable({ input, plan, bot }: { input: GridInput; plan: GridPlan; bot?: GridBot }) {
  const action = (direction: 'LONG' | 'SHORT', closing: boolean) => input.marketType === 'SPOT' ? closing ? 'SELL · Satış' : 'BUY · Alış' : `${direction === 'LONG' ? 'Long' : 'Short'} ${closing ? 'kapat' : 'aç'}`;
  return <div className="overflow-x-auto rounded-xl border border-[#2b3139]"><table className="w-full min-w-[720px] text-left text-xs"><caption className="bg-[#0b0e11] p-3 text-left text-[#848e9c]">Girişler borsada bekleyen LIMIT emirleridir. Karşı emirler giriş gerçekleşince oluşturulur.</caption><thead className="bg-[#0b0e11] text-[#848e9c]"><tr>{['Seviye', 'Giriş işlemi', 'Giriş fiyatı', 'Miktar', 'Gerçekleşince', 'Çıkış fiyatı', bot ? 'Döngü durumu' : 'Tahmini net / döngü'].map(h => <th key={h} className="p-3 font-medium">{h}</th>)}</tr></thead><tbody>{plan.pairs.map((pair, i) => { const cycle = bot?.runtime.cycles[i]; return <tr key={pair.index} className="border-t border-[#2b3139]"><td className="p-3">{pair.index + 1}</td><td className={`p-3 font-bold ${pair.direction === 'LONG' ? 'text-[#02c076]' : 'text-[#f84960]'}`}>{action(pair.direction, false)}</td><td className="p-3">{money(pair.entryPrice)}</td><td className="p-3">{money(pair.quantity)}</td><td className="p-3">{action(pair.direction, true)}</td><td className="p-3">{money(pair.exitPrice)}</td><td className="p-3">{bot ? cycle?.settled ? (Number(cycle.entryFill?.executed ?? 0) === 0 ? 'Giriş gerçekleşmedi' : 'Tamamlandı') : cycle?.exit ? 'Kapanış bekleniyor' : cycle?.entry ? 'Giriş takip ediliyor' : 'Gönderim bekliyor' : `${money(pair.estimatedNetProfit)} USDT`}</td></tr>; })}</tbody></table></div>;
}
