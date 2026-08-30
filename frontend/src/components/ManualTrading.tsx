import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, BrainCircuit, CheckCircle2, LoaderCircle, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../services/apiClient';
import { confirmOrder, createManualBotCampaign, getManualBotCampaign, getManualBotCampaignCandidates, getManualMentorPositions, getTradingAccounts, getTradingExecutionProfile, getTradingSymbols, previewManualBotCampaign, previewOrder, publishManualMentorSignal, type ManualBotCampaign, type ManualBotCampaignPreview, type ManualBotCandidate, type ManualMentorPosition, type MarginMode, type OrderPreview, type OrderSide, type OrderType, type TradingAccount, type TradingExecutionProfile, type TradingSymbol } from '../services/tradingService';

const initialForm = { symbol: '', side: 'BUY' as OrderSide, type: 'MARKET' as OrderType, quantity: '', price: '', stopPrice: '', leverage: 5, marginMode: 'ISOLATED' as MarginMode, reduceOnly: false };
const MANUAL_BOT_PREFERENCES_KEY = 'kriptokeyfi.manual-bot-campaign.v1';
const MANUAL_TRADING_ACCOUNT_KEY = 'kriptokeyfi.manual-trading.last-account';

type ManualBotPreferences = {
  side: 'BUY' | 'SELL'; initialMarginUsdt: number; leverage: number;
  stopLossPercent: number; takeProfitPercent: number; selectedSymbols: string[];
};

export default function ManualTrading() {
  const [pageMode, setPageMode] = useState<'single' | 'bots'>('single');
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
  const [botCandidates, setBotCandidates] = useState<ManualBotCandidate[]>([]);
  const [botAvailableBalance, setBotAvailableBalance] = useState('0');
  const [botCandidateError, setBotCandidateError] = useState('');

  useEffect(() => {
    getTradingAccounts().then((items) => {
      const active = items.filter((item) => item.isActive);
      const rememberedAccountId = readLastManualTradingAccount();
      const remembered = active.find((item) => item.id === rememberedAccountId && item.canTrade);
      setAccounts(active); setAccountId(remembered?.id ?? active.find((item) => item.canTrade)?.id ?? active[0]?.id ?? '');
    }).catch((reason) => setError(getApiErrorMessage(reason, 'Borsa hesapları alınamadı.'))).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (accountId) writeLastManualTradingAccount(accountId);
  }, [accountId]);

  useEffect(() => {
    if (!accountId) { setSymbols([]); setExecutionProfile(null); setMentorPositions([]); setBotCandidates([]); setBotAvailableBalance('0'); return; }
    const account = accounts.find((item) => item.id === accountId);
    if (!account?.canTrade) { setSymbols([]); setExecutionProfile(null); setMentorPositions([]); setBotCandidates([]); setBotAvailableBalance('0'); setSymbolsLoading(false); setForm(initialForm); return; }
    setSymbolsLoading(true); setError(''); setBotCandidateError('');
    if (pageMode === 'bots') {
      const compatible = account.provider === 'BINANCE' && account.environment === 'TESTNET' && account.executionEngine === 'GO';
      Promise.all([
        getTradingExecutionProfile(accountId),
        compatible
          ? getManualBotCampaignCandidates(accountId).catch((reason) => {
            setBotCandidateError(getApiErrorMessage(reason, 'Toplu bot listesi alınamadı.'));
            return null;
          })
          : Promise.resolve(null),
      ]).then(([profile, candidates]) => {
        setExecutionProfile(profile);
        setBotCandidates(candidates?.bots ?? []);
        setBotAvailableBalance(candidates?.availableBalance ?? '0');
      }).catch((reason) => setError(getApiErrorMessage(reason, 'Execution risk profili alınamadı.')))
        .finally(() => setSymbolsLoading(false));
      return;
    }
    setForm(initialForm);
    Promise.all([
      getTradingSymbols(accountId),
      getTradingExecutionProfile(accountId),
      getManualMentorPositions(accountId).catch(() => [] as ManualMentorPosition[]),
    ]).then(([items, profile, mentorRows]) => {
      const manualSymbols = account.provider === 'BINANCE' ? items.filter((item) => item.quoteAsset === 'USDC') : items;
      setSymbols(manualSymbols); setExecutionProfile(profile); setMentorPositions(mentorRows); setForm((current) => ({
        ...current,
        symbol: manualSymbols.find((item) => item.symbol === 'BTCUSDC')?.symbol ?? manualSymbols[0]?.symbol ?? '',
        leverage: Math.min(profile.maxLeverage, Math.max(profile.minLeverage, current.leverage)),
      }));
    }).catch((reason) => setError(getApiErrorMessage(reason, 'Parite kuralları alınamadı.'))).finally(() => setSymbolsLoading(false));
  }, [accountId, accounts, pageMode]);

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
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-outline/10 bg-surface p-2">
      <button type="button" onClick={() => { setError(''); setPageMode('single'); }} className={`rounded-xl px-4 py-3 text-sm font-black ${pageMode === 'single' ? 'bg-primary text-background' : 'text-outline'}`}>Tek Coin Manuel İşlem</button>
      <button type="button" onClick={() => { setError(''); setPageMode('bots'); }} className={`rounded-xl px-4 py-3 text-sm font-black ${pageMode === 'bots' ? 'bg-primary text-background' : 'text-outline'}`}>Botlara Toplu İşlem</button>
    </div>
    {pageMode === 'single' && <>
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
    </>}
    {pageMode === 'bots' && <ManualBotCampaignPanel accounts={accounts} accountId={accountId} setAccountId={setAccountId} profile={executionProfile} candidates={botCandidates} availableBalance={botAvailableBalance} candidateError={botCandidateError} onError={setError}/>}
    {quote && <PreviewDialog quote={quote} working={working} error={quoteError} onClose={() => { setQuote(null); setQuoteError(''); }} onApprove={() => void approve()}/>}
  </div>;
}

function ManualBotCampaignPanel({ accounts, accountId, setAccountId, profile, candidates, availableBalance, candidateError, onError }: {
  accounts: TradingAccount[]; accountId: string; setAccountId: (value: string) => void; profile: TradingExecutionProfile | null;
  candidates: ManualBotCandidate[]; availableBalance: string; candidateError: string; onError: (value: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [initialMarginUsdt, setInitialMarginUsdt] = useState(100);
  const [leverage, setLeverage] = useState(5);
  const [stopLossPercent, setStopLossPercent] = useState(0.5);
  const [takeProfitPercent, setTakeProfitPercent] = useState(1);
  const [preview, setPreview] = useState<ManualBotCampaignPreview | null>(null);
  const [campaign, setCampaign] = useState<ManualBotCampaign | null>(null);
  const [working, setWorking] = useState(false);
  const [preferencesAccountId, setPreferencesAccountId] = useState('');

  const readyIds = useMemo(() => candidates.filter((bot) => bot.ready).map((bot) => bot.id), [candidates]);
  useEffect(() => {
    if (!accountId || !profile) return;
    const saved = readManualBotPreferences(accountId);
    setSide(saved?.side ?? 'BUY');
    setInitialMarginUsdt(saved?.initialMarginUsdt ?? Math.max(1, Number(profile.minInitialMarginUsdt) || 100));
    setLeverage(Math.max(profile.minLeverage, Math.min(profile.maxLeverage, saved?.leverage ?? 5)));
    setStopLossPercent(saved?.stopLossPercent ?? profile.stopLossBps / 100);
    setTakeProfitPercent(saved?.takeProfitPercent ?? profile.takeProfitBps / 100);
    setPreferencesAccountId(accountId);
  }, [accountId, profile]);
  useEffect(() => {
    const savedSymbols = readManualBotPreferences(accountId)?.selectedSymbols;
    setSelected(savedSymbols
      ? candidates.filter((bot) => bot.ready && savedSymbols.includes(bot.symbol)).map((bot) => bot.id)
      : readyIds);
    setPreview(null); setCampaign(null);
  }, [accountId, readyIds.join('|')]);
  useEffect(() => {
    if (!accountId || preferencesAccountId !== accountId) return;
    const previous = readManualBotPreferences(accountId);
    writeManualBotPreferences(accountId, {
      side, initialMarginUsdt, leverage, stopLossPercent, takeProfitPercent,
      selectedSymbols: candidates.length > 0
        ? candidates.filter((bot) => selected.includes(bot.id)).map((bot) => bot.symbol)
        : previous?.selectedSymbols ?? [],
    });
  }, [accountId, preferencesAccountId, side, initialMarginUsdt, leverage, stopLossPercent, takeProfitPercent, selected.join('|'), candidates]);
  useEffect(() => { setPreview(null); }, [selected.join('|'), side, initialMarginUsdt, leverage, stopLossPercent, takeProfitPercent]);
  useEffect(() => {
    if (!campaign || !['QUEUED', 'RUNNING'].includes(campaign.status)) return;
    const timer = window.setInterval(() => {
      getManualBotCampaign(campaign.id).then(setCampaign).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [campaign?.id, campaign?.status]);

  const input = { exchangeAccountId: accountId, botIds: selected, side, initialMarginUsdt, leverage, stopLossPercent, takeProfitPercent, existingPositionRule: 'SKIP' as const };
  async function prepare() {
    setWorking(true); onError(''); setCampaign(null);
    try { setPreview(await previewManualBotCampaign(input)); }
    catch (reason) { onError(getApiErrorMessage(reason, 'Toplu bot işlemi önizlenemedi.')); }
    finally { setWorking(false); }
  }
  async function submit() {
    if (!preview || !window.confirm(`${preview.queuedBots} bota ${side === 'BUY' ? 'LONG' : 'SHORT'} market emri gönderilsin mi? Toplam tahmini teminat ${formatManualNumber(preview.totalInitialMargin, 2)} USDT.`)) return;
    setWorking(true); onError('');
    try { setCampaign(await createManualBotCampaign(input)); }
    catch (reason) { onError(getApiErrorMessage(reason, 'Toplu bot kampanyası başlatılamadı.')); }
    finally { setWorking(false); }
  }

  const selectedAccount = accounts.find((account) => account.id === accountId);
  const compatible = selectedAccount?.provider === 'BINANCE' && selectedAccount.environment === 'TESTNET' && selectedAccount.executionEngine === 'GO';
  return <div className="space-y-5">
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
    <section className="rounded-[28px] border border-primary/20 bg-surface p-5 md:p-7">
      <div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Bot size={21}/></div><div><h2 className="font-headline text-xl font-black text-white">Botlara toplu manuel işlem</h2><p className="mt-1 text-xs leading-5 text-on-surface-variant">Yönü siz belirlersiniz; her botun emri yine risk, bakiye, Binance onayı ve pozisyon doğrulamasından geçer. Girişten sonra bot TP/SL yönetimini devralır.</p></div></div>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <Field label="Binance TESTNET hesabı"><select className="input" value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Hesap seçin</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.provider} {account.environment} · {account.executionEngine}</option>)}</select></Field>
        <Field label="Yön"><div className="grid grid-cols-2 gap-2"><Choice active={side === 'BUY'} tone="buy" onClick={() => setSide('BUY')}>LONG</Choice><Choice active={side === 'SELL'} tone="sell" onClick={() => setSide('SELL')}>SHORT</Choice></div></Field>
        <Field label="Bot başına başlangıç teminatı (USDT)"><input className="input" type="number" min={1} step="1" value={initialMarginUsdt} onChange={(event) => setInitialMarginUsdt(Number(event.target.value))}/></Field>
        <Field label={`Kaldıraç${profile ? ` · ${profile.minLeverage}x-${profile.maxLeverage}x` : ''}`}><input className="input" type="number" min={profile?.minLeverage ?? 5} max={profile?.maxLeverage ?? 20} value={leverage} onChange={(event) => setLeverage(Number(event.target.value))}/></Field>
        <Field label="Stop-loss fiyat hareketi (%)"><input className="input" type="number" min="0.1" max="10" step="0.1" value={stopLossPercent} onChange={(event) => setStopLossPercent(Number(event.target.value))}/></Field>
        <Field label="Net kâr hedefi fiyat hareketi (%)"><input className="input" type="number" min="0.1" max="20" step="0.1" value={takeProfitPercent} onChange={(event) => setTakeProfitPercent(Number(event.target.value))}/></Field>
      </div>
      <div className="mt-5 rounded-2xl border border-outline/10 bg-background/35 p-4 text-xs leading-5 text-on-surface-variant">Mevcut pozisyonu olan, durdurulmuş veya bekleyen talimatı bulunan botlar güvenli biçimde atlanır. Manuel pozisyon kapanana kadar o botta otomatik yeni giriş yapılmaz; pozisyon yönetimi ve TP/SL çalışmaya devam eder.</div>
      {!compatible && <div className="mt-4 rounded-2xl border border-error/25 bg-error/10 p-4 text-sm font-bold text-error">Bu özellik işlem yetkili, Go execution kullanan Binance TESTNET hesabında çalışır.</div>}
      {candidateError && <div className="mt-4 rounded-2xl border border-error/25 bg-error/10 p-4 text-sm font-bold text-error">{candidateError}</div>}
    </section>

    <section className="rounded-[28px] border border-outline/10 bg-surface p-5 md:p-7">
      <div><h3 className="font-headline text-lg font-black text-white">İşleme alınacak coinler</h3><p className="mt-1 text-xs text-outline">Kullanılabilir bakiye: {formatManualNumber(availableBalance, 2)} USDT · {selected.length}/{readyIds.length} uygun coin seçili</p></div>
      <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm font-black text-primary"><input type="checkbox" disabled={readyIds.length === 0} checked={readyIds.length > 0 && selected.length === readyIds.length} onChange={(event) => setSelected(event.target.checked ? readyIds : [])}/> Tüm uygun coinleri seç</label>
      <div className="mt-3 grid max-h-[520px] gap-2 overflow-y-auto pr-1">{candidates.map((candidate) => <label key={candidate.id} className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${candidate.ready ? 'cursor-pointer border-outline/10' : 'border-error/15 opacity-55'}`}><input type="checkbox" disabled={!candidate.ready} checked={selected.includes(candidate.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, candidate.id])] : current.filter((id) => id !== candidate.id))}/><span className="min-w-0"><span className="block truncate font-black text-white">{candidate.symbol}</span><span className="block truncate text-[11px] text-outline">{candidate.name} · {candidate.ready ? 'Hazır' : blockerText(candidate.blocker)}</span></span></label>)}</div>
      {candidates.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-outline/15 p-5 text-sm text-outline">Bu hesapta kampanyaya uygun TESTNET botu bulunamadı.</p>}
      <button type="button" disabled={working || !compatible || selected.length === 0} onClick={() => void prepare()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-black text-background disabled:opacity-40">{working ? <LoaderCircle className="animate-spin" size={18}/> : <ShieldCheck size={18}/>} Kampanyayı önizle</button>
    </section>
    </div>

    {preview && <section className={`rounded-[28px] border p-5 md:p-7 ${preview.affordable ? 'border-secondary/25 bg-secondary/5' : 'border-error/25 bg-error/5'}`}><h3 className="font-headline text-lg font-black text-white">Toplu emir özeti</h3><dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Summary label="İşleme alınacak" value={`${preview.queuedBots} bot`}/><Summary label="Atlanacak" value={`${preview.skippedBots} bot`}/><Summary label="Toplam teminat" value={`${formatManualNumber(preview.totalInitialMargin, 2)} USDT`}/><Summary label="Toplam notional" value={`${formatManualNumber(preview.totalNotional, 2)} USDT`}/><Summary label="Kullanılabilir" value={`${formatManualNumber(preview.availableBalance, 2)} USDT`}/><Summary label="Korunacak bakiye" value={`${formatManualNumber(preview.protectedBalance, 2)} USDT`}/><Summary label="Bot başına" value={`${formatManualNumber(preview.perBotInitialMargin, 2)} USDT · ${preview.leverage}x`}/><Summary label="TP / SL" value={`%${preview.takeProfitPercent} / %${preview.stopLossPercent}`}/></dl>{!preview.affordable && <p className="mt-4 rounded-xl bg-error/10 p-3 text-sm font-bold text-error">Kampanya için kullanılabilir bakiye yetersiz; emir gönderilmeyecek.</p>}<button type="button" disabled={working || !preview.affordable || preview.queuedBots === 0} onClick={() => void submit()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-5 py-3.5 text-sm font-black text-background disabled:opacity-40">{working ? <LoaderCircle className="animate-spin" size={18}/> : <CheckCircle2 size={18}/>} Onayla ve botlara gönder</button></section>}

    {campaign && <CampaignResults campaign={campaign}/>}
  </div>;
}

function CampaignResults({ campaign }: { campaign: ManualBotCampaign }) {
  const terminal = !['QUEUED', 'RUNNING'].includes(campaign.status);
  return <section className="rounded-[28px] border border-outline/10 bg-surface p-5 md:p-7"><div className="flex items-center justify-between gap-3"><div><h3 className="font-headline text-lg font-black text-white">Execution sonuçları</h3><p className="mt-1 text-xs text-outline">Kampanya {campaign.id.slice(0, 8)} · {campaign.side === 'BUY' ? 'LONG' : 'SHORT'} · {campaign.leverage}x</p></div><span className={`rounded-xl px-3 py-2 text-xs font-black ${terminal ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>{campaign.status}</span></div><div className="mt-4 overflow-x-auto rounded-2xl border border-outline/10"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-surface-high text-[10px] uppercase tracking-wider text-outline"><tr><th className="p-3">Sembol</th><th className="p-3">Bot</th><th className="p-3">Sonuç</th><th className="p-3">Reason code</th><th className="p-3">Detay</th></tr></thead><tbody>{campaign.items.map((item) => <tr key={item.id} className="border-t border-outline/10"><td className="p-3 font-black text-white">{item.symbol}</td><td className="p-3 text-on-surface-variant">{item.name}</td><td className={`p-3 font-black ${item.status === 'EXECUTED' ? 'text-secondary' : ['QUEUED', 'PENDING_EXECUTION', 'RETRYING'].includes(item.status) ? 'text-primary' : 'text-error'}`}>{item.status}</td><td className="p-3 text-outline">{item.reasonCode ?? '—'}</td><td className="p-3 text-on-surface-variant">{item.detail ?? '—'}</td></tr>)}</tbody></table></div>{!terminal && <p className="mt-3 text-xs text-primary">Sonuçlar 3 saniyede bir yenileniyor…</p>}</section>;
}

function blockerText(value: ManualBotCandidate['blocker']) {
  return ({ EXISTING_POSITION: 'Açık pozisyon var', INSTRUCTION_PENDING: 'Talimat bekliyor', ENTRY_PAUSED: 'Yeni girişler durdurulmuş', BOT_NOT_RUNNING: 'Bot çalışmıyor' } as Record<string, string>)[value ?? ''] ?? 'Uygun değil';
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
function readManualBotPreferences(accountId: string): ManualBotPreferences | null {
  if (!accountId || typeof window === 'undefined') return null;
  try {
    const all = JSON.parse(window.localStorage.getItem(MANUAL_BOT_PREFERENCES_KEY) ?? '{}') as Record<string, ManualBotPreferences>;
    const value = all[accountId];
    return value && (value.side === 'BUY' || value.side === 'SELL') ? value : null;
  } catch { return null; }
}
function writeManualBotPreferences(accountId: string, value: ManualBotPreferences) {
  if (!accountId || typeof window === 'undefined') return;
  try {
    const all = JSON.parse(window.localStorage.getItem(MANUAL_BOT_PREFERENCES_KEY) ?? '{}') as Record<string, ManualBotPreferences>;
    window.localStorage.setItem(MANUAL_BOT_PREFERENCES_KEY, JSON.stringify({ ...all, [accountId]: value }));
  } catch { /* Private browsing/storage restrictions must not block execution. */ }
}
function readLastManualTradingAccount() {
  try { return window.localStorage.getItem(MANUAL_TRADING_ACCOUNT_KEY); }
  catch { return null; }
}
function writeLastManualTradingAccount(accountId: string) {
  try { window.localStorage.setItem(MANUAL_TRADING_ACCOUNT_KEY, accountId); }
  catch { /* Private browsing/storage restrictions must not block execution. */ }
}
