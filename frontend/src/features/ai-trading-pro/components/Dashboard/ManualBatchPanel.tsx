import React, { useEffect, useState } from 'react';
import { Layers, Search, X } from 'lucide-react';
import { getApiErrorMessage } from '../../../../services/apiClient';
import { confirmBatch, getBatch, getBatchCandidates, previewBatch, type BatchCandidates, type ManualBatch } from '../../../../services/manualBatchService';
import { getCoinIcon } from '../CoinIcons';

const panel = 'rounded-2xl border border-[#2b3139] bg-[#1e2329]/90 p-5';
const field = 'w-full rounded-xl border border-[#2b3139] bg-[#0b0e11] px-3 py-3 text-sm text-[#eaecef]';
const money = (value: string | number) => Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 8 });
const statusLabel: Record<string, string> = { PREVIEW: 'Önizleme', QUEUED: 'Sırada', RUNNING: 'Gönderiliyor', COMPLETED: 'Gönderim tamamlandı', ATTENTION: 'Kontrol gerekiyor',
  PENDING: 'Giriş bekliyor', ENTRY_FILLED: 'Pozisyon açıldı · TP/SL sırada', PROTECTED: 'Pozisyon + TP/SL', CLOSED: 'Kapandı', SKIPPED: 'Gönderilmedi', SETTLED: 'Tamamlandı' };

export function ManualBatchPanel({ accountId, accountName }: { accountId: string; accountName?: string }) {
  const [data, setData] = useState<BatchCandidates | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [defaultsOnly, setDefaultsOnly] = useState(true);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [margin, setMargin] = useState('100');
  const [leverage, setLeverage] = useState(5);
  const [sl, setSl] = useState(10);
  const [tp, setTp] = useState(2);
  const [batch, setBatch] = useState<ManualBatch | null>(null);
  const [modal, setModal] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [loadRevision, setLoadRevision] = useState(0);
  const selectionKey = `kriptokeyfi.manual-batch.selection.${accountId}`;
  const batchKey = `kriptokeyfi.manual-batch.last.${accountId}`;
  const running = batch?.status === 'QUEUED' || batch?.status === 'RUNNING';

  useEffect(() => {
    let active = true;
    setError('');
    getBatchCandidates(accountId).then(result => {
      if (!active) return;
      setData(result);
      let saved: unknown;
      try { saved = JSON.parse(localStorage.getItem(selectionKey) ?? 'null'); } catch { saved = null; }
      setSelected(Array.isArray(saved) ? saved.filter((s): s is string => typeof s === 'string' && result.symbols.some(v => v.symbol === s)).slice(0, 30)
        : result.symbols.filter(v => v.selectedByDefault).map(v => v.symbol).slice(0, 30));
    }).catch(e => { if (active) setError(getApiErrorMessage(e, 'Coin listesi alınamadı.')); });
    try {
      const id = localStorage.getItem(batchKey);
      if (id) getBatch(id, accountId).then(result => { if (active) setBatch(result); }).catch(e => { if (active) setError(getApiErrorMessage(e, 'Son toplu işlem okunamadı.')); });
    } catch { /* Storage is optional. */ }
    return () => { active = false; };
  }, [accountId, loadRevision]);

  useEffect(() => {
    if (!running || !batch) return;
    let active = true, pending = false;
    const timer = setInterval(() => {
      if (pending) return;
      pending = true;
      getBatch(batch.id, accountId).then(result => { if (active) { setBatch(result); setError(''); } })
        .catch(e => { if (active) setError(getApiErrorMessage(e, 'İşlem durumu alınamadı.')); }).finally(() => { pending = false; });
    }, 2500);
    return () => { active = false; clearInterval(timer); };
  }, [batch?.id, running, accountId]);

  const choose = (symbols: string[]) => {
    setSelected(symbols); setModal(false);
    try { localStorage.setItem(selectionKey, JSON.stringify(symbols)); } catch { /* Storage is optional. */ }
  };
  const remember = (result: ManualBatch) => {
    setBatch(result);
    try { localStorage.setItem(batchKey, result.id); } catch { /* Server still retains the batch. */ }
  };
  const preview = async () => {
    setWorking(true); setError('');
    try { remember(await previewBatch({ exchangeAccountId: accountId, symbols: selected, side, initialMargin: margin,
      leverage, stopLossPercent: sl, takeProfitPercent: tp })); setModal(true); }
    catch (e) { setError(getApiErrorMessage(e, 'Toplu önizleme oluşturulamadı.')); }
    finally { setWorking(false); }
  };
  const confirm = async () => {
    if (!batch) return;
    setWorking(true); setError('');
    try { remember(await confirmBatch(batch.id, accountId)); setModal(false); }
    catch (e) {
      setError(getApiErrorMessage(e, 'Onay sonucu alınamadı. Aynı önizlemeyi tekrar kontrol edebilirsiniz.'));
      try { remember(await getBatch(batch.id, accountId)); } catch { /* Keep the same preview ID for idempotent confirmation. */ }
    } finally { setWorking(false); }
  };
  const visible = data?.symbols.filter(v => (!defaultsOnly || v.selectedByDefault || selected.includes(v.symbol)) && v.symbol.toLowerCase().includes(search.toLowerCase())) ?? [];
  const total = Number(margin) * selected.length;
  const invalid = !data || !selected.length || selected.length > 30 || !Number.isFinite(total) || total <= 0 || total > Number(data.availableBalance)
    || !Number.isInteger(leverage) || leverage < 1 || leverage > 125 || !(sl > 0 && sl < 100 && tp > 0 && tp < 100);

  return <div className="space-y-5" id="manual-batch-panel">
    {error && <div role="alert" className="rounded-xl border border-[#f84960]/40 bg-[#f84960]/10 p-4 text-sm text-[#f84960]">{error}
      {!data && <button className="ml-3 underline" onClick={() => setLoadRevision(v => v + 1)}>Yeniden yükle</button>}</div>}
    <div className="grid gap-5 lg:grid-cols-12">
      <section className={`${panel} lg:col-span-5`}>
        <h2 className="flex items-center gap-2 font-bold text-[#eaecef]"><Layers size={19} className="text-[#f0b90b]"/> Toplu Manuel İşlem</h2>
        <p className="mt-2 text-xs text-[#848e9c]">{accountName ?? 'Seçili hesap'} · Her seçili coin için ayrı piyasa emri.</p>
        <fieldset disabled={working || running} className="mt-5 space-y-5 disabled:opacity-60">
          <div className="grid grid-cols-2 gap-3">{(['BUY', 'SELL'] as const).map(s => <button key={s} onClick={() => setSide(s)} className={`rounded-xl border p-3 font-bold ${side === s ? s === 'BUY' ? 'border-[#02c076] bg-[#02c076]/15 text-[#02c076]' : 'border-[#f84960] bg-[#f84960]/15 text-[#f84960]' : 'border-[#2b3139] text-[#848e9c]'}`}>{s === 'BUY' ? 'LONG' : 'SHORT'}</button>)}</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-2 text-xs text-[#848e9c]"><span>Coin başına teminat (USDT)</span><input aria-label="Coin başına teminat" className={field} type="number" min="0.01" step="any" value={margin} onChange={e => setMargin(e.target.value)}/></label>
            <label className="space-y-2 text-xs text-[#848e9c]"><span>Kaldıraç</span><input aria-label="Toplu kaldıraç" className={field} type="number" min="1" max="125" value={leverage} onChange={e => setLeverage(Number(e.target.value))}/></label>
            <label className="space-y-2 text-xs text-[#f84960]"><span>SL fiyat hareketi (%)</span><input aria-label="Stop loss yüzdesi" className={field} type="number" min="0.01" max="99.99" step="any" value={sl} onChange={e => setSl(Number(e.target.value))}/></label>
            <label className="space-y-2 text-xs text-[#02c076]"><span>TP fiyat hareketi (%)</span><input aria-label="Take profit yüzdesi" className={field} type="number" min="0.01" max="99.99" step="any" value={tp} onChange={e => setTp(Number(e.target.value))}/></label>
          </div>
          <p className="rounded-xl bg-[#0b0e11] p-3 text-xs leading-relaxed text-[#848e9c]">TP/SL fiyatları önizlemedeki mark fiyatına göre hesaplanır. Piyasa emrinin gerçekleşme fiyatı değişebilir. Yüzdeler fiyat hareketidir; komisyon sonrası net getiri değildir.</p>
        </fieldset>
        <div className="mt-5 space-y-2 border-t border-[#2b3139] pt-4 text-sm text-[#eaecef]"><p>Seçili coin: <b>{selected.length}</b></p><p>Hedef toplam teminat: <b>{money(total)} USDT</b></p><p>Hedef toplam pozisyon: <b>{money(total * leverage)} USDT</b></p></div>
      </section>
      <section className={`${panel} lg:col-span-7`}>
        <h2 className="font-bold text-[#eaecef]">İşleme alınacak coinler</h2>
        <p className="mt-2 text-xs text-[#848e9c]">Kullanılabilir USDT: <span className="text-[#02c076]">{data ? money(data.availableBalance) : 'Yükleniyor…'}</span> · {selected.length} coin seçili</p>
        <fieldset disabled={working || running} className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-xs text-[#f0b90b]"><button onClick={() => choose(data?.symbols.filter(v => v.selectedByDefault).map(v => v.symbol).slice(0, 30) ?? [])}>Varsayılanları seç</button><button onClick={() => choose([])}>Temizle</button><label className="ml-auto flex gap-2 text-[#848e9c]"><input type="checkbox" checked={!defaultsOnly} onChange={e => setDefaultsOnly(!e.target.checked)}/>Tüm vadeli pariteler</label></div>
          <label className="flex items-center gap-2"><Search size={16} className="text-[#848e9c]"/><input aria-label="Coin ara" className={field} placeholder="Coin ara (BTC, SOL…)" value={search} onChange={e => setSearch(e.target.value)}/></label>
          <div className="max-h-[440px] space-y-2 overflow-y-auto">{visible.map(coin => <label key={coin.symbol} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${selected.includes(coin.symbol) ? 'border-[#f0b90b]/60 bg-[#f0b90b]/10' : 'border-[#2b3139] bg-[#0b0e11]'}`}>
            <input type="checkbox" aria-label={coin.symbol} checked={selected.includes(coin.symbol)} disabled={!selected.includes(coin.symbol) && selected.length >= 30} onChange={e => choose(e.target.checked ? [...selected, coin.symbol] : selected.filter(s => s !== coin.symbol))}/>
            {getCoinIcon(coin.symbol, 24)}<span className="text-sm font-bold text-[#eaecef]">{coin.symbol}</span><span className="ml-auto text-xs text-[#848e9c]">Azami {coin.maxLeverage}x</span>
          </label>)}{data && !visible.length && <p className="p-4 text-sm text-[#848e9c]">Eşleşen coin yok. Tüm vadeli pariteleri açabilirsiniz.</p>}</div>
        </fieldset>
        <button id="btn-preview-manual-batch" disabled={invalid || working || running} onClick={preview} className="mt-4 w-full rounded-xl bg-[#f0b90b] p-3 text-sm font-bold text-black disabled:opacity-40">{working ? 'Hazırlanıyor…' : 'Toplu Emirleri Önizle'}</button>
      </section>
    </div>
    {batch && batch.status !== 'PREVIEW' && <section className={panel} aria-live="polite"><h3 className="font-bold text-[#eaecef]">Toplu işlem sonucu · {statusLabel[batch.status] ?? batch.status}</h3>
      <p className="mt-2 text-xs text-[#848e9c]">İlk 20 giriş emri aynı anda başlatılır; tüm giriş denemeleri bittikten sonra TP/SL emirleri eklenir. Pozisyonlar ve bekleyen koruma emirleri ilgili ekranlarda görünür.</p>
      <div className="mt-4 space-y-2">{batch.items.map(item => <div key={item.symbol} className="rounded-xl bg-[#0b0e11] p-3 text-sm"><div className="flex justify-between gap-3"><b className="text-[#eaecef]">{item.symbol}</b><span className={item.status === 'ATTENTION' ? 'text-[#f84960]' : 'text-[#f0b90b]'}>{statusLabel[item.status] ?? item.status}</span></div><p className="mt-1 text-xs text-[#848e9c]">{item.detail}</p></div>)}</div>
    </section>}
    {modal && batch?.status === 'PREVIEW' && <div role="dialog" aria-modal="true" aria-labelledby="batch-preview-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <section className={`${panel} max-h-[90vh] w-full max-w-4xl overflow-auto shadow-2xl`}>
        <div className="flex items-center justify-between"><h2 id="batch-preview-title" className="font-bold text-[#eaecef]">Toplu Manuel Emir Önizlemesi</h2><button aria-label="Önizlemeyi kapat" disabled={working} onClick={() => setModal(false)}><X className="text-[#848e9c]"/></button></div>
        <div className="my-5 grid grid-cols-2 gap-3 text-sm text-[#eaecef] sm:grid-cols-4"><p>{batch.input.side === 'BUY' ? 'LONG' : 'SHORT'} {batch.input.leverage}x</p><p>{batch.items.length} coin</p><p>Teminat: {money(batch.totalMargin)} USDT</p><p>Pozisyon: {money(batch.totalNotional)} USDT</p></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-xs text-[#eaecef]"><thead className="text-[#848e9c]"><tr>{['Coin', 'Mark fiyatı', 'Miktar', 'Teminat', 'TP fiyatı', 'SL fiyatı'].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{batch.items.map(i => <tr key={i.symbol} className="border-t border-[#2b3139]"><td className="p-3 font-bold">{i.symbol}</td><td className="p-3">{money(i.markPrice)}</td><td className="p-3">{i.quantity}</td><td className="p-3">{money(i.margin)}</td><td className="p-3 text-[#02c076]">{i.takeProfit}</td><td className="p-3 text-[#f84960]">{i.stopLoss}</td></tr>)}</tbody></table></div>
        <p className="my-4 text-xs leading-relaxed text-[#848e9c]">Onaydan sonra ilk 20 giriş emri aynı anda başlatılır. Tüm giriş denemeleri tamamlanınca gerçekleşen pozisyonlara sırayla SL ve TP emirleri eklenir. Borsa, ağ ve risk kontrolleri nedeniyle süre değişebilir veya bazı coinler reddedilebilir. Önizleme 5 dakika geçerlidir.</p>
        {error && <p role="alert" className="mb-3 text-sm text-[#f84960]">{error}</p>}
        <div className="flex justify-end gap-3"><button disabled={working} onClick={() => setModal(false)} className="rounded-xl border border-[#2b3139] px-4 py-3 text-sm text-[#eaecef]">Vazgeç</button><button id="btn-confirm-manual-batch" disabled={working} onClick={confirm} className="rounded-xl bg-[#02c076] px-5 py-3 text-sm font-bold text-black disabled:opacity-50">{working ? 'Onaylanıyor…' : 'Onayla ve Emirleri Gönder'}</button></div>
      </section>
    </div>}
  </div>;
}
