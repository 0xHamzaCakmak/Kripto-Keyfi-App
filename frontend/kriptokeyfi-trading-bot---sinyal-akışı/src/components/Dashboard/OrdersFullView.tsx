import { useEffect, useRef, useState } from 'react';
import { Clock, RefreshCw, Trash2 } from 'lucide-react';
import { cancelOrder, getOpenOrders, type OpenOrder } from '../../../../src/services/tradingService';
import { getApiErrorMessage } from '../../../../src/services/apiClient';
import { subscribeTradingEvents } from '../../../../src/services/tradingEvents';

export function canCancelProOrder(order: OpenOrder) {
  return Boolean(order.exchangeOrderId) && !order.pending && !['SUBMITTING', 'CANCELING', 'CLOSING', 'RECONCILIATION_REQUIRED', 'CANCELED', 'FILLED', 'REJECTED', 'EXPIRED'].includes(order.status);
}

export function OrdersFullView({ accountId, accountName }: { accountId: string | null; accountName?: string }) {
  const [snapshot, setSnapshot] = useState<{ accountId: string | null; rows: OpenOrder[] }>({ accountId, rows: [] });
  const [loading, setLoading] = useState(Boolean(accountId));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [revision, setRevision] = useState(0);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const rows = snapshot.accountId === accountId ? snapshot.rows : [];
  const visible = rows.filter((row) => filter === 'ALL' || row.status === filter);

  useEffect(() => {
    let active = true;
    let busy = false;
    let pendingEvent: number | undefined;
    setLoading(Boolean(accountId));
    if (!accountId) return;
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const next = await getOpenOrders(accountId);
        if (active) { setSnapshot({ accountId, rows: next }); setError(''); }
      } catch (reason) { if (active) setError(getApiErrorMessage(reason, 'Borsa emirleri alınamadı.')); }
      finally { busy = false; if (active) setLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    const unsubscribe = subscribeTradingEvents(accountId, (event) => {
      if (!active || event.exchangeAccountId !== accountId || !['trading.order', 'trading.snapshot', 'trading.account'].includes(event.topic) || pendingEvent !== undefined) return;
      pendingEvent = window.setTimeout(() => { pendingEvent = undefined; void load(); }, 500);
    }, (status) => { if (active && status === 'LIVE') void load(); });
    return () => { active = false; unsubscribe(); window.clearInterval(timer); window.clearTimeout(pendingEvent); };
  }, [accountId, revision]);

  async function cancel(targets: OpenOrder[]) {
    if (!accountId || loading || error || working || !targets.length) return;
    if (!window.confirm(`${accountName ?? 'Seçili hesap'} üzerindeki ${targets.length} emir iptal edilsin mi?`)) return;
    setWorking(true); setNotice('');
    let accepted = 0;
    const failures: string[] = [];
    for (const row of targets) {
      if (!mounted.current) break;
      try { await cancelOrder(accountId, row); accepted++; }
      catch (reason) { failures.push(`${row.symbol}: ${getApiErrorMessage(reason, 'İptal isteği başarısız.')}`); }
    }
    if (!mounted.current) return;
    setNotice(`${accepted} iptal isteği alındı. Borsa emirleri yeniden kontrol ediliyor.${failures.length ? ` ${failures.join(' ')}` : ''}`);
    setWorking(false); setRevision((value) => value + 1);
  }

  return <section id="orders-full-view" className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#2b3139] bg-[#1e2329] p-5">
      <div><h1 className="flex items-center gap-2 text-xl font-bold"><Clock size={22}/> Açık Emirler</h1><p className="mt-1 text-xs text-[#848e9c]">{accountName ?? 'Hesap seçilmedi'} · Üstte seçilen hesabın borsadaki emirleri</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={!accountId || loading || working} onClick={() => setRevision((value) => value + 1)} className="flex items-center gap-2 rounded-lg border border-[#2b3139] px-3 py-2 text-xs text-[#00d2ff] disabled:opacity-40"><RefreshCw size={15}/> Yenile</button>
        <button type="button" disabled={!accountId || loading || working || Boolean(error) || !rows.some(canCancelProOrder)} onClick={() => void cancel(rows.filter(canCancelProOrder))} className="rounded-lg border border-[#f84960]/40 px-3 py-2 text-xs text-[#f84960] disabled:opacity-40">Tüm açık emirleri iptal et</button></div>
    </header>
    <p className="text-xs text-[#848e9c]">Koruma emrini iptal etmek pozisyonu kapatmaz. Botun koruma yönetimi aktifse SL/TP emirleri yeniden oluşturulabilir.</p>
    {error && <p role="alert" className="rounded-xl bg-[#f84960]/10 p-3 text-sm text-[#f84960]">{error}{rows.length > 0 && ' Son başarılı okumadaki emirler gösteriliyor; güncel olmayabilir.'}</p>}
    {notice && <p role="status" className="rounded-xl bg-[#00d2ff]/10 p-3 text-sm text-[#00d2ff]">{notice}</p>}
    <label className="flex items-center gap-2 text-xs text-[#848e9c]">Durum<select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-[#2b3139] bg-[#0b0e11] p-2"><option value="ALL">Tümü</option>{[...new Set(rows.map((row) => row.status))].map((status) => <option key={status}>{status}</option>)}</select></label>
    <div className="overflow-x-auto rounded-2xl border border-[#2b3139] bg-[#1e2329]"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-[#0b0e11] text-[#848e9c]"><tr>{['Parite', 'Yön', 'Tip', 'Fiyat / Tetikleme', 'Miktar / Gerçekleşen', 'Durum', 'Reduce-only', 'İşlem'].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>
      {!visible.length ? <tr><td colSpan={8} className="p-8 text-center text-[#848e9c]">{loading ? 'Emirler yükleniyor…' : error ? 'Emir bilgisi doğrulanamadı.' : !accountId ? 'Üst menüden hesap seçin.' : rows.length ? 'Filtreye uygun emir yok.' : 'Seçili hesapta açık emir yok.'}</td></tr> : visible.map((row) => <tr key={`${row.symbol}:${row.exchangeOrderId || row.clientOrderId}`} className="border-t border-[#2b3139]">
        <td className="p-3 font-bold">{row.symbol}</td><td className="p-3">{row.side}</td><td className="p-3">{row.type}</td><td className="p-3">{row.price ?? '—'} / {row.stopPrice ?? '—'}</td><td className="p-3">{row.quantity} / {row.executedQuantity}</td><td className="p-3">{row.status}</td><td className="p-3">{row.reduceOnly ? 'Evet' : 'Hayır'}</td><td className="p-3"><button type="button" disabled={working || loading || Boolean(error) || !canCancelProOrder(row)} onClick={() => void cancel([row])} className="flex items-center gap-1 text-[#f84960] disabled:opacity-40"><Trash2 size={14}/> {working ? 'İşleniyor…' : 'İptal et'}</button></td>
      </tr>)}
    </tbody></table></div>
  </section>;
}
