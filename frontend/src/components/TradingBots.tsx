import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, Bot, ChevronDown, CircleStop, Info as InfoIcon, ListTree, Pause, Play, Plus, RefreshCw, ShieldCheck, Sparkles, Square, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '../services/apiClient';
import { subscribeTradingEvents } from '../services/tradingEvents';
import { createTradingBot, getTradingAccounts, getTradingBotDecisions, getTradingBotGridPlan, getTradingBotPaperPerformance, getTradingBotSignals, getTradingBots, previewTradingGridPlan, runTradingBotAction, type CreateTradingBotInput, type TradingAccount, type TradingBot, type TradingBotDecision, type TradingBotPaperPerformance, type TradingBotSignal, type TradingBotState, type TradingGridPlan } from '../services/tradingService';

const stateLabels: Record<TradingBotState, string> = {
  DRAFT: 'Taslak', VALIDATING: 'Doğrulanıyor', STARTING: 'Başlatılıyor', RUNNING: 'Çalışıyor', PAUSED: 'Duraklatıldı',
  STOPPED: 'Durduruldu', RISK_BLOCKED: 'Risk engeli', RECONCILING: 'Mutabakat', EMERGENCY_STOPPED: 'Acil durduruldu', ERROR: 'Hata',
};
const stateTones: Record<TradingBotState, string> = {
  DRAFT: 'bg-surface-highest text-on-surface-variant', VALIDATING: 'bg-tertiary/10 text-tertiary', STARTING: 'bg-primary/10 text-primary',
  RUNNING: 'bg-secondary/10 text-secondary', PAUSED: 'bg-tertiary/10 text-tertiary', STOPPED: 'bg-surface-highest text-on-surface-variant',
  RISK_BLOCKED: 'bg-error/10 text-error', RECONCILING: 'bg-primary/10 text-primary', EMERGENCY_STOPPED: 'bg-error/15 text-error', ERROR: 'bg-error/10 text-error',
};

export default function TradingBots({ fixedType }: { fixedType?: 'GRID' } = {}) {
  const [bots, setBots] = useState<TradingBot[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const [botData, accountData] = await Promise.all([getTradingBots(), getTradingAccounts()]);
      setBots(botData); setAccounts(accountData);
    } catch (reason) { setError(getApiErrorMessage(reason, 'Botlar alınamadı.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const accountIds = useMemo(() => [...new Set(bots.map((item) => item.exchangeAccountId))].sort().join(','), [bots]);
  useEffect(() => {
    if (!accountIds) return;
    const cleanups = accountIds.split(',').map((accountId) => subscribeTradingEvents(accountId, (event) => {
      if (event.topic === 'trading.bot') void load();
    }, () => undefined));
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [accountIds, load]);

  async function action(bot: TradingBot, value: 'validate' | 'start' | 'pause' | 'resume' | 'stop' | 'emergency-stop') {
    setBusyId(bot.id); setError('');
    try {
      const updated = await runTradingBotAction(bot.id, value);
      setBots((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) { setError(getApiErrorMessage(reason, 'Bot işlemi tamamlanamadı.')); }
    finally { setBusyId(''); }
  }

  const visibleBots = fixedType ? bots.filter((item) => item.type === fixedType) : bots;
  const running = visibleBots.filter((item) => ['STARTING', 'RUNNING', 'RECONCILING'].includes(item.state)).length;
  const blocked = visibleBots.filter((item) => ['RISK_BLOCKED', 'EMERGENCY_STOPPED', 'ERROR'].includes(item.state)).length;

  return <div className="space-y-6">
    <header className="rounded-[30px] border border-primary/15 bg-gradient-to-br from-surface via-surface to-primary/10 p-6 md:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-secondary/10 px-3 py-1.5 text-xs font-black uppercase tracking-wider text-secondary"><ShieldCheck size={15}/> Shadow güvenlik katmanı</div><h1 className="font-headline text-3xl font-black text-white md:text-4xl">{fixedType === 'GRID' ? 'Grid Bot' : 'Botlar'}</h1><p className="mt-3 max-w-2xl text-on-surface-variant">{fixedType === 'GRID' ? 'Fiyat aralığı ve grid seviyeleriyle çalışan botları SHADOW/PAPER modunda yönetin.' : 'Botları oluşturun, risk kapılarından geçirin ve borsaya emir göndermeyen SHADOW/PAPER modunda izleyin.'}</p></div>
        <div className="flex flex-col gap-2 sm:flex-row"><Link to="/admin/trading/bots/guide" className="inline-flex items-center justify-center gap-2 rounded-2xl border border-outline/15 bg-surface-high px-5 py-3 font-bold text-white"><BookOpen size={19}/> Bot rehberi</Link><button type="button" onClick={() => setWizardOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-black text-background"><Plus size={19}/> {fixedType === 'GRID' ? 'Grid bot oluştur' : 'Yeni bot oluştur'}</button></div>
      </div>
    </header>

    <div className="grid gap-4 sm:grid-cols-3">
      <Metric label={fixedType === 'GRID' ? 'Toplam grid bot' : 'Toplam bot'} value={visibleBots.length}/><Metric label="Aktif / başlıyor" value={running}/><Metric label="Dikkat gereken" value={blocked} warning={blocked > 0}/>
    </div>
    <div className="flex items-start gap-3 rounded-2xl border border-tertiary/20 bg-tertiary/5 p-4 text-sm text-on-surface-variant"><AlertTriangle className="mt-0.5 shrink-0 text-tertiary" size={19}/><p><strong className="text-white">Demo emir kilidi açık.</strong> Bu sürüm yalnızca varsayımsal karar üretir. Binance Demo emri, shadow kabulünden sonra ayrıca açılacaktır.</p></div>
    {error && <div className="rounded-2xl border border-error/20 bg-error/10 p-4 text-error">{error}</div>}

    {loading ? <div className="grid gap-4 xl:grid-cols-2">{[1, 2].map((item) => <div key={item} className="h-64 animate-pulse rounded-[26px] bg-surface"/>)}</div> : visibleBots.length === 0 ?
      <div className="rounded-[28px] border border-dashed border-outline/20 bg-surface p-10 text-center"><Bot className="mx-auto text-primary" size={38}/><h2 className="mt-4 font-headline text-2xl font-black text-white">Henüz bot yok</h2><p className="mx-auto mt-2 max-w-lg text-on-surface-variant">İlk botunuzu SHADOW modunda oluşturun. Doğrulama sırasında bağlantı, risk profili ve kill switch kontrolleri yapılır.</p><button type="button" onClick={() => setWizardOpen(true)} className="mt-5 rounded-xl bg-primary px-5 py-3 font-bold text-background">İlk botu oluştur</button></div> :
      <div className="grid gap-4 xl:grid-cols-2">{visibleBots.map((bot) => <BotCard key={bot.id} bot={bot} busy={busyId === bot.id} onAction={(value) => void action(bot, value)}/>)}</div>}

    {wizardOpen && <BotWizard accounts={accounts} initialType={fixedType} onClose={() => setWizardOpen(false)} onCreated={(bot) => { setBots((current) => [bot, ...current]); setWizardOpen(false); }}/>} 
  </div>;
}

function BotCard({ bot, busy, onAction }: { bot: TradingBot; busy: boolean; onAction: (action: 'validate' | 'start' | 'pause' | 'resume' | 'stop' | 'emergency-stop') => void }) {
  const accountBlocked = !bot.exchangeAccount.isActive || bot.exchangeAccount.connectionStatus !== 'CONNECTED';
  const [decisionsOpen, setDecisionsOpen] = useState(false);
  const [decisions, setDecisions] = useState<TradingBotDecision[]>([]);
  const [signals, setSignals] = useState<TradingBotSignal[]>([]);
  const [decisionError, setDecisionError] = useState('');
  const [decisionsLoading, setDecisionsLoading] = useState(false);
  const [paperPerformance, setPaperPerformance] = useState<TradingBotPaperPerformance | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [gridPlan, setGridPlan] = useState<TradingGridPlan | null>(null);
  const [detailsError, setDetailsError] = useState('');
  const [detailsLoading, setDetailsLoading] = useState(false);
  useEffect(() => {
    if (!decisionsOpen) return;
    let active = true; setDecisionsLoading(true); setDecisionError('');
    Promise.all([getTradingBotDecisions(bot.id), getTradingBotSignals(bot.id), bot.mode === 'PAPER' ? getTradingBotPaperPerformance(bot.id) : Promise.resolve(null)])
      .then(([items, signalItems, performance]) => { if (active) { setDecisions(items); setSignals(signalItems); setPaperPerformance(performance); } })
      .catch((reason) => { if (active) setDecisionError(getApiErrorMessage(reason, 'Karar geçmişi alınamadı.')); })
      .finally(() => { if (active) setDecisionsLoading(false); });
    return () => { active = false; };
  }, [bot.id, bot.lastDecisionAt, decisionsOpen]);
  useEffect(() => {
    if (!detailsOpen || bot.type !== 'GRID') return;
    let active = true; setDetailsLoading(true); setDetailsError('');
    getTradingBotGridPlan(bot.id).then((plan) => { if (active) setGridPlan(plan); }).catch((reason) => { if (active) setDetailsError(getApiErrorMessage(reason, 'Grid planı alınamadı.')); }).finally(() => { if (active) setDetailsLoading(false); });
    return () => { active = false; };
  }, [bot.id, bot.lastDecisionAt, bot.type, detailsOpen]);
  return <article className="rounded-[26px] border border-outline/10 bg-surface p-5">
    <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-headline text-xl font-black text-white">{bot.name}</h2><span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide ${stateTones[bot.state]}`}>{stateLabels[bot.state]}</span></div><p className="mt-2 text-sm text-on-surface-variant">{bot.symbol} · {bot.type === 'SCALPING' ? 'Scalping' : 'Grid'} · {bot.mode}</p></div><Bot className="text-primary" size={24}/></div>
    <div className="mt-5 grid grid-cols-2 gap-3 text-sm"><Info label="Borsa hesabı" value={`${bot.exchangeAccount.name} · ${bot.exchangeAccount.environment}`}/><Info label="Çevrim" value={`${bot.intervalSeconds} saniye`}/><Info label="Son heartbeat" value={formatDate(bot.heartbeatAt)}/><Info label="Son karar" value={formatDate(bot.lastDecisionAt)}/></div>
    {(accountBlocked || bot.stateReason) && <div className={`mt-4 rounded-xl p-3 text-sm ${accountBlocked || ['RISK_BLOCKED', 'ERROR', 'EMERGENCY_STOPPED'].includes(bot.state) ? 'bg-error/10 text-error' : 'bg-surface-high text-on-surface-variant'}`}>{accountBlocked ? `Bağlantı engeli: ${bot.exchangeAccount.connectionStatus}` : bot.stateReason}</div>}
    <div className="mt-5 flex flex-wrap gap-2">
      {['DRAFT', 'RISK_BLOCKED', 'ERROR'].includes(bot.state) && <Action disabled={busy} onClick={() => onAction('validate')} icon={RefreshCw} label="Doğrula"/>}
      {bot.state === 'STOPPED' && <Action disabled={busy || accountBlocked} onClick={() => onAction('start')} icon={Play} label="Başlat" primary/>}
      {['STARTING', 'RUNNING', 'RECONCILING', 'RISK_BLOCKED'].includes(bot.state) && <Action disabled={busy} onClick={() => onAction('pause')} icon={Pause} label="Duraklat"/>}
      {bot.state === 'PAUSED' && <Action disabled={busy || accountBlocked} onClick={() => onAction('resume')} icon={Play} label="Devam et" primary/>}
      {!['DRAFT', 'STOPPED', 'EMERGENCY_STOPPED'].includes(bot.state) && <Action disabled={busy} onClick={() => onAction('stop')} icon={Square} label="Durdur"/>}
      {!['DRAFT', 'EMERGENCY_STOPPED'].includes(bot.state) && <Action disabled={busy} onClick={() => onAction('emergency-stop')} icon={CircleStop} label="Acil durdur" danger/>}
    </div>
    <div className="mt-4 border-t border-outline/10 pt-4"><button type="button" onClick={() => setDetailsOpen((value) => !value)} className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-high hover:text-white"><span className="inline-flex items-center gap-2"><ListTree size={16}/> Bot detayları{bot.type === 'GRID' ? ' ve grid planı' : ''}</span><ChevronDown size={17} className={`transition-transform ${detailsOpen ? 'rotate-180' : ''}`}/></button>{detailsOpen && <div className="mt-3 space-y-3"><ConfigurationDetails bot={bot} gridPlan={gridPlan} livePriceLoading={detailsLoading}/>{bot.type === 'GRID' && (detailsLoading ? <div className="h-32 animate-pulse rounded-xl bg-surface-high"/> : detailsError ? <p className="rounded-xl bg-error/10 p-3 text-sm text-error">{detailsError}</p> : gridPlan && <GridPlanView plan={gridPlan}/>)}</div>}</div>
    <div className="mt-4 border-t border-outline/10 pt-4"><button type="button" onClick={() => setDecisionsOpen((value) => !value)} className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-high hover:text-white"><span>{bot.mode === 'PAPER' ? 'PAPER performansı, sinyaller ve kararlar' : 'Sinyaller ve strateji kararları'}</span><ChevronDown size={17} className={`transition-transform ${decisionsOpen ? 'rotate-180' : ''}`}/></button>{decisionsOpen && <div className="mt-3 space-y-2">{decisionsLoading ? <div className="h-16 animate-pulse rounded-xl bg-surface-high"/> : decisionError ? <p className="rounded-xl bg-error/10 p-3 text-sm text-error">{decisionError}</p> : <>{bot.mode === 'PAPER' && <PaperSummary performance={paperPerformance}/>}<SignalComparison signals={signals}/>{decisions.length === 0 ? <p className="rounded-xl bg-surface-high p-3 text-sm text-on-surface-variant">Henüz strateji kararı yok. Bot çalıştığında ilk kayıt WARMING_UP olacaktır.</p> : decisions.slice(0, 5).map((item) => <DecisionRow key={item.id} decision={item}/>)}</>}</div>}</div>
  </article>;
}

function SignalComparison({ signals }: { signals: TradingBotSignal[] }) {
  const ai = signals.find((signal) => signal.source === 'AI_MODEL');
  const rulesByDecision = new Map(signals.filter((signal) => signal.source === 'RULE_ENGINE' && signal.decisionId).map((signal) => [signal.decisionId, signal]));
  const latestRule = signals.find((signal) => signal.source === 'RULE_ENGINE');
  const rule = (ai?.decisionId ? rulesByDecision.get(ai.decisionId) : undefined) ?? latestRule;
  if (!rule) return <div className="rounded-xl border border-dashed border-outline/20 p-3 text-sm text-on-surface-variant">Sinyal defteri ilk scheduler çevrimini bekliyor.</div>;
  const agreement = ai ? ai.action === rule.action : null;
  const pairs = signals.filter((signal) => signal.source === 'AI_MODEL' && signal.decisionId && rulesByDecision.has(signal.decisionId));
  const agreements = pairs.filter((signal) => rulesByDecision.get(signal.decisionId)?.action === signal.action).length;
  return <div className="rounded-xl border border-primary/15 bg-primary/5 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-black text-primary">SHADOW SİNYAL KARŞILAŞTIRMASI</span>{agreement !== null && <span className={`rounded-md px-2 py-1 text-[10px] font-black ${agreement ? 'bg-secondary/10 text-secondary' : 'bg-tertiary/10 text-tertiary'}`}>{agreement ? 'AYNI YÖN' : 'FARKLI YÖN'}</span>}</div>{pairs.length > 0 && <p className="mt-2 text-xs text-on-surface-variant">Son kayıtlarda yön uyumu: <strong className="text-white">{agreements} / {pairs.length} · %{Math.round((agreements / pairs.length) * 100)}</strong>. Bu oran performans veya kârlılık garantisi değildir.</p>}<div className="mt-3 grid gap-2 md:grid-cols-2"><SignalSummary signal={rule}/>{ai ? <SignalSummary signal={ai}/> : <div className="rounded-lg border border-dashed border-outline/20 p-3"><p className="text-xs font-black text-on-surface-variant">AI_MODEL · GÖZLEMCİ KAPALI</p><p className="mt-2 text-xs leading-5 text-outline">AI adapter yapılandırıldığında yalnızca OBSERVED sinyali burada görünür. PAPER fill ve borsa emir yetkisi yoktur.</p></div>}</div></div>;
}

function SignalSummary({ signal }: { signal: TradingBotSignal }) {
  const confidence = `${Math.round(Number(signal.confidence) * 100)}%`;
  const actionable = signal.action !== 'HOLD';
  return <div className="rounded-lg bg-surface-high p-3"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-surface-highest px-2 py-1 text-[10px] font-black text-on-surface-variant">{signal.source}</span><span className={`rounded-md px-2 py-1 text-[10px] font-black ${actionable ? 'bg-primary/10 text-primary' : 'bg-surface-highest text-on-surface-variant'}`}>{signal.action}</span><span className="text-xs text-outline">Güven {confidence}</span></div><p className="mt-2 text-sm text-on-surface">{signal.rationale}</p><p className="mt-1 text-xs text-on-surface-variant">{signal.status} · Emir yetkisi kapalı · {formatDate(signal.decidedAt ?? signal.createdAt)}</p>{signal.modelName && <p className="mt-1 text-[11px] text-outline">{signal.modelProvider} · {signal.modelName} · {signal.promptVersion}</p>}</div>;
}

function BotWizard({ accounts, initialType, onClose, onCreated }: { accounts: TradingAccount[]; initialType?: 'GRID'; onClose: () => void; onCreated: (bot: TradingBot) => void }) {
  const usable = accounts.filter((item) => item.isActive && item.connectionStatus === 'CONNECTED');
  const [step, setStep] = useState(1); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', exchangeAccountId: usable[0]?.id ?? '', type: (initialType ?? 'SCALPING') as 'SCALPING' | 'GRID', mode: 'SHADOW' as 'SHADOW' | 'PAPER', symbol: 'BTCUSDT', intervalSeconds: 60, quantity: '0.001', leverage: 2, lowerPrice: '50000', upperPrice: '80000', gridLevels: 10 });
  const [gridPlan, setGridPlan] = useState<TradingGridPlan | null>(null); const [planLoading, setPlanLoading] = useState(false);
  const gridConfiguration = (): Extract<CreateTradingBotInput, { type: 'GRID' }>['configuration'] => ({ marketType: 'FUTURES', gridDirection: 'NEUTRAL', spacingType: 'ARITHMETIC', lowerPrice: form.lowerPrice, upperPrice: form.upperPrice, gridLevels: form.gridLevels, quantityPerGrid: form.quantity, leverage: form.leverage, marginMode: 'ISOLATED', paperFeeBps: 4, paperSlippageBps: 2 });
  async function next() {
    if (step !== 2 || form.type !== 'GRID') { setStep(step + 1); return; }
    setPlanLoading(true); setError('');
    try { setGridPlan(await previewTradingGridPlan({ exchangeAccountId: form.exchangeAccountId, symbol: form.symbol, configuration: gridConfiguration() })); setStep(3); }
    catch (reason) { setError(getApiErrorMessage(reason, 'Grid planı oluşturulamadı.')); }
    finally { setPlanLoading(false); }
  }
  async function submit() {
    setSaving(true); setError('');
    const common = { name: form.name, exchangeAccountId: form.exchangeAccountId, mode: form.mode, symbol: form.symbol, intervalSeconds: form.intervalSeconds };
    const input: CreateTradingBotInput = form.type === 'SCALPING' ? { ...common, type: 'SCALPING', configuration: { side: 'BOTH', quantity: form.quantity, leverage: form.leverage, marginMode: 'ISOLATED', signalThresholdBps: 25, paperFeeBps: 4, paperSlippageBps: 2 } } : { ...common, type: 'GRID', configuration: gridConfiguration() };
    try { onCreated(await createTradingBot(input)); } catch (reason) { setError(getApiErrorMessage(reason, 'Bot oluşturulamadı.')); setSaving(false); }
  }
  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-outline/15 bg-surface p-6 shadow-2xl">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-wider text-primary">Adım {step} / 3</p><h2 className="mt-1 font-headline text-2xl font-black text-white">Bot oluşturma sihirbazı</h2><Link to="/admin/trading/bots/guide" onClick={onClose} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-tertiary hover:text-white"><BookOpen size={14}/> Seçenekleri ayrıntılı öğren</Link></div><button type="button" onClick={onClose} className="rounded-xl p-2 text-on-surface-variant hover:bg-surface-high"><X/></button></div>
    <div className="mt-5 grid grid-cols-3 gap-2">{[1, 2, 3].map((item) => <div key={item} className={`h-1.5 rounded-full ${item <= step ? 'bg-primary' : 'bg-surface-highest'}`}/>)}</div>
    {usable.length === 0 ? <div className="mt-6 rounded-2xl bg-error/10 p-4 text-error">Çalışır durumda bir testnet/demo borsa hesabı gerekli.</div> : <div className="mt-6 space-y-4">
      {step === 1 && <><Field label="Bot adı" help="Botu listede ayırt etmenizi sağlar; stratejinin davranışını değiştirmez."><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={initialType === 'GRID' ? 'BTC Paper Grid' : 'BTC Shadow Scalper'} className="input"/></Field><Field label="Borsa hesabı" help="Botun piyasa verisini okuyacağı testnet/demo hesabıdır. Bu sürüm gerçek para hesabı kabul etmez."><select value={form.exchangeAccountId} onChange={(event) => setForm({ ...form, exchangeAccountId: event.target.value })} className="input">{usable.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.environment}</option>)}</select></Field>{initialType === 'GRID' ? <Choice active onClick={() => undefined} title="Grid" text="Fiyat aralığı ızgarası" help="Bu sayfa yalnızca Grid bot oluşturur. Belirlediğiniz alt ve üst fiyat arasını seviyelere böler."/> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Choice active={form.type === 'SCALPING'} onClick={() => setForm({ ...form, type: 'SCALPING' })} title="Scalping" text="Kısa periyotlu sinyal" help="Küçük fiyat hareketlerini sık aralıklarla izler. Daha hızlı tepki verir; daha fazla sinyal ve gürültü üretebilir."/><Choice active={form.type === 'GRID'} onClick={() => setForm({ ...form, type: 'GRID' })} title="Grid" text="Fiyat aralığı ızgarası" help="Belirlediğiniz alt ve üst fiyat arasını seviyelere böler. Yatay veya dalgalı piyasa fikrini test etmek için uygundur."/></div>}</>}
      {step === 2 && <><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Choice active={form.mode === 'SHADOW'} onClick={() => setForm({ ...form, mode: 'SHADOW' })} title="SHADOW" text="Sinyalleri gözlemle" help="Bot karar üretir fakat emir simülasyonu bile oluşturmaz. Stratejinin ne zaman sinyal verdiğini en güvenli şekilde gözlemlemek içindir."/><Choice active={form.mode === 'PAPER'} onClick={() => setForm({ ...form, mode: 'PAPER' })} title="PAPER" text="Sanal pozisyon ve PnL" help="Sinyali 4 bps ücret ve 2 bps slippage varsayımıyla sanal fill’e dönüştürür; pozisyon ve PnL tutar. Borsaya hiçbir emir göndermez."/></div>{form.type === 'GRID' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Choice active onClick={() => undefined} title="FUTURES" text="USD-M / Unified vadeli grid" help="Kaldıraç ve ISOLATED teminatla planlanan vadeli grid. Bu aşamada yalnızca SHADOW/PAPER çalışır."/><Choice disabled active={false} onClick={() => undefined} title="SPOT · Yakında" text="Kaldıraçsız spot grid" help="Spot envanter ve bakiye tahsis modeli henüz tamamlanmadığı için seçilemez."/></div>}<Field label="Parite" help="Botun izleyeceği işlem çifti. BTCUSDT, Bitcoin fiyatını USDT karşısında izler."><input value={form.symbol} onChange={(event) => setForm({ ...form, symbol: event.target.value.toUpperCase() })} className="input"/></Field><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Çevrim (sn)" help="Botun stratejiyi kaç saniyede bir değerlendireceğidir. Düşük değer daha hızlı ama daha gürültülü kontrol demektir; başlangıç için 60 sn uygundur."><input type="number" min="10" value={form.intervalSeconds} onChange={(event) => setForm({ ...form, intervalSeconds: Number(event.target.value) })} className="input"/></Field><Field label="Kaldıraç" help="Kaldıraç, aynı pozisyon için gereken varsayımsal teminatı ve teminat getiri oranını değiştirir; sabit miktardaki pozisyonun fiyat farkından doğan mutlak PnL'sini tek başına çarpmaz. Başlangıç için 1x–2x seçin."><input type="number" min="1" max="20" value={form.leverage} onChange={(event) => setForm({ ...form, leverage: Number(event.target.value) })} className="input"/></Field></div><Field label={form.type === 'GRID' ? 'Grid başına miktar' : 'Varsayımsal miktar'} help="Her sanal sinyal veya grid seviyesi için kullanılacak varlık miktarıdır. Miktar büyüdükçe varsayımsal risk büyür."><input value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className="input"/></Field>{form.type === 'GRID' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><Field label="Alt fiyat" help="Grid botunun çalışmayı planladığı fiyat aralığının alt sınırıdır."><input value={form.lowerPrice} onChange={(event) => setForm({ ...form, lowerPrice: event.target.value })} className="input"/></Field><Field label="Üst fiyat" help="Grid aralığının üst sınırıdır; alt fiyattan büyük olmalıdır."><input value={form.upperPrice} onChange={(event) => setForm({ ...form, upperPrice: event.target.value })} className="input"/></Field><Field label="Grid seviyesi" help="Alt ve üst fiyat dahil toplam fiyat çizgisi sayısıdır. Örneğin 10 seviye, 9 aralık oluşturur."><input type="number" min="2" max="100" value={form.gridLevels} onChange={(event) => setForm({ ...form, gridLevels: Number(event.target.value) })} className="input"/></Field></div>}</>}
      {step === 3 && <div className="space-y-3"><div className="rounded-2xl bg-surface-high p-4"><p className="font-bold text-white">{form.name || 'Adsız bot'}</p><p className="mt-2 text-sm text-on-surface-variant">{form.type} · {form.mode} · {form.symbol} · {form.intervalSeconds} sn</p></div>{form.type === 'GRID' && gridPlan && <GridPlanView plan={gridPlan}/>}<div className="flex gap-3 rounded-2xl border border-secondary/20 bg-secondary/5 p-4 text-sm text-on-surface-variant"><Sparkles className="shrink-0 text-secondary" size={20}/><p>Bot taslak olarak kaydedilir. Önce <strong className="text-white">Doğrula</strong>, ardından <strong className="text-white">Başlat</strong> adımı gerekir. Grid tablosu plan kaydıdır; borsaya emir gönderilmez.</p></div></div>}
      {error && <div className="rounded-xl bg-error/10 p-3 text-sm text-error">{error}</div>}
    </div>}
    <div className="mt-6 flex justify-between"><button type="button" onClick={() => step === 1 ? onClose() : setStep(step - 1)} className="rounded-xl border border-outline/15 px-4 py-3 font-bold text-on-surface-variant">{step === 1 ? 'Vazgeç' : 'Geri'}</button>{usable.length > 0 && (step < 3 ? <button type="button" disabled={(step === 1 && form.name.trim().length < 3) || planLoading} onClick={() => void next()} className="rounded-xl bg-primary px-5 py-3 font-black text-background disabled:opacity-40">{planLoading ? 'Plan hazırlanıyor…' : 'Devam'}</button> : <button type="button" disabled={saving} onClick={() => void submit()} className="rounded-xl bg-primary px-5 py-3 font-black text-background disabled:opacity-50">{saving ? 'Oluşturuluyor…' : 'Taslağı oluştur'}</button>)}</div>
  </div></div>;
}

function ConfigurationDetails({ bot, gridPlan, livePriceLoading }: { bot: TradingBot; gridPlan: TradingGridPlan | null; livePriceLoading: boolean }) {
  const labels: Record<string, string> = { marketType: 'Piyasa', gridDirection: 'Grid yönü', spacingType: 'Dağılım', lowerPrice: 'Alt fiyat', upperPrice: 'Üst fiyat', gridLevels: 'Grid seviyesi', quantityPerGrid: 'Seviye başına miktar', quantity: 'Miktar', leverage: 'Kaldıraç', marginMode: 'Teminat modu', side: 'Yön filtresi', signalThresholdBps: 'Sinyal eşiği (bps)', paperFeeBps: 'PAPER ücret (bps)', paperSlippageBps: 'PAPER slippage (bps)' };
  const entries = Object.entries(bot.configuration).filter(([key]) => labels[key]);
  return <div className="rounded-xl bg-surface-high p-3"><p className="text-xs font-black uppercase tracking-wider text-primary">Kayıtlı yapılandırma</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-3">{entries.map(([key, value]) => <div key={key} className="rounded-lg bg-background/30 p-2"><p className="text-outline">{labels[key]}</p><p className="mt-1 font-bold text-white">{key === 'leverage' ? `${String(value)}x` : String(value)}</p></div>)}{bot.type === 'GRID' && <div className="rounded-lg border border-secondary/15 bg-secondary/5 p-2"><p className="text-secondary">Canlı mark fiyatı</p><p className="mt-1 font-bold text-white">{livePriceLoading && !gridPlan ? 'Yükleniyor…' : gridPlan ? formatDecimal(gridPlan.markPrice) : 'Alınamadı'}</p></div>}</div><p className="mt-3 text-xs text-on-surface-variant">{bot.type === 'GRID' ? `Grid planı kayıtlı yapılandırmadan yeniden üretilir; BUY/SELL dağılımı güncel mark fiyatına göre değişebilir.${gridPlan ? ` Son fiyat okuması: ${formatDate(gridPlan.generatedAt)}` : ''}` : 'Bu değerler bot oluşturulurken kaydedilen strateji ayarlarıdır.'}</p></div>;
}

function GridPlanView({ plan }: { plan: TradingGridPlan }) {
  return <div className="overflow-hidden rounded-xl border border-outline/10 bg-surface-high"><div className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wider text-primary">Futures Grid Planı · {plan.gridDirection}</p><p className="mt-1 text-sm text-on-surface-variant">Mark: <strong className="text-white">{formatDecimal(plan.markPrice)}</strong> · {formatDecimal(plan.lowerPrice)}–{formatDecimal(plan.upperPrice)} · {plan.gridLevels} seviye / {plan.gridIntervals} aralık</p></div><span className={`rounded-lg px-2 py-1 text-[10px] font-black ${plan.markPriceInRange ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'}`}>{plan.markPriceInRange ? 'FİYAT ARALIKTA' : 'ARALIK DIŞI'}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4"><GridMetric label="Fiyat adımı" value={formatDecimal(plan.priceSpacing)}/><GridMetric label="BUY / SELL" value={`${plan.buyCount} / ${plan.sellCount}`}/><GridMetric label="Azami plan notional" value={`${formatDecimal(plan.maximumPlannedNotional)} USDT`}/><GridMetric label="Tahmini teminat" value={`${formatDecimal(plan.estimatedMaximumInitialMargin)} USDT`}/></div><div className="mt-3 rounded-lg border border-tertiary/15 bg-tertiary/5 p-3 text-xs leading-5 text-on-surface-variant">Bu liste henüz borsa emri değildir. Spot seçimi, tasfiye ve funding hesabı bu sürümde kapalıdır.</div></div><div className="max-h-72 overflow-auto border-t border-outline/10"><table className="w-full min-w-[680px] text-left text-xs"><thead className="sticky top-0 bg-surface-highest text-outline"><tr><th className="p-3">#</th><th className="p-3">Fiyat</th><th className="p-3">Plan</th><th className="p-3">Miktar</th><th className="p-3">Notional</th><th className="p-3">Teminat</th><th className="p-3">Mark farkı</th></tr></thead><tbody>{[...plan.levels].reverse().map((level) => <tr key={level.index} className="border-t border-outline/10"><td className="p-3 text-outline">{level.index}</td><td className="p-3 font-bold text-white">{formatDecimal(level.price)}</td><td className="p-3"><span className={`rounded-md px-2 py-1 font-black ${level.side === 'BUY' ? 'bg-primary/10 text-primary' : level.side === 'SELL' ? 'bg-error/10 text-error' : 'bg-surface-highest text-outline'}`}>{level.side}</span></td><td className="p-3">{formatDecimal(level.quantity)}</td><td className="p-3">{formatDecimal(level.notional)}</td><td className="p-3">{formatDecimal(level.estimatedInitialMargin)}</td><td className="p-3">{Number(level.distancePercent) > 0 ? '+' : ''}{level.distancePercent}%</td></tr>)}</tbody></table></div>{plan.warnings.length > 0 && <div className="border-t border-outline/10 p-3 text-[11px] leading-5 text-outline">{plan.warnings.join(' · ')}</div>}</div>;
}

function GridMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-background/30 p-2"><p className="text-outline">{label}</p><p className="mt-1 font-bold text-white">{value}</p></div>; }

function Metric({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) { return <div className="rounded-2xl border border-outline/10 bg-surface p-5"><p className="text-sm text-on-surface-variant">{label}</p><p className={`mt-2 font-headline text-3xl font-black ${warning ? 'text-error' : 'text-white'}`}>{value}</p></div>; }
function DecisionRow({ decision }: { decision: TradingBotDecision }) { const actionable = ['BUY', 'SELL', 'GRID_BUY', 'GRID_SELL'].includes(decision.kind); return <div className="rounded-xl bg-surface-high p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className={`rounded-md px-2 py-1 text-[10px] font-black ${actionable ? 'bg-primary/10 text-primary' : 'bg-surface-highest text-on-surface-variant'}`}>{decision.kind}</span><span className="text-xs text-outline">{formatDate(decision.occurredAt)}</span></div><p className="mt-2 text-sm text-on-surface">{decision.summary}</p><p className="mt-1 text-xs text-on-surface-variant">Mark fiyatı: {decision.markPrice}{decision.referencePrice ? ` · Önceki: ${decision.referencePrice}` : ''}{decision.hypotheticalOrder ? ' · PAPER emir kaydı' : ''}</p></div>; }
function PaperSummary({ performance }: { performance: TradingBotPaperPerformance | null }) { const position = performance?.position; if (!position) return <div className="rounded-xl border border-tertiary/15 bg-tertiary/5 p-3 text-sm text-on-surface-variant">Henüz sanal fill oluşmadı. İlk PAPER sinyalinde pozisyon ve PnL defteri başlayacak.</div>; const side = Number(position.netQuantity) > 0 ? 'LONG' : Number(position.netQuantity) < 0 ? 'SHORT' : 'FLAT'; const pnlPositive = Number(position.netPnl) >= 0; return <div className="rounded-xl border border-tertiary/20 bg-tertiary/5 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-black text-tertiary">Sanal pozisyon · {side}</span><span className={`text-sm font-black ${pnlPositive ? 'text-primary' : 'text-error'}`}>Net PnL {formatDecimal(position.netPnl)} USDT</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-on-surface-variant"><span>Miktar: {formatDecimal(position.netQuantity)}</span><span>Ort. giriş: {formatDecimal(position.avgEntryPrice)}</span><span>Gerçekleşen: {formatDecimal(position.realizedPnl)}</span><span>Gerçekleşmemiş: {formatDecimal(position.unrealizedPnl)}</span><span>Ücret: {formatDecimal(position.totalFees)}</span><span>Fill: {position.totalFills}</span></div><p className="mt-2 text-[11px] text-outline">Varsayım: 4 bps ücret + 2 bps slippage. Borsaya emir gönderilmedi.</p></div>; }
function formatDecimal(value: string) { const number = Number(value); return Number.isFinite(number) ? number.toLocaleString('tr-TR', { maximumFractionDigits: 8 }) : value; }
function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-surface-high p-3"><p className="text-[10px] font-black uppercase tracking-wide text-outline">{label}</p><p className="mt-1 truncate font-semibold text-on-surface">{value}</p></div>; }
function Action({ icon: Icon, label, primary, danger, ...props }: { icon: typeof Play; label: string; primary?: boolean; danger?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) { return <button type="button" {...props} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-40 ${primary ? 'bg-primary text-background' : danger ? 'bg-error/10 text-error' : 'bg-surface-high text-on-surface-variant'}`}><Icon size={16}/>{label}</button>; }
function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) { return <label className="block text-sm font-bold text-on-surface-variant"><span className="inline-flex items-center gap-1.5">{label}{help && <HelpTip text={help}/>}</span><div className="mt-2 [&_.input]:w-full [&_.input]:rounded-xl [&_.input]:border [&_.input]:border-outline/15 [&_.input]:bg-background/40 [&_.input]:px-4 [&_.input]:py-3 [&_.input]:text-white [&_.input]:outline-none [&_.input]:focus:border-primary">{children}</div></label>; }
function Choice({ active, onClick, title, text, help, disabled = false }: { active: boolean; onClick: () => void; title: string; text: string; help: string; disabled?: boolean }) { return <button type="button" disabled={disabled} onClick={onClick} aria-label={`${title}. ${help}`} className={`group relative rounded-2xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-45 ${active ? 'border-primary bg-primary/10' : 'border-outline/10 bg-surface-high'}`}><span className="flex items-center justify-between gap-2"><span className="font-black text-white">{title}</span><InfoIcon size={16} className="text-tertiary"/></span><span className="mt-1 block text-xs text-on-surface-variant">{text}</span><span role="tooltip" className="pointer-events-none invisible absolute bottom-[calc(100%+8px)] left-0 z-30 w-[min(280px,75vw)] rounded-xl border border-outline/15 bg-surface-highest p-3 text-xs font-medium leading-5 text-on-surface opacity-0 shadow-2xl transition group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100">{help}</span></button>; }
function HelpTip({ text }: { text: string }) { return <span tabIndex={0} aria-label={text} className="group relative inline-flex cursor-help rounded-full text-tertiary outline-none focus:ring-2 focus:ring-primary/50"><InfoIcon size={15}/><span role="tooltip" className="pointer-events-none invisible absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-[min(280px,75vw)] -translate-x-1/2 rounded-xl border border-outline/15 bg-surface-highest p-3 text-xs font-medium leading-5 text-on-surface opacity-0 shadow-2xl transition group-hover:visible group-hover:opacity-100 group-focus:visible group-focus:opacity-100">{text}</span></span>; }
function formatDate(value?: string) { return value ? new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Henüz yok'; }
