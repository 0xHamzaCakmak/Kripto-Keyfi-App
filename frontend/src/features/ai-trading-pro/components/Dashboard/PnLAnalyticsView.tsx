import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, DollarSign } from 'lucide-react';
import { getApiErrorMessage } from '../../../../services/apiClient';
import { calendarDates, getBotPnl, getPnlDayDetails, istanbulToday, monthRange, rangeMonths, resetBotPnl, type PnlDay, type PnlDayDetails, type PnlDetailRow, type PnlReport } from '../../../../services/botPnlService';

const money = (v: string | null) => v === null ? 'Doğrulanamadı' : `${Number(v) > 0 ? '+' : ''}${Number(v).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })} USDT`;
const field = 'rounded-lg border border-[#2b3139] bg-[#0b0e11] p-2 text-sm text-[#eaecef]';
export function PnLAnalyticsView({ accountId, accountName }: { accountId?: string | null; accountName?: string }) {
  const [range, setRange] = useState(() => monthRange(istanbulToday().slice(0, 7))), [draft, setDraft] = useState(range);
  const [report, setReport] = useState<PnlReport | null>(null);
  const [error, setError] = useState(''), [loading, setLoading] = useState(false), [resetting, setResetting] = useState(false), [confirming, setConfirming] = useState(false);
  const [revision, setRevision] = useState(0), generation = useRef(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null), [details, setDetails] = useState<PnlDayDetails | null>(null), [detailsLoading, setDetailsLoading] = useState(false);
  useEffect(() => {
    const current = ++generation.current; let disposed = false, busy = false; let timer: ReturnType<typeof setTimeout>;
    setReport(null); setError(''); setConfirming(false); setResetting(false);
    if (!accountId) { setLoading(false); return; }
    const load = async () => {
      if (busy || generation.current !== current) return; busy = true; setLoading(true);
      try { const result = await getBotPnl(accountId, range.start, range.end); if (!disposed && generation.current === current) { setReport(result); setError(''); } }
      catch (reason) { if (!disposed && generation.current === current) setError(getApiErrorMessage(reason, 'Kâr/zarar verileri alınamadı.')); }
      finally { busy = false; if (!disposed && generation.current === current) setLoading(false); if (!disposed && generation.current === current) timer = setTimeout(() => void load(), 60000); }
    };
    void load();
    return () => { disposed = true; clearTimeout(timer); generation.current++; };
  }, [accountId, range.start, range.end, revision]);
  const visible = report?.exchangeAccountId === accountId && report.start === range.start && report.end === range.end ? report : null;
  async function reset() {
    if (!accountId || resetting) return;
    const current = ++generation.current; setResetting(true); setError(''); setReport(null);
    try { await resetBotPnl(accountId); if (generation.current === current) { setConfirming(false); setRevision(v => v + 1); } }
    catch (reason) { if (generation.current === current) { setError(getApiErrorMessage(reason, 'Sıfırlama tamamlanamadı.')); setResetting(false); } }
  }
  async function openDetails(date: string) {
    if (!accountId) return;
    setSelectedDate(date); setDetails(null); setDetailsLoading(true); setError('');
    try { setDetails(await getPnlDayDetails(accountId, date)); }
    catch (reason) { setError(getApiErrorMessage(reason, 'Günlük işlem detayları alınamadı.')); }
    finally { setDetailsLoading(false); }
  }
  if (selectedDate) return <PnlDayDetailView date={selectedDate} details={details} loading={detailsLoading} error={error} onBack={() => { setSelectedDate(null); setDetails(null); setError(''); }}/>
  return <div id="pnl-analytics-view" className="w-full space-y-5 animate-in fade-in duration-200">
    <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-6 shadow-xl flex flex-wrap gap-4 items-center justify-between">
      <div className="flex items-center gap-3.5"><div className="w-12 h-12 shrink-0 rounded-xl bg-[#0b0e11] border border-[#02c076]/40 flex items-center justify-center text-[#02c076] shadow-[0_0_15px_rgba(2,192,118,0.25)]"><DollarSign className="w-6 h-6"/></div><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef]">Kâr / Zarar & Finansal Günlük Raporu</h1><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30">GÜNLÜK PNL TAKVİMİ</span></div><p className="text-xs text-[#848e9c] mt-0.5">{accountName ?? 'Seçili hesap'} · Kripto Keyfi işlemleri · Türkiye saati</p></div></div>
      <div className="text-right font-['JetBrains_Mono',monospace]"><span className="text-[10px] text-[#848e9c] block">SEÇİLİ DÖNEM TOPLAM {Number(visible?.totalNet ?? 0) < 0 ? 'ZARAR' : Number(visible?.totalNet ?? 0) > 0 ? 'KÂR' : 'NET SONUÇ'}</span><span className={`text-base font-black ${Number(visible?.totalNet ?? 0) < 0 ? 'text-[#f84960]' : 'text-[#02c076]'}`}>{visible ? money(visible.totalNet) : '—'}</span></div>
    </div>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); if (draft.start > draft.end || Date.parse(draft.end) - Date.parse(draft.start) > 365 * 86400000) { setError('Tarih sırasını kontrol edin; en fazla 366 gün seçebilirsiniz.'); return; } setRange({ ...draft }); }}>
      <label className="text-xs text-[#848e9c]">Ay<input type="month" aria-label="Takvim ayı" value={range.start.slice(0, 7)} onChange={e => { if (e.target.value) { const next = monthRange(e.target.value); setRange(next); setDraft(next); } }} className={`${field} block mt-1`}/></label>
      <label className="text-xs text-[#848e9c]">Başlangıç<input required type="date" value={draft.start} onChange={e => setDraft(v => ({ ...v, start: e.target.value }))} className={`${field} block mt-1`}/></label>
      <label className="text-xs text-[#848e9c]">Bitiş<input required type="date" value={draft.end} onChange={e => setDraft(v => ({ ...v, end: e.target.value }))} className={`${field} block mt-1`}/></label>
      <button className={field} type="submit" disabled={resetting}>Göster</button><button className={field} type="button" onClick={() => { const next = monthRange(istanbulToday().slice(0, 7)); setRange(next); setDraft(next); }}>Bu ay</button>
      <button className={`${field} ml-auto text-[#f84960]`} type="button" disabled={!accountId || resetting} onClick={() => setConfirming(true)}>Kâr / zararı sıfırla</button>
    </form>
    {!accountId && <p className="text-[#848e9c]">Kâr/zararı görmek için üstten API hesabı seçin.</p>}
    {loading && <p role="status" className="text-xs text-[#848e9c]">Kâr/zarar kayıtları yükleniyor…</p>}
    {error && <p role="alert" className="text-[#f84960]">{error} <button onClick={() => setRevision(v => v + 1)} className="underline">Yeniden dene</button></p>}
    {visible && range.start < visible.accountingStartsAt && <p role="status" className="text-[#f0b90b] text-xs">Kâr/zarar muhasebesi 1 Temmuz 2026 tarihinde başlar. Önceki günlerde işlem kaydı bulunmaz.</p>}
    {visible?.resetAt && <p className="text-xs text-[#848e9c]">Yeni başlangıç: {new Date(visible.resetAt).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}. Bu andan önceki sonuçlar rapora alınmaz.</p>}
    {visible && <><p className="text-xs text-[#848e9c]">Kripto Keyfi üzerinden gönderilen manuel, toplu ve bot emirlerinin gerçekleşmiş sonuçları. İşlem bulunan bir güne tıklayarak detayları açabilirsiniz. Net = toplam kâr + toplam zarar (zararlar eksi). Futures giriş ve çıkış komisyonları gerçekleştiği güne yazılır; grid giriş komisyonu kapanışa dağıtılır. Açık pozisyon kâr/zararı ve funding dahil değildir.</p>{rangeMonths(range.start, range.end).map(month => <PnlMonth key={month} month={month} start={range.start} end={range.end} days={visible.days} onSelect={date => void openDetails(date)}/>)}</>}
    {confirming && <div className="rounded-xl border border-[#f84960]/40 bg-[#1e2329] p-5 space-y-3" role="alertdialog" aria-modal="false" aria-labelledby="pnl-reset-title"><h2 id="pnl-reset-title" className="font-bold text-[#eaecef]">{accountName} hesabının kâr/zarar geçmişi silinsin mi?</h2><p className="text-sm text-[#848e9c]">Bu hesabın tüm tarihlerdeki kâr/zarar rapor kayıtları veritabanından kalıcı olarak silinir. Yeni dönem şimdi başlar. Borsadaki geçmiş, bot emirleri ve açık pozisyonlar korunur.</p><button className={field} disabled={resetting} onClick={() => setConfirming(false)}>Vazgeç</button> <button className={`${field} text-[#f84960]`} disabled={resetting} onClick={() => void reset()}>{resetting ? 'Sıfırlanıyor…' : 'Onayla ve geçmişi sil'}</button></div>}
  </div>;
}
export function PnlMonth({ month, start, end, days, onSelect }: { month: string; start: string; end: string; days: PnlDay[]; onSelect?: (date: string) => void }) {
  const byDay = new Map(days.map(day => [day.date, day]));
  return <section className="space-y-3"><h2 className="text-sm font-bold text-[#eaecef]">{new Date(`${month}-01T12:00:00Z`).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h2><div className="overflow-x-auto"><div className="min-w-[840px] grid grid-cols-7 gap-3">{['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map(day => <div key={day} className="text-xs text-[#848e9c] px-3">{day}</div>)}{calendarDates(month).map(date => {
    const dim = !date.startsWith(month) || date < start || date > end, day = dim ? undefined : byDay.get(date), empty = !day?.count, negative = Number(day?.net ?? 0) < 0, positive = Number(day?.net ?? 0) > 0;
    const tone = empty || day?.net === null || (!positive && !negative) ? 'text-[#848e9c]' : negative ? 'text-[#f84960]' : 'text-[#02c076]';
    return <button type="button" disabled={dim || empty} onClick={() => onSelect?.(date)} key={date} data-date={date} className={`text-left bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-3.5 min-h-[110px] flex flex-col justify-between shadow-lg font-['JetBrains_Mono',monospace] ${dim ? 'opacity-35' : ''} ${!dim && !empty ? 'cursor-pointer hover:border-[#f0b90b]/70 hover:bg-[#222830] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0b90b]' : 'cursor-default'}`}><span className="text-[10px] text-[#848e9c] font-['Inter',sans-serif]">{new Date(`${date}T12:00:00Z`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</span><div className={`text-sm font-black my-2 ${tone}`}>{dim ? '—' : empty ? 'İşlem kaydı yok' : money(day!.net)}</div>{!dim && !empty && <><span className={`text-[9px] font-bold px-1.5 rounded w-fit ${tone} ${negative ? 'bg-[#f84960]/15' : positive ? 'bg-[#02c076]/15' : 'bg-[#848e9c]/10'}`}>{day!.net === null ? 'KOMİSYON EKSİK' : negative ? 'ZARARLI GÜN' : positive ? 'KÂRLI GÜN' : 'BAŞA BAŞ'}</span><span className="text-[9px] text-[#848e9c] mt-2">{day!.count} gerçekleşme kaydı · Detayı aç</span></>}</button>;
  })}</div></div></section>;
}

function DetailList({ title, rows, profit }: { title: string; rows: PnlDetailRow[]; profit: boolean }) {
  const tone = profit ? 'text-[#02c076]' : 'text-[#f84960]';
  return <section className="min-w-0 rounded-2xl border border-[#2b3139] bg-[#1e2329]/80 overflow-hidden"><div className="px-5 py-4 border-b border-[#2b3139] flex justify-between"><h2 className={`font-bold ${tone}`}>{title}</h2><span className="text-xs text-[#848e9c]">{rows.length} gerçekleşme</span></div><div className="divide-y divide-[#2b3139] max-h-[58vh] overflow-y-auto">{rows.length === 0 ? <p className="p-6 text-sm text-[#848e9c]">Bu grupta işlem yok.</p> : rows.map(row => <div key={row.sourceId} className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 items-center"><div><span className="block text-[10px] text-[#848e9c]">İŞLEM ÇİFTİ</span><strong className="text-sm text-[#eaecef]">{row.symbol ?? '—'}</strong></div><div><span className="block text-[10px] text-[#848e9c]">KALDIRAÇ</span><strong className="text-sm text-[#eaecef]">{row.leverage ? `${row.leverage}x` : '—'}</strong></div><div><span className="block text-[10px] text-[#848e9c]">İŞLEM TUTARI</span><strong className="text-sm text-[#eaecef]">{row.tradeNotional ? money(row.tradeNotional) : '—'}</strong></div><div className="sm:text-right"><span className="block text-[10px] text-[#848e9c]">{profit ? 'KÂR' : 'ZARAR'}</span><strong className={`text-sm ${tone}`}>{money(row.net)}</strong></div></div>)}</div></section>;
}

function PnlDayDetailView({ date, details, loading, error, onBack }: { date: string; details: PnlDayDetails | null; loading: boolean; error: string; onBack: () => void }) {
  const formatted = new Date(`${date}T12:00:00Z`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return <div id="pnl-day-detail-view" className="w-full space-y-5 animate-in fade-in duration-200"><div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-5 flex items-center gap-4"><button type="button" onClick={onBack} className={`${field} flex items-center gap-2`}><ArrowLeft className="w-4 h-4"/> Geri</button><div><h1 className="text-xl font-bold text-[#eaecef]">Günlük İşlem Detayı</h1><p className="text-xs text-[#848e9c] mt-1">{formatted} · gerçekleşmiş işlemler</p></div></div>{loading && <p role="status" className="text-[#848e9c]">İşlem detayları yükleniyor…</p>}{error && <p role="alert" className="text-[#f84960]">{error}</p>}{details && <><div className="grid grid-cols-1 lg:grid-cols-2 gap-5"><DetailList title="Kârlı İşlemler" rows={details.profits} profit/><DetailList title="Zararlı İşlemler" rows={details.losses} profit={false}/></div><section className="rounded-2xl border border-[#2b3139] bg-[#1e2329]/90 p-5 grid grid-cols-2 lg:grid-cols-5 gap-4"><Summary label="Toplam İşlem" value={String(details.summary.totalTrades)}/><Summary label="Toplam İşlem Tutarı" value={money(details.summary.totalNotional)}/><Summary label="Toplam Kâr" value={money(details.summary.totalProfit)} tone="text-[#02c076]"/><Summary label="Toplam Zarar" value={money(details.summary.totalLoss)} tone="text-[#f84960]"/><Summary label="Net Sonuç" value={money(details.summary.totalNet)} tone={Number(details.summary.totalNet) < 0 ? 'text-[#f84960]' : 'text-[#02c076]'}/></section></>}</div>;
}
function Summary({ label, value, tone = 'text-[#eaecef]' }: { label: string; value: string; tone?: string }) { return <div className="rounded-xl bg-[#0b0e11] border border-[#2b3139] p-4"><span className="block text-[10px] text-[#848e9c] mb-2">{label.toUpperCase()}</span><strong className={`font-['JetBrains_Mono',monospace] ${tone}`}>{value}</strong></div>; }
