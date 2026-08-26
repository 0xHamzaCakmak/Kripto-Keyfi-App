import { useCallback, useEffect, useState } from 'react';
import { FileClock, LoaderCircle, RefreshCw, TrendingUp, Wifi, WifiOff, X } from 'lucide-react';
import { getApiErrorMessage } from '../services/apiClient';
import { cancelOrder, closeOpenPosition, getOpenOrders, getOpenPositions, getTradingAccounts, getTradingExecutionProfile, updateTradingExecutionProfile, type OpenOrder, type OpenPosition, type TradingAccount, type TradingExecutionProfile } from '../services/tradingService';
import { subscribeTradingEvents, type TradingStreamStatus } from '../services/tradingEvents';

export function OpenOrdersPage() {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]); const [accountId, setAccountId] = useState('');
  const [rows, setRows] = useState<OpenOrder[]>([]); const [loading, setLoading] = useState(true); const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [streamStatus, setStreamStatus] = useState<TradingStreamStatus>('OFFLINE');
  useEffect(() => { getTradingAccounts().then((items) => { setAccounts(items); setAccountId(items[0]?.id ?? ''); }).catch((reason) => setError(getApiErrorMessage(reason, 'Hesaplar alınamadı.'))); }, []);
  const load = useCallback(async () => { if (!accountId) { setRows([]); setLoading(false); return; } setLoading(true); setError(''); try { setRows(await getOpenOrders(accountId)); } catch (reason) { setError(getApiErrorMessage(reason, 'Açık emirler alınamadı.')); } finally { setLoading(false); } }, [accountId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!accountId) { setStreamStatus('OFFLINE'); return; }
    return subscribeTradingEvents(accountId, (event) => {
      const status = typeof event.payload.status === 'string' ? event.payload.status : '';
      const exchangeOrderId = typeof event.payload.exchangeOrderId === 'string' ? event.payload.exchangeOrderId : event.aggregateId;
      if (event.aggregateType === 'ORDER' && status === 'CANCELING' && exchangeOrderId) {
        setRows((current) => current.map((row) => row.exchangeOrderId === exchangeOrderId ? { ...row, status } : row));
        return;
      }
      if (event.topic === 'trading.snapshot' && Array.isArray(event.payload.orders)) {
        setRows(event.payload.orders as OpenOrder[]);
        return;
      }
      if (event.topic === 'trading.order') void load();
    }, setStreamStatus);
  }, [accountId, load]);
  async function cancel(row: OpenOrder) { if (!window.confirm(`${row.symbol} emrini iptal etmek istiyor musunuz?`)) return; setWorkingId(row.exchangeOrderId); setError(''); try { await cancelOrder(accountId, row); setNotice('Emir iptal edildi.'); await load(); } catch (reason) { setError(getApiErrorMessage(reason, 'Emir iptal edilemedi.')); } finally { setWorkingId(''); } }
  return <ActivityShell title="Açık Emirler" subtitle="Borsadaki aktif testnet/demo emirleri doğrudan görüntülenir." icon={FileClock} accounts={accounts} accountId={accountId} setAccountId={setAccountId} loading={loading} refresh={() => void load()} error={error} notice={notice} streamStatus={streamStatus}>
    <div className="mb-4 rounded-2xl border border-tertiary/20 bg-tertiary/5 p-4 text-xs leading-5 text-on-surface-variant">Buradan bir SL/TP koruma emrini iptal etmek pozisyonu kapatmaz. Pozisyon açık kaldığı sürece güvenlik motoru eksik koruma emrini yeniden kurar. İşlemi bitirmek için <strong className="text-white">Açık Pozisyonlar → İşlemi sonlandır</strong> akışını kullanın.</div>
    {rows.length === 0 ? <Empty text="Bu hesapta açık emir bulunmuyor."/> : <div className="overflow-x-auto rounded-2xl border border-outline/10"><table className="w-full min-w-[900px] text-left text-sm"><thead><tr className="bg-surface-high text-[10px] font-black uppercase tracking-wider text-outline"><Th>Parite</Th><Th>Yön</Th><Th>Tip</Th><Th>Miktar</Th><Th>Gerçekleşen</Th><Th>Fiyat / Tetik</Th><Th>Durum</Th><Th/></tr></thead><tbody>{rows.map((row) => { const transitional = ['SUBMITTING', 'CANCELING', 'CLOSING', 'RECONCILIATION_REQUIRED'].includes(row.status); return <tr key={row.exchangeOrderId} className="border-t border-outline/10 text-on-surface-variant"><Td strong>{row.symbol}</Td><Td tone={row.side === 'BUY' ? 'positive' : 'negative'}>{row.side}</Td><Td>{row.type}</Td><Td>{fmt(row.quantity)}</Td><Td>{fmt(row.executedQuantity)}</Td><Td>{row.price ? fmt(row.price) : 'Piyasa'}{row.stopPrice ? ` / ${fmt(row.stopPrice)}` : ''}</Td><Td><StateBadge status={row.status}/></Td><Td><button disabled={workingId === row.exchangeOrderId || transitional || row.pending} onClick={() => void cancel(row)} className="rounded-lg bg-error/10 px-3 py-2 text-xs font-black text-error disabled:opacity-50">{row.status === 'CANCELING' || workingId === row.exchangeOrderId ? 'İptal ediliyor…' : row.status === 'SUBMITTING' ? 'Gönderiliyor…' : 'İptal et'}</button></Td></tr>; })}</tbody></table></div>}
  </ActivityShell>;
}

export function OpenPositionsPage() {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]); const [accountId, setAccountId] = useState('');
  const [rows, setRows] = useState<OpenPosition[]>([]); const [loading, setLoading] = useState(true); const [workingId, setWorkingId] = useState('');
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<OpenPosition | null>(null);
  const [profile, setProfile] = useState<TradingExecutionProfile | null>(null);
  const [profileForm, setProfileForm] = useState<TradingExecutionProfile>({ minLeverage: 5, maxLeverage: 20, botAllocationUsdt: '500', minInitialMarginUsdt: '100', maxOrderNotional: '2000', maxInitialMargin: '500', maxAccountOpenNotional: '10000', stopLossBps: 300, takeProfitBps: 300, maxOrdersPerMinute: 60 });
  const [profileSaving, setProfileSaving] = useState(false);
  const [closeType, setCloseType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [closeQuantity, setCloseQuantity] = useState('');
  const [closePrice, setClosePrice] = useState('');
  const [streamStatus, setStreamStatus] = useState<TradingStreamStatus>('OFFLINE');
  useEffect(() => { getTradingAccounts().then((items) => { setAccounts(items); setAccountId(items[0]?.id ?? ''); }).catch((reason) => setError(getApiErrorMessage(reason, 'Hesaplar alınamadı.'))); }, []);
  const load = useCallback(async () => { if (!accountId) { setRows([]); setProfile(null); setLoading(false); return; } setLoading(true); setError(''); try { const [positions, executionProfile] = await Promise.all([getOpenPositions(accountId), getTradingExecutionProfile(accountId)]); setRows(positions); setProfile(executionProfile); setProfileForm(executionProfile); } catch (reason) { setError(getApiErrorMessage(reason, 'Pozisyonlar ve merkezi execution ayarları alınamadı.')); } finally { setLoading(false); } }, [accountId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!accountId) { setStreamStatus('OFFLINE'); return; }
    return subscribeTradingEvents(accountId, (event) => {
      const status = typeof event.payload.status === 'string' ? event.payload.status : '';
      const positionKey = typeof event.payload.positionKey === 'string' ? event.payload.positionKey : event.aggregateId;
      if (event.aggregateType === 'POSITION' && status === 'CLOSING' && positionKey) {
        setRows((current) => current.map((row) => row.positionKey === positionKey ? { ...row, lifecycleStatus: 'CLOSING' } : row));
        return;
      }
      if (event.aggregateType === 'POSITION' && status === 'CLOSE_FAILED' && positionKey) {
        setRows((current) => current.map((row) => row.positionKey === positionKey ? { ...row, lifecycleStatus: 'CLOSE_FAILED' } : row));
        return;
      }
      if (event.topic === 'trading.snapshot' && Array.isArray(event.payload.positions)) {
        setRows(event.payload.positions as OpenPosition[]);
        return;
      }
      if (event.topic === 'trading.position' || event.topic === 'trading.account') void load();
    }, setStreamStatus);
  }, [accountId, load]);
  function openClosePanel(row: OpenPosition) {
    setSelected(row);
    setCloseType('MARKET');
    setCloseQuantity(row.quantity.replace('-', ''));
    setClosePrice(row.markPrice);
    setError('');
  }
  async function close() {
    if (!selected) return;
    setWorkingId(selected.positionKey); setError('');
    try {
      await closeOpenPosition(accountId, selected, { type: closeType, quantity: closeQuantity, ...(closeType === 'LIMIT' ? { price: closePrice } : {}) });
      setNotice(closeType === 'MARKET' ? `${selected.symbol} reduce-only piyasa kapatma emri borsaya iletildi.` : `${selected.symbol} reduce-only limit kapatma emri borsaya iletildi; Açık Emirler bölümünden izlenebilir.`);
      setSelected(null); await load();
    } catch (reason) { setError(getApiErrorMessage(reason, 'Pozisyon kapatılamadı.')); } finally { setWorkingId(''); }
  }
  async function saveExecutionProfile() {
    if (profileForm.minLeverage > profileForm.maxLeverage) { setError('Asgari kaldıraç azami kaldıracı aşamaz.'); return; }
    if (profileForm.stopLossBps < 50 || profileForm.stopLossBps > 300) { setError('TESTNET stop-loss fiyat hareketi %0,5 ile %3 arasında olmalıdır.'); return; }
    if (profileForm.takeProfitBps < 50 || profileForm.takeProfitBps > 5000) { setError('TESTNET take-profit fiyat hareketi %0,5 ile %50 arasında olmalıdır.'); return; }
    if (profileForm.maxOrdersPerMinute < 1 || profileForm.maxOrdersPerMinute > 1000) { setError('Dakikadaki azami emir sayısı 1 ile 1000 arasında olmalıdır.'); return; }
    if (!window.confirm('Bu değerler PAPER, TESTNET, manuel işlemler ve ileride güvenlik kapısı açılan LIVE işlemler için merkezi Risk Engine profiline kaydedilsin mi?')) return;
    setProfileSaving(true); setError(''); setNotice('');
    try {
      const updated = await updateTradingExecutionProfile(accountId, profileForm);
      setProfile(updated); setProfileForm(updated);
      setNotice('Merkezi bot sermayesi, kaldıraç ve TESTNET SL/TP hedefleri kaydedildi. Açık pozisyonların kaldıracı değiştirilmez; koruma hedefleri motorun bir sonraki güvenli çevriminde doğrulanır.');
    } catch (reason) { setError(getApiErrorMessage(reason, 'Execution ayarları kaydedilemedi.')); }
    finally { setProfileSaving(false); }
  }
  return <ActivityShell title="Açık Pozisyonlar" subtitle="Vadeli pozisyonlar borsadan okunur; kapatma emirleri her zaman reduce-only gönderilir." icon={TrendingUp} accounts={accounts} accountId={accountId} setAccountId={setAccountId} loading={loading} refresh={() => void load()} error={error} notice={notice} streamStatus={streamStatus}>
    {profile && <section className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-5"><div><h2 className="font-headline text-lg font-black text-white">Merkezi bot execution ayarları</h2><p className="mt-1 text-xs leading-5 text-on-surface-variant">PAPER, Binance TESTNET, manuel emirler ve ileride ayrıca yetkilendirilecek LIVE botlar aynı veritabanı Risk profilini kullanır. LIVE işlem bu ayarla otomatik açılmaz.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><ExecutionField label="Asgari kaldıraç" value={profileForm.minLeverage} min={5} max={20} onChange={(value) => setProfileForm((current) => ({ ...current, minLeverage: Number(value) }))}/><ExecutionField label="Azami kaldıraç" value={profileForm.maxLeverage} min={5} max={20} onChange={(value) => setProfileForm((current) => ({ ...current, maxLeverage: Number(value) }))}/><ExecutionField label="TESTNET stop-loss fiyat hareketi (%)" value={profileForm.stopLossBps / 100} min={0.5} max={3} step={0.1} onChange={(value) => setProfileForm((current) => ({ ...current, stopLossBps: Math.round(Number(value) * 100) }))}/><ExecutionField label="TESTNET take-profit fiyat hareketi (%)" value={profileForm.takeProfitBps / 100} min={0.5} max={50} step={0.1} onChange={(value) => setProfileForm((current) => ({ ...current, takeProfitBps: Math.round(Number(value) * 100) }))}/><ExecutionField label="Dakikada azami emir (hesap)" value={profileForm.maxOrdersPerMinute} min={1} max={1000} onChange={(value) => setProfileForm((current) => ({ ...current, maxOrdersPerMinute: Number(value) }))}/><ExecutionField label="Bot başına teminat kotası (USDT)" value={profileForm.botAllocationUsdt} onChange={(value) => setProfileForm((current) => ({ ...current, botAllocationUsdt: String(value) }))}/><ExecutionField label="Asgari işlem teminatı (USDT)" value={profileForm.minInitialMarginUsdt} onChange={(value) => setProfileForm((current) => ({ ...current, minInitialMarginUsdt: String(value) }))}/><ExecutionField label="Emir başına azami notional" value={profileForm.maxOrderNotional} onChange={(value) => setProfileForm((current) => ({ ...current, maxOrderNotional: String(value) }))}/><ExecutionField label="Emir başına azami teminat" value={profileForm.maxInitialMargin} onChange={(value) => setProfileForm((current) => ({ ...current, maxInitialMargin: String(value) }))}/><ExecutionField label="Hesap açık notional limiti" value={profileForm.maxAccountOpenNotional} onChange={(value) => setProfileForm((current) => ({ ...current, maxAccountOpenNotional: String(value) }))}/><button type="button" disabled={profileSaving} onClick={() => void saveExecutionProfile()} className="self-end rounded-xl bg-primary px-4 py-3 text-sm font-black text-on-primary disabled:opacity-50">{profileSaving ? 'Kaydediliyor…' : 'Tüm botlara uygula'}</button></div><p className="mt-3 text-xs leading-5 text-outline">SL/TP değerleri kaldıraçlı ROI değil, giriş fiyatına göre gerçek fiyat hareketidir. Örnek: 5x kaldıraçta %2 fiyat hareketi yaklaşık %10 brüt ROI görünümü oluşturur. Dakikalık emir sınırı yalnızca yazma işlemlerini sınırlar; piyasa ve snapshot okumaları ayrı çağrılardır. Açık pozisyonların kaldıracı zorla değiştirilmez.</p></section>}
    {rows.length === 0 ? <Empty text="Bu hesapta açık pozisyon bulunmuyor."/> : <div className="overflow-x-auto rounded-2xl border border-outline/10"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="bg-surface-high text-[10px] font-black uppercase tracking-wider text-outline"><Th>Parite</Th><Th>Yön</Th><Th>Miktar</Th><Th>Giriş</Th><Th>Mark</Th><Th>Likidasyon</Th><Th>PnL</Th><Th>Margin</Th><Th/></tr></thead><tbody>{rows.map((row) => <tr key={row.positionKey} className="border-t border-outline/10 text-on-surface-variant"><Td strong>{row.symbol}</Td><Td tone={row.side === 'LONG' ? 'positive' : 'negative'}>{row.side}</Td><Td>{fmt(row.quantity)}</Td><Td>{fmt(row.entryPrice)}</Td><Td>{fmt(row.markPrice)}</Td><Td>{row.liquidationPrice ? fmt(row.liquidationPrice) : '—'}</Td><Td tone={Number(row.unrealizedPnl) >= 0 ? 'positive' : 'negative'}>{fmt(row.unrealizedPnl)} USDT</Td><Td>{row.leverage}x · {row.marginMode}{row.lifecycleStatus && <span className="mt-1 block"><StateBadge status={row.lifecycleStatus}/></span>}</Td><Td><button disabled={workingId === row.positionKey || row.lifecycleStatus === 'CLOSING'} onClick={() => openClosePanel(row)} className="rounded-lg bg-error/10 px-3 py-2 text-xs font-black text-error disabled:opacity-50">{workingId === row.positionKey || row.lifecycleStatus === 'CLOSING' ? 'Kapatılıyor…' : 'İşlemi sonlandır'}</button></Td></tr>)}</tbody></table></div>}
    {selected && <div className="fixed inset-0 z-50 flex justify-end bg-black/70" onMouseDown={() => setSelected(null)}><aside className="h-full w-full max-w-lg overflow-y-auto border-l border-outline/20 bg-surface p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Reduce-only kapatma</p><h2 className="mt-2 font-headline text-2xl font-black text-white">{selected.symbol} · {selected.side}</h2></div><button type="button" onClick={() => setSelected(null)} className="rounded-xl bg-surface-high p-2 text-on-surface-variant"><X size={20}/></button></div>
      <div className="mt-6 grid grid-cols-2 gap-3 text-sm"><CloseMetric label="Açık miktar" value={fmt(selected.quantity.replace('-', ''))}/><CloseMetric label="Giriş fiyatı" value={fmt(selected.entryPrice)}/><CloseMetric label="Mark fiyatı" value={fmt(selected.markPrice)}/><CloseMetric label="Anlık PnL" value={`${fmt(selected.unrealizedPnl)} USDT`}/></div>
      <div className="mt-6 rounded-2xl border border-tertiary/20 bg-tertiary/5 p-4 text-xs leading-5 text-on-surface-variant">Kapatma emri yalnızca mevcut pozisyonu azaltır; ters yönde yeni pozisyon açamaz. Kapanıştan sonra bot aynı 15 dakikalık mumda yeniden giriş yapmaz ve yeni piyasa değerlendirmesini bekler.</div>
      <label className="mt-6 block text-xs font-black uppercase tracking-wider text-outline">Kapatma tipi</label><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setCloseType('MARKET')} className={`rounded-xl px-4 py-3 text-sm font-black ${closeType === 'MARKET' ? 'bg-primary text-on-primary' : 'bg-surface-high text-white'}`}>MARKET</button><button type="button" onClick={() => setCloseType('LIMIT')} className={`rounded-xl px-4 py-3 text-sm font-black ${closeType === 'LIMIT' ? 'bg-primary text-on-primary' : 'bg-surface-high text-white'}`}>LIMIT</button></div>
      <label className="mt-5 block text-xs font-black uppercase tracking-wider text-outline">Kapatılacak miktar</label><input className="input mt-2 w-full" inputMode="decimal" value={closeQuantity} onChange={(event) => setCloseQuantity(event.target.value)}/>
      {closeType === 'LIMIT' && <><label className="mt-5 block text-xs font-black uppercase tracking-wider text-outline">Limit fiyatı</label><input className="input mt-2 w-full" inputMode="decimal" value={closePrice} onChange={(event) => setClosePrice(event.target.value)}/><p className="mt-2 text-xs text-on-surface-variant">Limit emir gerçekleşene veya iptal edilene kadar Açık Emirler bölümünde kalır.</p></>}
      <button type="button" disabled={workingId === selected.positionKey || !closeQuantity || (closeType === 'LIMIT' && !closePrice)} onClick={() => void close()} className="mt-8 w-full rounded-xl bg-error px-5 py-4 text-sm font-black text-white disabled:opacity-50">{workingId === selected.positionKey ? 'Borsaya iletiliyor…' : `${closeType} kapatma emrini gönder`}</button>
    </aside></div>}
  </ActivityShell>;
}

function CloseMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-surface-high p-3"><p className="text-[10px] font-black uppercase tracking-wider text-outline">{label}</p><p className="mt-1 font-black text-white">{value}</p></div>; }
function ExecutionField({ label, value, onChange, min = 1, max, step = 1 }: { label: string; value: string | number; onChange: (value: string) => void; min?: number; max?: number; step?: number }) { return <label className="text-xs font-bold text-on-surface-variant">{label}<input type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-outline/15 bg-background/70 p-3 text-white"/></label>; }

function ActivityShell({ title, subtitle, icon: Icon, accounts, accountId, setAccountId, loading, refresh, error, notice, streamStatus, children }: { title: string; subtitle: string; icon: React.ComponentType<{ size?: number }>; accounts: TradingAccount[]; accountId: string; setAccountId: (id: string) => void; loading: boolean; refresh: () => void; error: string; notice: string; streamStatus: TradingStreamStatus; children: React.ReactNode }) {
  return <div className="space-y-6"><header className="flex flex-col gap-5 rounded-[30px] border border-outline/10 bg-surface p-6 md:flex-row md:items-end md:justify-between md:p-8"><div><div className="flex flex-wrap items-center gap-2 text-primary"><Icon size={20}/><span className="text-xs font-black uppercase tracking-[0.2em]">Trading Bot / Faz 4</span><LiveStatus status={streamStatus}/></div><h1 className="mt-3 font-headline text-3xl font-black text-white md:text-4xl">{title}</h1><p className="mt-3 text-sm text-on-surface-variant">{subtitle}</p></div><div className="flex flex-col gap-2 sm:flex-row"><select className="input min-w-56" value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Hesap seçin</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.provider}</option>)}</select><button onClick={refresh} disabled={loading || !accountId} className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? <LoaderCircle className="animate-spin" size={17}/> : <RefreshCw size={17}/>} Yenile</button></div></header>{error && <div className="rounded-2xl border border-error/20 bg-error/10 p-4 text-error">{error}</div>}{notice && <div className="rounded-2xl border border-secondary/20 bg-secondary/10 p-4 text-secondary">{notice}</div>}<section className="rounded-[28px] border border-outline/10 bg-surface p-4 md:p-6">{loading ? <div className="h-40 animate-pulse rounded-2xl bg-surface-high"/> : children}</section></div>;
}
function Empty({ text }: { text: string }) { return <p className="py-14 text-center text-sm text-on-surface-variant">{text}</p>; }
function Th({ children }: { children?: React.ReactNode }) { return <th className="px-4 py-3">{children}</th>; }
function Td({ children, strong, tone }: { children: React.ReactNode; strong?: boolean; tone?: 'positive' | 'negative' }) { return <td className={`whitespace-nowrap px-4 py-3 ${strong ? 'font-black text-white' : ''} ${tone === 'positive' ? 'font-bold text-secondary' : tone === 'negative' ? 'font-bold text-error' : ''}`}>{children}</td>; }
function fmt(value: string) { const number = Number(value); return Number.isFinite(number) ? new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 8 }).format(number) : value; }
function LiveStatus({ status }: { status: TradingStreamStatus }) { const live = status === 'LIVE'; return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${live ? 'bg-secondary/10 text-secondary' : 'bg-tertiary/10 text-tertiary'}`}>{live ? <Wifi size={11}/> : <WifiOff size={11}/>} {live ? 'Canlı' : status === 'RECONNECTING' ? 'Yeniden bağlanıyor' : status === 'CONNECTING' ? 'Bağlanıyor' : 'Çevrimdışı'}</span>; }
function StateBadge({ status }: { status: string }) { const pending = ['SUBMITTING', 'CANCELING', 'CLOSING'].includes(status); return <span className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-black ${pending ? 'bg-tertiary/10 text-tertiary' : status.includes('FAILED') || status === 'RECONCILIATION_REQUIRED' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>{status}</span>; }
