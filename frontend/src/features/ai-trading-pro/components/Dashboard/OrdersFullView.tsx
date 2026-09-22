import { useEffect, useRef, useState } from 'react';
import { Clock, RefreshCw, Trash2 } from 'lucide-react';
import { cancelExchangeOrder as cancelOrder, getExchangeOrders, editExchangeOrder, type ProExchangeOrder as OpenOrder } from '../../services/exchangeOrders';
import { getApiErrorMessage } from '../../../../services/apiClient';
import { subscribeTradingEvents } from '../../../../services/tradingEvents';

export function canCancelProOrder(order: OpenOrder) {
  return order.canCancel !== false && Boolean(order.exchangeOrderId) && !order.pending && ['OPEN', 'NEW', 'PARTIALLY_FILLED'].includes(order.status);
}

export function OrdersFullView({ accountId, accountName }: { accountId: string | null; accountName?: string }) {
  const [snapshot, setSnapshot] = useState<{ accountId: string | null; rows: OpenOrder[] }>({ accountId, rows: [] });
  const [loading, setLoading] = useState(Boolean(accountId));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [working, setWorking] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<OpenOrder | null>(null);
  const [editValue, setEditValue] = useState('');
  const [market, setMarket] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
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
        const next = await getExchangeOrders(accountId);
        if (active) { setSnapshot({ accountId, rows: next.rows }); setMarket(next.accountType); setUpdatedAt(next.fetchedAt); setError(''); }
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

  async function saveEdit() {
    if (!accountId || !editing || working || loading || error || !Number.isFinite(Number(editValue)) || Number(editValue) <= 0) return;
    setWorking(true); setNotice('');
    try {
      await editExchangeOrder(accountId, editing, editValue);
      if (mounted.current) { setNotice('Fiyat değişikliği gönderildi. Borsa emirleri yeniden kontrol ediliyor.'); setEditing(null); }
    } catch (reason) { if (mounted.current) { setNotice(getApiErrorMessage(reason, 'Fiyat değişikliği doğrulanamadı. Emir durumunu kontrol edin.')); setEditing(null); } }
    finally { if (mounted.current) { setWorking(false); setRevision(v => v + 1); } }
  }

  return <section id="orders-full-view" className="space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#2b3139] bg-[#1e2329] p-5">
      <div><h1 className="flex items-center gap-2 text-xl font-bold"><Clock size={22}/> Açık Emirler</h1><p className="mt-1 text-xs text-[#848e9c]">{accountName ?? 'Hesap seçilmedi'} · Üstte seçilen hesabın borsadaki emirleri</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={!accountId || loading || working} onClick={() => setRevision((value) => value + 1)} className="flex items-center gap-2 rounded-lg border border-[#2b3139] px-3 py-2 text-xs text-[#00d2ff] disabled:opacity-40"><RefreshCw size={15}/> Yenile</button>
        <button type="button" disabled={!accountId || loading || working || Boolean(error) || !rows.some(canCancelProOrder)} onClick={() => void cancel(rows.filter(canCancelProOrder))} className="rounded-lg border border-[#f84960]/40 px-3 py-2 text-xs text-[#f84960] disabled:opacity-40">Tüm açık emirleri iptal et</button></div>
    </header>
    <p className="text-xs text-[#848e9c]">Koruma emrini iptal etmek pozisyonu kapatmaz. Botun koruma yönetimi aktifse SL/TP emirleri yeniden oluşturulabilir.</p>
    <p className="text-xs text-[#848e9c]">{market === 'SPOT' ? 'Spot' : market ? 'Vadeli' : 'Seçili hesap'} · Bekleyen ve kısmen gerçekleşmiş emirler; TP/SL dahildir. Tamamen gerçekleşen emirler bu listede gösterilmez. {updatedAt && `Son okuma: ${new Date(updatedAt).toLocaleString('tr-TR')}`}</p>
    {error && <p role="alert" className="rounded-xl bg-[#f84960]/10 p-3 text-sm text-[#f84960]">{error}{rows.length > 0 && ' Son başarılı okumadaki emirler gösteriliyor; güncel olmayabilir.'}</p>}
    {notice && <p role="status" className="rounded-xl bg-[#00d2ff]/10 p-3 text-sm text-[#00d2ff]">{notice}</p>}
    <label className="flex items-center gap-2 text-xs text-[#848e9c]">Durum<select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-[#2b3139] bg-[#0b0e11] p-2"><option value="ALL">Tümü</option>{[...new Set(rows.map((row) => row.status))].map((status) => <option key={status}>{status}</option>)}</select></label>
    <div className="overflow-x-auto rounded-2xl border border-[#2b3139] bg-[#1e2329]"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-[#0b0e11] text-[#848e9c]"><tr>{['Parite', 'Yön', 'Tip', 'Fiyat / Tetikleme', 'Miktar / Gerçekleşen', 'Durum', 'Reduce-only', 'İşlem'].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>
      {!visible.length ? <tr><td colSpan={8} className="p-8 text-center text-[#848e9c]">{loading ? 'Emirler yükleniyor…' : error ? 'Emir bilgisi doğrulanamadı.' : !accountId ? 'Üst menüden hesap seçin.' : rows.length ? 'Filtreye uygun emir yok.' : 'Seçili hesapta açık emir yok.'}</td></tr> : visible.map((row) => <tr key={`${row.symbol}:${row.exchangeOrderId || row.clientOrderId}`} className="border-t border-[#2b3139]">
        <td className="p-3 font-bold">{row.symbol}</td><td className="p-3">{row.side}</td><td className="p-3">{row.type}</td><td className="p-3">{row.price ?? '—'} / {row.stopPrice ?? '—'}</td><td className="p-3">{row.quantity} / {row.executedQuantity}</td><td className="p-3">{row.status}</td><td className="p-3">{row.reduceOnly ? 'Evet' : 'Hayır'}</td><td className="p-3"><button type="button" title={row.editReason} disabled={working || loading || Boolean(error) || !row.canEdit} onClick={() => { setEditing(row); setEditValue(row.type === 'LIMIT' ? row.price ?? '' : row.stopPrice ?? ''); }} className="mb-2 text-[#00d2ff] disabled:opacity-40">Fiyatı düzenle</button><button type="button" disabled={working || loading || Boolean(error) || !canCancelProOrder(row)} onClick={() => void cancel([row])} className="flex items-center gap-1 text-[#f84960] disabled:opacity-40"><Trash2 size={14}/> {working ? 'İşleniyor…' : 'İptal et'}</button></td>
      </tr>)}
    </tbody></table></div>
    {editing && <div role="dialog" aria-modal="true" aria-labelledby="edit-order-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"><div className="w-full max-w-md space-y-4 rounded-xl border border-[#2b3139] bg-[#1e2329] p-5"><h2 id="edit-order-title">{editing.symbol} · {editing.type}</h2><label className="block text-sm">{editing.type === 'LIMIT' ? 'Yeni limit fiyatı' : 'Yeni TP/SL tetik fiyatı'}<input autoFocus disabled={working} inputMode="decimal" value={editValue} onChange={e => setEditValue(e.target.value)} className="mt-2 w-full rounded border border-[#2b3139] bg-[#0b0e11] p-2"/></label><p className="text-xs text-[#848e9c]">Değişiklik eski emrin iptal edilip yeni fiyatla yeniden gönderilmesiyle uygulanır. Arada koruma boşluğu oluşabilir. Yeni emir reddedilirse eski emir iptal edilmiş kalabilir.</p><div className="flex justify-end gap-4"><button disabled={working} onClick={() => setEditing(null)}>Vazgeç</button><button disabled={working || loading || Boolean(error) || !Number.isFinite(Number(editValue)) || Number(editValue) <= 0} onClick={() => void saveEdit()} className="rounded bg-[#f0b90b] px-3 py-2 text-black disabled:opacity-40">{working ? 'İşleniyor…' : 'Onayla ve değiştir'}</button></div></div></div>}
  </section>;
}
