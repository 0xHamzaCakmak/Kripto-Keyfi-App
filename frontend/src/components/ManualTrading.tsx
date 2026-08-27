import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BrainCircuit, CheckCircle2, LoaderCircle, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../services/apiClient';
import { confirmOrder, getManualMentorPositions, getTradingAccounts, getTradingExecutionProfile, getTradingSymbols, previewOrder, publishManualMentorSignal, type ManualMentorPosition, type MarginMode, type OrderPreview, type OrderSide, type OrderType, type TradingAccount, type TradingExecutionProfile, type TradingSymbol } from '../services/tradingService';

const initialForm = { symbol: '', side: 'BUY' as OrderSide, type: 'MARKET' as OrderType, quantity: '', price: '', stopPrice: '', leverage: 5, marginMode: 'ISOLATED' as MarginMode, reduceOnly: false };

export default function ManualTrading() {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [symbols, setSymbols] = useState<TradingSymbol[]>([]);
  const [executionProfile, setExecutionProfile] = useState<TradingExecutionProfile | null>(null);
  const [form, setForm] = useState(initialForm);
  const [quote, setQuote] = useState<OrderPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [symbolsLoading, setSymbolsLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [quoteError, setQuoteError] = useState('');
  const [notice, setNotice] = useState('');
  const [mentorPositions, setMentorPositions] = useState<ManualMentorPosition[]>([]);
  const [mentorWorkingId, setMentorWorkingId] = useState('');

  useEffect(() => {
    getTradingAccounts().then((items) => {
      const active = items.filter((item) => item.isActive);
      setAccounts(active); setAccountId(active.find((item) => item.canTrade)?.id ?? active[0]?.id ?? '');
    }).catch((reason) => setError(getApiErrorMessage(reason, 'Borsa hesapları alınamadı.'))).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!accountId) { setSymbols([]); setExecutionProfile(null); setMentorPositions([]); return; }
    const account = accounts.find((item) => item.id === accountId);
    if (!account?.canTrade) { setSymbols([]); setExecutionProfile(null); setMentorPositions([]); setSymbolsLoading(false); setForm(initialForm); return; }
    setSymbolsLoading(true); setError(''); setForm(initialForm);
    Promise.all([getTradingSymbols(accountId), getTradingExecutionProfile(accountId), getManualMentorPositions(accountId)]).then(([items, profile, mentorRows]) => {
      const manualSymbols = account.provider === 'BINANCE' ? items.filter((item) => item.quoteAsset === 'USDC') : items;
      setSymbols(manualSymbols); setExecutionProfile(profile); setMentorPositions(mentorRows); setForm((current) => ({
        ...current,
        symbol: manualSymbols.find((item) => item.symbol === 'BTCUSDC')?.symbol ?? manualSymbols[0]?.symbol ?? '',
        leverage: Math.min(profile.maxLeverage, Math.max(profile.minLeverage, current.leverage)),
      }));
    }).catch((reason) => setError(getApiErrorMessage(reason, 'Parite kuralları alınamadı.'))).finally(() => setSymbolsLoading(false));
  }, [accountId, accounts]);

  const selectedSymbol = useMemo(() => symbols.find((item) => item.symbol === form.symbol), [symbols, form.symbol]);
  const selectedAccount = useMemo(() => accounts.find((item) => item.id === accountId), [accounts, accountId]);

  async function createPreview(event: FormEvent) {
    event.preventDefault(); setWorking(true); setError(''); setQuoteError(''); setNotice('');
    if (executionProfile && (form.leverage < executionProfile.minLeverage || form.leverage > executionProfile.maxLeverage)) {
      setError(`Kaldiraç merkezi risk profilindeki ${executionProfile.minLeverage}x-${executionProfile.maxLeverage}x araliginda olmalidir.`);
      setWorking(false); return;
    }
    if (!selectedAccount?.canTrade) {
      setError('Bu API anahtarının Futures işlem yetkisi kapalı. Binance Demo API ayarından işlem yetkisini açıp Borsa Hesapları ekranında bağlantıyı yeniden test edin.');
      setWorking(false); return;
    }
    try {
      setQuote(await previewOrder({
        exchangeAccountId: accountId, symbol: form.symbol, side: form.side, type: form.type, quantity: form.quantity,
        ...(form.price ? { price: form.price } : {}), ...(form.stopPrice ? { stopPrice: form.stopPrice } : {}),
        leverage: form.leverage, marginMode: form.marginMode, reduceOnly: form.reduceOnly,
      }));
    } catch (reason) { setError(getApiErrorMessage(reason, 'Emir önizlemesi oluşturulamadı.')); }
    finally { setWorking(false); }
  }

  async function approve() {
    if (!quote) return; setWorking(true); setError(''); setQuoteError('');
    try {
      await confirmOrder(quote.id); setQuote(null); setQuoteError(''); setNotice('Testnet/demo emri borsaya gönderildi. Açık Emirler ekranından takip edebilirsiniz.');
      setForm((current) => ({ ...current, quantity: '', price: '', stopPrice: '' }));
    } catch (reason) { setQuoteError(getApiErrorMessage(reason, 'Emir gönderilemedi.')); }
    finally { setWorking(false); }
  }

  async function publishMentor(position: ManualMentorPosition) {
    if (!window.confirm(`${position.symbol} pozisyonunun şu anki başarılı piyasa koşulları düşük performanslı botlara mentor kanıtı olarak gönderilsin mi? Bu sinyal tek başına işlem açtırmaz.`)) return;
    setMentorWorkingId(position.positionKey); setError(''); setNotice('');
    try {
      const result = await publishManualMentorSignal(accountId, position.positionKey);
      setMentorPositions((current) => current.map((item) => item.positionKey === position.positionKey ? { ...item, mentorPublished: true } : item));
      setNotice(`Mentor sinyali kaydedildi. ${result.targetedBotCount} düşük performanslı ${result.baseAsset} botu bu kanıtı sonraki kararlarında değerlendirecek; işlem zorla açılmayacak.`);
    } catch (reason) { setError(getApiErrorMessage(reason, 'Mentor sinyali gönderilemedi.')); }
    finally { setMentorWorkingId(''); }
  }

  return <div className="space-y-6">
    <PageHeader/>
    {error && <Message tone="error">{error}</Message>}{notice && <Message tone="success">{notice}</Message>}
    {!loading && accounts.length === 0 ? <div className="rounded-[28px] border border-dashed border-outline/20 bg-surface p-12 text-center"><AlertTriangle className="mx-auto text-tertiary"/><h2 className="mt-4 font-headline text-xl font-black text-white">Aktif test hesabı gerekli</h2><p className="mt-2 text-sm text-on-surface-variant">Önce Borsa Hesapları ekranından Binance Demo veya Bybit Demo hesabı bağlayın.</p></div> :
    <form onSubmit={(event) => void createPreview(event)} className="grid gap-5 rounded-[28px] border border-outline/10 bg-surface p-5 md:p-7 xl:grid-cols-2">
      <Field label="Borsa hesabı"><select className="input" required value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Hesap seçin</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.provider} {account.environment} · {account.executionEngine}{account.canTrade ? '' : ' · İŞLEM YETKİSİ YOK'}</option>)}</select></Field>
      <Field label="Vadeli parite"><select className="input" required disabled={symbolsLoading} value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value })}><option value="">{symbolsLoading ? 'Pariteler yükleniyor…' : 'Parite seçin'}</option>{symbols.map((symbol) => <option key={symbol.symbol} value={symbol.symbol}>{symbol.symbol}</option>)}</select></Field>
      <Field label="Yön"><div className="grid grid-cols-2 gap-2"><Choice active={form.side === 'BUY'} tone="buy" onClick={() => setForm({ ...form, side: 'BUY' })}>Al / Long</Choice><Choice active={form.side === 'SELL'} tone="sell" onClick={() => setForm({ ...form, side: 'SELL' })}>Sat / Short</Choice></div></Field>
      <Field label="Emir tipi"><select className="input" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as OrderType })}><option value="MARKET">Piyasa</option><option value="LIMIT">Limit</option><option value="STOP_MARKET">Stop Market</option><option value="STOP_LIMIT">Stop Limit</option></select></Field>
      <Field label={`Miktar${selectedSymbol ? ` · adım ${selectedSymbol.stepSize}` : ''}`}><input className="input" required inputMode="decimal" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} placeholder={selectedSymbol?.minQuantity ?? '0.001'}/></Field>
      {(form.type === 'LIMIT' || form.type === 'STOP_LIMIT') && <Field label={`Limit fiyatı${selectedSymbol ? ` · tick ${selectedSymbol.tickSize}` : ''}`}><input className="input" required inputMode="decimal" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })}/></Field>}
      {(form.type === 'STOP_MARKET' || form.type === 'STOP_LIMIT') && <Field label="Tetikleme fiyatı"><input className="input" required inputMode="decimal" value={form.stopPrice} onChange={(event) => setForm({ ...form, stopPrice: event.target.value })}/></Field>}
      <Field label={`Kaldıraç · azami ${selectedSymbol?.maxLeverage ?? '—'}x`}><input className="input" type="number" min={1} max={selectedSymbol?.maxLeverage ?? 125} value={form.leverage} onChange={(event) => setForm({ ...form, leverage: Number(event.target.value) })}/></Field>
      <Field label="Margin modu"><select className="input" value={form.marginMode} onChange={(event) => setForm({ ...form, marginMode: event.target.value as MarginMode })}><option value="ISOLATED">Isolated</option><option value="CROSS">Cross</option></select></Field>
      <label className="flex items-center gap-3 rounded-xl border border-outline/10 p-4 text-sm text-on-surface-variant"><input type="checkbox" checked={form.reduceOnly} onChange={(event) => setForm({ ...form, reduceOnly: event.target.checked })}/> Yalnızca mevcut pozisyonu azalt (reduce-only)</label>
      {selectedAccount && !selectedAccount.canTrade && <div className="xl:col-span-2 flex items-start gap-3 rounded-2xl border border-error/20 bg-error/10 p-4 text-sm leading-6 text-error"><AlertTriangle className="mt-0.5 shrink-0" size={19}/><div><p className="font-black">Bu hesap bağlı, ancak Futures işlem yetkisi kapalı.</p><p className="mt-1 text-error/90">Binance Demo API anahtarında işlem/Futures yetkisini açın. Ardından <Link to="/admin/trading/exchanges" className="font-black underline">Borsa Hesapları</Link> ekranında “Bağlantıyı test et” butonuna basın.</p></div></div>}
      {selectedSymbol && <div className="xl:col-span-2 grid gap-2 rounded-2xl bg-background/40 p-4 text-xs text-on-surface-variant sm:grid-cols-4"><Rule label="Min. miktar" value={selectedSymbol.minQuantity}/><Rule label="Maks. miktar" value={selectedSymbol.maxQuantity}/><Rule label="Min. büyüklük" value={`${selectedSymbol.minNotional} ${selectedSymbol.quoteAsset}`}/><Rule label="Tick / Step" value={`${selectedSymbol.tickSize} / ${selectedSymbol.stepSize}`}/></div>}
      <button disabled={working || !accountId || !form.symbol || !selectedAccount?.canTrade} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-black text-background disabled:opacity-50 xl:col-span-2">{working ? <LoaderCircle className="animate-spin" size={18}/> : <ShieldCheck size={18}/>} Emri önizle</button>
    </form>}
    <section className="rounded-[28px] border border-outline/10 bg-surface p-5 md:p-7">
      <div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><BrainCircuit size={20}/></div><div><h2 className="font-headline text-xl font-black text-white">Manuel mentor sinyalleri</h2><p className="mt-1 text-xs leading-5 text-on-surface-variant">Yalnız size ait açık USDC manuel pozisyonları gösterilir. Pozitif PnL gördüğünüz örneği sonradan botlara gönderebilirsiniz; sinyal botlara doğrudan emir vermez.</p></div></div>
      {mentorPositions.length === 0 ? <p className="mt-5 rounded-xl border border-outline/10 p-4 text-sm text-outline">Mentor sinyali için uygun açık manuel USDC pozisyonu yok.</p> : <div className="mt-5 overflow-x-auto rounded-2xl border border-outline/10"><table className="w-full min-w-[760px] text-left text-xs"><thead className="bg-surface-high text-[10px] font-black uppercase tracking-wider text-outline"><tr><th className="p-3">Parite</th><th className="p-3">Yön</th><th className="p-3">Giriş</th><th className="p-3">Mark</th><th className="p-3">Açık PnL</th><th className="p-3"/></tr></thead><tbody>{mentorPositions.map((position) => <tr key={position.positionKey} className="border-t border-outline/10 text-on-surface-variant"><td className="p-3 font-black text-white">{position.symbol}</td><td className={`p-3 font-black ${position.side === 'LONG' ? 'text-secondary' : 'text-error'}`}>{position.side}</td><td className="p-3 tabular-nums">{formatManualNumber(position.entryPrice, 3)}</td><td className="p-3 tabular-nums">{formatManualNumber(position.markPrice, 3)}</td><td className={`p-3 font-black tabular-nums ${Number(position.unrealizedPnl) > 0 ? 'text-secondary' : 'text-error'}`}>{formatManualNumber(position.unrealizedPnl, 2)} {quoteAsset(position.symbol)}</td><td className="p-3 text-right"><button type="button" disabled={!position.mentorEligible || position.mentorPublished || mentorWorkingId === position.positionKey} onClick={() => void publishMentor(position)} className="rounded-xl bg-primary/10 px-4 py-2.5 font-black text-primary disabled:cursor-not-allowed disabled:opacity-40">{position.mentorPublished ? 'Mentor sinyali gönderildi' : mentorWorkingId === position.positionKey ? 'Gönderiliyor…' : position.mentorEligible ? 'Mentor sinyali gönder' : 'Pozitif PnL bekleniyor'}</button></td></tr>)}</tbody></table></div>}
    </section>
    {quote && <PreviewDialog quote={quote} working={working} error={quoteError} onClose={() => { setQuote(null); setQuoteError(''); }} onApprove={() => void approve()}/>}
  </div>;
}

function PageHeader() { return <header className="rounded-[30px] border border-primary/15 bg-gradient-to-br from-surface to-primary/10 p-6 md:p-8"><div className="flex items-center gap-3 text-primary"><SlidersHorizontal/><span className="text-xs font-black uppercase tracking-[0.2em]">Trading Bot / Faz 3</span></div><h1 className="mt-3 font-headline text-3xl font-black text-white md:text-4xl">Manuel Testnet İşlemi</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-on-surface-variant">Manuel yeni girişler USDC vadeli paritelerinde açılır; USDT sermayesi botlara ayrılmış kalır. Emri önce inceleyin, ardından açıkça onaylayın.</p></header>; }
function PreviewDialog({ quote, working, error, onClose, onApprove }: { quote: OrderPreview; working: boolean; error: string; onClose: () => void; onApprove: () => void }) { const asset = quoteAsset(quote.symbol); return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"><section className="w-full max-w-xl rounded-[28px] border border-outline/10 bg-surface p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-primary">Son onay</p><h2 className="mt-2 font-headline text-2xl font-black text-white">Emir özeti</h2></div><button onClick={onClose} disabled={working} className="rounded-xl p-2 text-outline hover:bg-surface-high disabled:opacity-50"><X/></button></div><dl className="mt-6 grid grid-cols-2 gap-3"><Summary label="Hesap" value={quote.accountName}/><Summary label="Parite" value={quote.symbol}/><Summary label="Yön / tip" value={`${quote.side} · ${quote.type}`}/><Summary label="Miktar" value={quote.quantity}/><Summary label="Mark fiyatı" value={quote.markPrice}/><Summary label="Tahmini büyüklük" value={`${quote.estimatedNotional} ${asset}`}/><Summary label="Kaldıraç / margin" value={`${quote.leverage}x · ${quote.marginMode}`}/><Summary label="Tahmini ilk teminat" value={`${quote.estimatedInitialMargin} ${asset}`}/></dl><div className="mt-4 space-y-2">{quote.warnings.map((warning) => <p key={warning} className="flex gap-2 rounded-xl bg-tertiary/5 p-3 text-xs text-on-surface-variant"><AlertTriangle size={15} className="shrink-0 text-tertiary"/>{warning}</p>)}</div>{error && <div className="mt-4 rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error"><p className="font-bold">Emir gönderilemedi</p><p className="mt-1">{error}</p><p className="mt-1 text-xs text-error/80">Bilgileri düzeltip yeni bir emir önizlemesi oluşturun.</p></div>}<div className="mt-6 grid grid-cols-2 gap-3"><button onClick={onClose} disabled={working} className="rounded-xl border border-outline/15 px-4 py-3 text-sm font-bold text-on-surface-variant">{error ? 'Kapat ve düzelt' : 'Vazgeç'}</button><button onClick={onApprove} disabled={working || Boolean(error)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3 text-sm font-black text-background disabled:opacity-50">{working ? <LoaderCircle className="animate-spin" size={17}/> : <CheckCircle2 size={17}/>} Onayla ve gönder</button></div></section></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-xs font-bold text-on-surface-variant">{label}</span>{children}</label>; }
function Choice({ active, tone, onClick, children }: { active: boolean; tone: 'buy' | 'sell'; onClick: () => void; children: React.ReactNode }) { const color = tone === 'buy' ? 'border-secondary/40 bg-secondary/10 text-secondary' : 'border-error/40 bg-error/10 text-error'; return <button type="button" onClick={onClick} className={`rounded-xl border px-4 py-3 text-sm font-black ${active ? color : 'border-outline/10 text-outline'}`}>{children}</button>; }
function Rule({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-black uppercase text-outline">{label}</p><p className="mt-1 font-bold text-on-surface">{value}</p></div>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-surface-high p-3"><dt className="text-[10px] font-black uppercase text-outline">{label}</dt><dd className="mt-1 text-sm font-bold text-white">{value}</dd></div>; }
function Message({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) { return <div className={`rounded-2xl border p-4 text-sm ${tone === 'error' ? 'border-error/20 bg-error/10 text-error' : 'border-secondary/20 bg-secondary/10 text-secondary'}`}>{children}</div>; }
function quoteAsset(symbol: string) { return symbol.endsWith('USDC') ? 'USDC' : 'USDT'; }
function formatManualNumber(value: string, digits: number) { const number = Number(value); return Number.isFinite(number) ? new Intl.NumberFormat('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(number) : value; }
