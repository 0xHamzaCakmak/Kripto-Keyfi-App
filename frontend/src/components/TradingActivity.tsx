import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CircleHelp, FileClock, LoaderCircle, RefreshCw, TrendingUp, Wifi, WifiOff, X } from 'lucide-react';
import { getApiErrorMessage } from '../services/apiClient';
import { cancelOrder, closeOpenPosition, getOpenOrders, getOpenPositions, getTradingAccounts, getTradingExecutionProfile, updateTradingExecutionProfile, type OpenOrder, type OpenPosition, type TradingAccount, type TradingExecutionProfile } from '../services/tradingService';
import { subscribeTradingEvents, type TradingStreamStatus } from '../services/tradingEvents';
import { aiTradingApi, type TestnetAccountSummary } from '../services/aiTradingService';
import { TestnetBalanceStrip } from './ai-trading/TestnetBalanceStrip';

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
  const [testnetAccount, setTestnetAccount] = useState<TestnetAccountSummary | null>(null);
  const [profileForm, setProfileForm] = useState<TradingExecutionProfile>({ minLeverage: 5, maxLeverage: 20, botAllocationUsdt: '500', minInitialMarginUsdt: '100', maxOrderNotional: '2000', maxInitialMargin: '500', maxAccountOpenNotional: '10000', stopLossBps: 300, takeProfitBps: 100, maxOrdersPerMinute: 60, maxDailyOrders: 5000, entryPaused: false });
  const [profileSaving, setProfileSaving] = useState(false);
  const [closeType, setCloseType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [closeQuantity, setCloseQuantity] = useState('');
  const [closePrice, setClosePrice] = useState('');
  const [streamStatus, setStreamStatus] = useState<TradingStreamStatus>('OFFLINE');
  useEffect(() => { getTradingAccounts().then((items) => { setAccounts(items); setAccountId(items[0]?.id ?? ''); }).catch((reason) => setError(getApiErrorMessage(reason, 'Hesaplar alınamadı.'))); }, []);
  const load = useCallback(async () => { if (!accountId) { setRows([]); setProfile(null); setTestnetAccount(null); setLoading(false); return; } setLoading(true); setError(''); try { const [positions, executionProfile, accountSummary] = await Promise.all([getOpenPositions(accountId), getTradingExecutionProfile(accountId), aiTradingApi.testnetAccountSummary().catch(() => null)]); setRows(positions); setProfile(executionProfile); setProfileForm(executionProfile); setTestnetAccount(accountSummary?.data ?? null); } catch (reason) { setError(getApiErrorMessage(reason, 'Pozisyonlar ve merkezi execution ayarları alınamadı.')); } finally { setLoading(false); } }, [accountId]);
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
    if (profileForm.stopLossBps < 50 || profileForm.stopLossBps > 1000) { setError('TESTNET stop-loss fiyat hareketi %0,5 ile %10 arasında olmalıdır.'); return; }
    if (profileForm.takeProfitBps < 10 || profileForm.takeProfitBps > 5000) { setError('TESTNET net kâr hedefi %0,1 ile %50 arasında olmalıdır.'); return; }
    if (profileForm.maxOrdersPerMinute < 0) { setError('Dakikadaki azami emir sayısı negatif olamaz; 0 sınırsızdır.'); return; }
    if (profileForm.maxDailyOrders < 0) { setError('Günlük azami emir sayısı negatif olamaz; 0 sınırsızdır.'); return; }
    if (!window.confirm('Bu değerler TESTNET, manuel işlemler ve ileride güvenlik kapısı açılan LIVE işlemler için merkezi Risk Engine profiline kaydedilsin mi?')) return;
    setProfileSaving(true); setError(''); setNotice('');
    try {
      const updated = await updateTradingExecutionProfile(accountId, profileForm);
      setProfile(updated); setProfileForm(updated);
      setNotice('Merkezi bot sermayesi, kaldıraç ve TESTNET SL/TP hedefleri kaydedildi. Açık pozisyonların kaldıracı değiştirilmez; koruma hedefleri motorun bir sonraki güvenli çevriminde doğrulanır.');
    } catch (reason) { setError(getApiErrorMessage(reason, 'Execution ayarları kaydedilemedi.')); }
    finally { setProfileSaving(false); }
  }
  async function setEntryPaused(entryPaused: boolean) {
    const action = entryPaused ? 'otomatik işlemleri tamamen durdurmak' : 'otomatik işlemleri yeniden başlatmak';
    if (!window.confirm(`Tüm TESTNET botlarında ${action} istiyor musunuz? ${entryPaused ? 'Botlar açık pozisyonlara ve mevcut emirlere dokunmayacak.' : 'Botlar kaldıkları yerden devam edecek.'}`)) return;
    setProfileSaving(true); setError(''); setNotice('');
    try {
      // Starting/stopping is an independent control. Do not resend unsaved
      // execution form drafts, because an unrelated invalid field must not
      // prevent the operator from changing the runtime state.
      const updated = await updateTradingExecutionProfile(accountId, { entryPaused });
      setProfile(updated); setProfileForm(updated);
      setNotice(entryPaused
        ? 'Otomatik işlemler durduruldu. Yeni emir girişi yapılmayacak ve botlar açık pozisyonlara dokunmayacak.'
        : 'Otomatik işlemler yeniden başlatıldı. Botlar mevcut durumlarından devam edecek.');
    } catch (reason) { setError(getApiErrorMessage(reason, 'Bot işlem durumu değiştirilemedi.')); }
    finally { setProfileSaving(false); }
  }
  return <ActivityShell title="Açık Pozisyonlar" subtitle="Vadeli pozisyonlar borsadan okunur; kapatma emirleri her zaman reduce-only gönderilir." icon={TrendingUp} accounts={accounts} accountId={accountId} setAccountId={setAccountId} loading={loading} refresh={() => void load()} error={error} notice={notice} noticeTone={profileForm.entryPaused ? 'warning' : 'success'} streamStatus={streamStatus}>
    {profile && <div className={`mb-5 rounded-2xl border p-4 text-sm font-bold ${profileForm.entryPaused ? 'border-error/30 bg-error/10 text-error' : 'border-secondary/30 bg-secondary/10 text-secondary'}`}>
      {profileForm.entryPaused
        ? 'Bot işlemleri başlatılmamış veya durdurulmuş: yeni emir girişi ve açık pozisyonlara otomatik müdahale kapalıdır.'
        : 'Bot işlemleri aktif: yeni emir girişi ve açık pozisyonların otomatik yönetimi açıktır.'}
    </div>}
    {accounts.find((account) => account.id === accountId)?.environment === 'TESTNET' && <TestnetBalanceStrip summary={testnetAccount} />}
    {profile && <section className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <div><h2 className="font-headline text-lg font-black text-white">Merkezi bot execution ayarları</h2><p className="mt-1 text-xs leading-5 text-on-surface-variant">PAPER, Binance TESTNET, manuel emirler ve ileride ayrıca yetkilendirilecek LIVE botlar aynı veritabanı Risk profilini kullanır. LIVE işlem bu ayarla otomatik açılmaz.</p></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ExecutionField label="Asgari kaldıraç" description="Bot yeni emir açarken bu değerin altında kaldıraç seçemez. Mevcut açık pozisyonların kaldıracı değiştirilmez." value={profileForm.minLeverage} min={5} max={20} onChange={(value) => setProfileForm((current) => ({ ...current, minLeverage: Number(value) }))}/><ExecutionField label="Azami kaldıraç" description="Botun yeni emirlerde kullanabileceği en yüksek kaldıraçtır. Kaldıraç yükseldikçe hem kâr hem zarar teminata göre büyür; asgari kaldıraçtan düşük olamaz." value={profileForm.maxLeverage} min={5} max={20} onChange={(value) => setProfileForm((current) => ({ ...current, maxLeverage: Number(value) }))}/>
        <ExecutionField label="TESTNET stop-loss fiyat hareketi (%)" description="Ortalama giriş fiyatından ters yöndeki gerçek fiyat hareketidir; kaldıraçlı ROI değildir. Örneğin %10 stop ve 5x kaldıraç yaklaşık %50 teminat kaybı oluşturabilir. Değişiklik açık pozisyonların koruma emirlerine sonraki güvenli çevrimde uygulanabilir." value={profileForm.stopLossBps / 100} min={0.5} max={10} step={0.1} onChange={(value) => setProfileForm((current) => ({ ...current, stopLossBps: Math.round(Number(value) * 100) }))}/><ExecutionField label="TESTNET net kâr hedefi (%)" description="Giriş fiyatına göre maliyetlerden sonra amaçlanan gerçek fiyat hareketidir; kaldıraçlı ROI değildir. Örneğin %0,1 fiyat hareketi 20x kaldıraçta maliyetlerden önce yaklaşık %2 ROE eder. Motor tahmini giriş/çıkış maliyeti için şu anda %0,20 tampon ekler; %0,1 net hedefte borsa tetik fiyatı yaklaşık %0,3 uzağa kurulur." value={profileForm.takeProfitBps / 100} min={0.1} max={50} step={0.1} onChange={(value) => setProfileForm((current) => ({ ...current, takeProfitBps: Math.round(Number(value) * 100) }))}/>
        <ExecutionField label="Günlük azami emir (hesap)" description="UTC gün içinde bu hesaba yazılan otomatik giriş, SL, TP ve sistem kapatma emirlerinin ortak uygulama sayacıdır. Mevcut sayaç yeni değere ulaştıysa yeni girişler gün sonuna kadar reddedilir. 0 uygulama limitini kapatır; borsanın kendi limitleri devam eder." value={profileForm.maxDailyOrders} min={0} onChange={(value) => setProfileForm((current) => ({ ...current, maxDailyOrders: Number(value) }))}/>
        <ExecutionField label="Dakikada azami emir (hesap)" description="Bu borsa hesabında bir dakikada yapılabilecek emir yazma işlemlerinin üst sınırıdır; 0 uygulama limitini kapatır. Yeni giriş, koruma, iptal veya değiştirme çağrıları bu bütçeyi tüketebilir; fiyat ve bakiye okumaları bu alana dahil değildir." value={profileForm.maxOrdersPerMinute} min={0} onChange={(value) => setProfileForm((current) => ({ ...current, maxOrdersPerMinute: Number(value) }))}/><ExecutionField label="Bot başına teminat kotası (USDT)" description="Her botun kullanabileceği toplam başlangıç teminatı bütçesidir. Bu tutarın tamamı tek emirde kullanılmak zorunda değildir ve 20 bot için hesap bakiyesinden bağımsız ayrı bir güvenlik tavanıdır." value={profileForm.botAllocationUsdt} onChange={(value) => setProfileForm((current) => ({ ...current, botAllocationUsdt: String(value) }))}/><ExecutionField label="Asgari işlem teminatı (USDT)" description="Yeni bir pozisyon için hedeflenen en düşük başlangıç teminatıdır. Yaklaşık notional, bu değer ile seçilen kaldıracın çarpımıdır; örneğin 50 USDT ve 5x yaklaşık 250 USDT notional üretir." value={profileForm.minInitialMarginUsdt} onChange={(value) => setProfileForm((current) => ({ ...current, minInitialMarginUsdt: String(value) }))}/><ExecutionField label="Emir başına azami notional" description="Tek bir emrin fiyat × miktar cinsinden azami büyüklüğüdür; 0 uygulama limitini kapatır. Teminat değildir; 100 USDT notional, 5x kaldıraçta yaklaşık 20 USDT başlangıç teminatına karşılık gelir." value={profileForm.maxOrderNotional} onChange={(value) => setProfileForm((current) => ({ ...current, maxOrderNotional: String(value) }))}/><ExecutionField label="Emir başına azami teminat" description="Tek bir emrin kullanabileceği en yüksek başlangıç teminatıdır; 0 uygulama limitini kapatır. Yaklaşık olarak notional ÷ kaldıraç şeklinde hesaplanır ve bot kotasından ayrıca sınırlandırılır." value={profileForm.maxInitialMargin} onChange={(value) => setProfileForm((current) => ({ ...current, maxInitialMargin: String(value) }))}/><ExecutionField label="Hesap açık notional limiti" description="Bu hesaptaki tüm açık vadeli pozisyonların toplam mutlak notional büyüklüğü için tavandır; 0 uygulama limitini kapatır. Limit dolduğunda botlar yeni pozisyon açamaz; mevcut pozisyonlar ve reduce-only kapanışlar engellenmez." value={profileForm.maxAccountOpenNotional} onChange={(value) => setProfileForm((current) => ({ ...current, maxAccountOpenNotional: String(value) }))}/>
        <button type="button" disabled={profileSaving} onClick={() => void saveExecutionProfile()} className="self-end rounded-xl bg-primary px-4 py-3 text-sm font-black text-on-primary disabled:opacity-50">{profileSaving ? 'Kaydediliyor…' : 'Tüm botlara uygula'}</button>
      </div>
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={profileSaving} onClick={() => void setEntryPaused(!profileForm.entryPaused)} className={`rounded-xl border px-4 py-3 text-sm font-black disabled:opacity-40 ${profileForm.entryPaused ? 'border-primary/40 bg-primary/10 text-primary' : 'border-error/40 bg-error/10 text-error'}`}>{profileSaving ? 'İşleniyor…' : profileForm.entryPaused ? 'Yeni işlemleri başlat' : 'Yeni işlemleri durdur'}</button><span className="self-center text-xs font-bold text-on-surface-variant">Durum: {profileForm.entryPaused ? 'Şu anda yeni emir girişi yapılmamaktadır; açık pozisyonlara otomatik müdahale kapalıdır.' : 'Yeni emir girişleri ve otomatik pozisyon yönetimi aktiftir.'}</span></div>
      <p className="mt-3 text-xs leading-5 text-outline">Stop-loss ve net kâr hedefi giriş fiyatına göre gerçek fiyat hareketidir; ekrandaki yüzde ROE değildir. Net hedef, giriş ve çıkış maliyetleri için koruyucu tampon eklenerek borsaya gönderilir. Dakikalık ve günlük emir limitleri hesap genelindeki uygulama sayaçlarıdır; 0 sınırsızdır. Açık pozisyonların kaldıracı zorla değiştirilmez.</p>
    </section>}
    {rows.length === 0 ? <Empty text="Bu hesapta açık pozisyon bulunmuyor."/> : <div className="overflow-x-auto rounded-2xl border border-outline/10"><table className="w-full min-w-[980px] text-left text-sm"><thead><tr className="bg-surface-high text-[10px] font-black uppercase tracking-wider text-outline"><Th>Parite</Th><Th>Yön</Th><Th>Miktar</Th><Th>Giriş</Th><Th>Mark</Th><Th>Likidasyon</Th><Th>PnL</Th><Th>Margin</Th><Th/></tr></thead><tbody>{rows.map((row) => {
      const pnlPercentage = positionPnlPercentage(row);
      return <tr key={row.positionKey} className="border-t border-outline/10 text-on-surface-variant"><Td strong>{row.symbol}</Td><Td tone={row.side === 'LONG' ? 'positive' : 'negative'}>{row.side}</Td><Td>{fmtFixed(row.quantity, 3)}</Td><Td>{fmtFixed(row.entryPrice, 3)}</Td><Td>{fmtFixed(row.markPrice, 3)}</Td><Td>{row.liquidationPrice ? fmtFixed(row.liquidationPrice, 3) : '—'}</Td><Td tone={Number(row.unrealizedPnl) >= 0 ? 'positive' : 'negative'}>{fmtFixed(row.unrealizedPnl, 2)} USDT{pnlPercentage !== null ? ` (${fmtSignedPercent(pnlPercentage)})` : ''}</Td><Td>{row.leverage}x · {row.marginMode}{row.lifecycleStatus && <span className="mt-1 block"><StateBadge status={row.lifecycleStatus}/></span>}</Td><Td><button disabled={workingId === row.positionKey || row.lifecycleStatus === 'CLOSING'} onClick={() => openClosePanel(row)} className="rounded-lg bg-error/10 px-3 py-2 text-xs font-black text-error disabled:opacity-50">{workingId === row.positionKey || row.lifecycleStatus === 'CLOSING' ? 'Kapatılıyor…' : 'İşlemi sonlandır'}</button></Td></tr>;
    })}</tbody></table></div>}
    {selected && <div className="fixed inset-0 z-50 flex justify-end bg-black/70" onMouseDown={() => setSelected(null)}><aside className="h-full w-full max-w-lg overflow-y-auto border-l border-outline/20 bg-surface p-6 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Reduce-only kapatma</p><h2 className="mt-2 font-headline text-2xl font-black text-white">{selected.symbol} · {selected.side}</h2></div><button type="button" onClick={() => setSelected(null)} className="rounded-xl bg-surface-high p-2 text-on-surface-variant"><X size={20}/></button></div>
      <div className="mt-6 grid grid-cols-2 gap-3 text-sm"><CloseMetric label="Açık miktar" value={fmtFixed(selected.quantity.replace('-', ''), 3)}/><CloseMetric label="Giriş fiyatı" value={fmtFixed(selected.entryPrice, 3)}/><CloseMetric label="Mark fiyatı" value={fmtFixed(selected.markPrice, 3)}/><CloseMetric label="Anlık PnL" value={`${fmtFixed(selected.unrealizedPnl, 2)} USDT${positionPnlPercentage(selected) !== null ? ` (${fmtSignedPercent(positionPnlPercentage(selected)!)} ROI)` : ''}`}/></div>
      <div className="mt-6 rounded-2xl border border-tertiary/20 bg-tertiary/5 p-4 text-xs leading-5 text-on-surface-variant">Kapatma emri yalnızca mevcut pozisyonu azaltır; ters yönde yeni pozisyon açamaz. Kapanıştan sonra bot aynı 15 dakikalık mumda yeniden giriş yapmaz ve yeni piyasa değerlendirmesini bekler.</div>
      <label className="mt-6 block text-xs font-black uppercase tracking-wider text-outline">Kapatma tipi</label><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setCloseType('MARKET')} className={`rounded-xl px-4 py-3 text-sm font-black ${closeType === 'MARKET' ? 'bg-primary text-on-primary' : 'bg-surface-high text-white'}`}>MARKET</button><button type="button" onClick={() => setCloseType('LIMIT')} className={`rounded-xl px-4 py-3 text-sm font-black ${closeType === 'LIMIT' ? 'bg-primary text-on-primary' : 'bg-surface-high text-white'}`}>LIMIT</button></div>
      <label className="mt-5 block text-xs font-black uppercase tracking-wider text-outline">Kapatılacak miktar</label><input className="input mt-2 w-full" inputMode="decimal" value={closeQuantity} onChange={(event) => setCloseQuantity(event.target.value)}/>
      {closeType === 'LIMIT' && <><label className="mt-5 block text-xs font-black uppercase tracking-wider text-outline">Limit fiyatı</label><input className="input mt-2 w-full" inputMode="decimal" value={closePrice} onChange={(event) => setClosePrice(event.target.value)}/><p className="mt-2 text-xs text-on-surface-variant">Limit emir gerçekleşene veya iptal edilene kadar Açık Emirler bölümünde kalır.</p></>}
      <button type="button" disabled={workingId === selected.positionKey || !closeQuantity || (closeType === 'LIMIT' && !closePrice)} onClick={() => void close()} className="mt-8 w-full rounded-xl bg-error px-5 py-4 text-sm font-black text-white disabled:opacity-50">{workingId === selected.positionKey ? 'Borsaya iletiliyor…' : `${closeType} kapatma emrini gönder`}</button>
    </aside></div>}
  </ActivityShell>;
}

function CloseMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-surface-high p-3"><p className="text-[10px] font-black uppercase tracking-wider text-outline">{label}</p><p className="mt-1 font-black text-white">{value}</p></div>; }
function ExecutionField({ label, description, value, onChange, min = 1, max, step = 1 }: { label: string; description: string; value: string | number; onChange: (value: string) => void; min?: number; max?: number; step?: number }) {
  const inputId = useId();
  const focused = useRef(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { if (!focused.current) setDraft(String(value)); }, [value]);

  function normalize(raw: string) { return raw.replace(/^0+(?=\d)/, ''); }
  function change(raw: string) {
    const next = normalize(raw);
    setDraft(next);
    if (next !== '' && Number.isFinite(Number(next))) onChange(next);
  }
  function blur() {
    focused.current = false;
    const next = draft.trim() === '' || !Number.isFinite(Number(draft)) ? '0' : normalize(draft);
    setDraft(next);
    onChange(next);
  }

  return <div className="group relative text-xs font-bold text-on-surface-variant">
    <div className="flex min-h-4 items-start gap-1.5">
      <label htmlFor={inputId}>{label}</label>
      <span className="relative shrink-0" tabIndex={0} aria-label={`${label} açıklaması`}>
        <CircleHelp size={13} className="cursor-help text-outline transition-colors group-hover:text-primary"/>
        <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-72 -translate-x-1/2 rounded-xl border border-primary/25 bg-surface-high px-3 py-2.5 text-left text-[11px] font-medium leading-4 text-on-surface-variant opacity-0 shadow-2xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {description}<span className="absolute left-1/2 top-full -translate-x-1/2 border-[6px] border-transparent border-t-primary/25"/>
        </span>
      </span>
    </div>
    <input id={inputId} type="number" inputMode="decimal" min={min} max={max} step={step} value={draft} onFocus={(event) => { focused.current = true; if (draft === '0') event.currentTarget.select(); }} onBlur={blur} onChange={(event) => change(event.target.value)} className="mt-1.5 w-full rounded-xl border border-outline/15 bg-background/70 p-3 text-white"/>
  </div>;
}

function ActivityShell({ title, subtitle, icon: Icon, accounts, accountId, setAccountId, loading, refresh, error, notice, noticeTone = 'success', streamStatus, children }: { title: string; subtitle: string; icon: React.ComponentType<{ size?: number }>; accounts: TradingAccount[]; accountId: string; setAccountId: (id: string) => void; loading: boolean; refresh: () => void; error: string; notice: string; noticeTone?: 'success' | 'warning'; streamStatus: TradingStreamStatus; children: React.ReactNode }) {
  const noticeClass = noticeTone === 'warning' ? 'border-error/20 bg-error/10 text-error' : 'border-secondary/20 bg-secondary/10 text-secondary';
  return <div className="space-y-6"><header className="flex flex-col gap-5 rounded-[30px] border border-outline/10 bg-surface p-6 md:flex-row md:items-end md:justify-between md:p-8"><div><div className="flex flex-wrap items-center gap-2 text-primary"><Icon size={20}/><span className="text-xs font-black uppercase tracking-[0.2em]">Trading Bot / Faz 4</span><LiveStatus status={streamStatus}/></div><h1 className="mt-3 font-headline text-3xl font-black text-white md:text-4xl">{title}</h1><p className="mt-3 text-sm text-on-surface-variant">{subtitle}</p></div><div className="flex flex-col gap-2 sm:flex-row"><select className="input min-w-56" value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Hesap seçin</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.provider}</option>)}</select><button onClick={refresh} disabled={loading || !accountId} className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface-high px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? <LoaderCircle className="animate-spin" size={17}/> : <RefreshCw size={17}/>} Yenile</button></div></header>{error && <div className="rounded-2xl border border-error/20 bg-error/10 p-4 text-error">{error}</div>}{notice && <div className={`rounded-2xl border p-4 ${noticeClass}`}>{notice}</div>}<section className="rounded-[28px] border border-outline/10 bg-surface p-4 md:p-6">{loading ? <div className="h-40 animate-pulse rounded-2xl bg-surface-high"/> : children}</section></div>;
}
function Empty({ text }: { text: string }) { return <p className="py-14 text-center text-sm text-on-surface-variant">{text}</p>; }
function Th({ children }: { children?: React.ReactNode }) { return <th className="px-4 py-3">{children}</th>; }
function Td({ children, strong, tone }: { children: React.ReactNode; strong?: boolean; tone?: 'positive' | 'negative' }) { return <td className={`whitespace-nowrap px-4 py-3 ${strong ? 'font-black text-white' : ''} ${tone === 'positive' ? 'font-bold text-secondary' : tone === 'negative' ? 'font-bold text-error' : ''}`}>{children}</td>; }
function fmt(value: string) { const number = Number(value); return Number.isFinite(number) ? new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 8 }).format(number) : value; }
function fmtFixed(value: string | number, digits: number) { const number = Number(value); return Number.isFinite(number) ? new Intl.NumberFormat('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(number) : String(value); }
function fmtSignedPercent(value: number) { return `${value > 0 ? '+' : ''}${fmtFixed(value, 2)}%`; }
function positionPnlPercentage(position: OpenPosition) {
  const quantity = Math.abs(Number(position.quantity));
  const entryPrice = Number(position.entryPrice);
  const leverage = Number(position.leverage);
  const pnl = Number(position.unrealizedPnl);
  const initialMargin = quantity * entryPrice / leverage;
  return Number.isFinite(initialMargin) && initialMargin > 0 && Number.isFinite(pnl) ? pnl / initialMargin * 100 : null;
}
function LiveStatus({ status }: { status: TradingStreamStatus }) { const live = status === 'LIVE'; return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${live ? 'bg-secondary/10 text-secondary' : 'bg-tertiary/10 text-tertiary'}`}>{live ? <Wifi size={11}/> : <WifiOff size={11}/>} {live ? 'Canlı' : status === 'RECONNECTING' ? 'Yeniden bağlanıyor' : status === 'CONNECTING' ? 'Bağlanıyor' : 'Çevrimdışı'}</span>; }
function StateBadge({ status }: { status: string }) { const pending = ['SUBMITTING', 'CANCELING', 'CLOSING'].includes(status); return <span className={`inline-flex rounded-lg px-2 py-1 text-[10px] font-black ${pending ? 'bg-tertiary/10 text-tertiary' : status.includes('FAILED') || status === 'RECONCILIATION_REQUIRED' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary'}`}>{status}</span>; }
