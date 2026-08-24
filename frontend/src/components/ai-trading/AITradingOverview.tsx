import { Activity, Bot, BrainCircuit, ChartNoAxesCombined, FlaskConical, Orbit, ShieldCheck, Trophy } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiErrorMessage } from '../../services/apiClient';
import { aiTradingApi, recordNumber, type ArenaStatus, type AuditActivity, type AutonomousBot, type AutonomousHealth, type AutonomousLifecycle, type AutonomousOverview, type LeaderboardRow, type MarketContext, type ResearchHypothesis, type TeacherEvaluation, type TradeSummary, type TradingUniverse } from '../../services/aiTradingService';
import { AITradingPage, EmptyState, ErrorState, formatDate, formatMoney, MetricCard, ModeBadge, RefreshButton, StatusBadge } from './AITradingUI';

type OverviewState = {
  overview: AutonomousOverview | null; arena: ArenaStatus | null; health: AutonomousHealth | null;
  bots: AutonomousBot[]; leaderboard: LeaderboardRow[]; summaries: TradeSummary[]; market: MarketContext | null;
  teachers: TeacherEvaluation[]; research: ResearchHypothesis[]; activity: AuditActivity[]; universe: TradingUniverse | null; warnings: string[];
};

const emptyState: OverviewState = { overview: null, arena: null, health: null, bots: [], leaderboard: [], summaries: [], market: null, teachers: [], research: [], activity: [], universe: null, warnings: [] };

export default function AITradingOverview() {
  const [data, setData] = useState<OverviewState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingSymbol, setSavingSymbol] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const requests = await Promise.allSettled([
      aiTradingApi.overview(), aiTradingApi.arenaStatus(), aiTradingApi.health(), aiTradingApi.bots(),
      aiTradingApi.leaderboard(10), aiTradingApi.tradeSummary('BOT', 100), aiTradingApi.marketContext(),
      aiTradingApi.teacherEvaluations(5), aiTradingApi.researchHypotheses(5), aiTradingApi.audit(12), aiTradingApi.tradingUniverse(),
    ]);
    const required = requests[0];
    if (required.status === 'rejected') {
      setError(getApiErrorMessage(required.reason, 'AI Trading Overview alınamadı.'));
      setData(emptyState); setLoading(false); return;
    }
    const value = <T,>(index: number, fallback: T): T => requests[index]?.status === 'fulfilled' ? requests[index].value as T : fallback;
    const warnings = requests.flatMap((result, index) => result.status === 'rejected' ? [`${sectionNames[index]} verisi alınamadı.`] : []);
    setData({
      overview: required.value.data,
      arena: value<Awaited<ReturnType<typeof aiTradingApi.arenaStatus>> | null>(1, null)?.data ?? null,
      health: value<AutonomousHealth | null>(2, null), bots: value(3, []), leaderboard: value(4, []), summaries: value(5, []),
      market: value(6, null), teachers: value(7, []), research: value(8, []), activity: value(9, []), universe: value(10, null), warnings,
    });
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const totals = useMemo(() => aggregateOverview(data.bots, data.summaries, data.leaderboard), [data.bots, data.summaries, data.leaderboard]);
  const counts = useMemo(() => lifecycleCounts(data.bots), [data.bots]);
  const toggleUniverse = async (symbol: string, enabled: boolean) => {
    setSavingSymbol(symbol); setError('');
    try {
      const updated = await aiTradingApi.setTradingUniverseAsset(symbol, enabled);
      setData((current) => current.universe ? { ...current, universe: { ...current.universe, assets: current.universe.assets.map((asset) => asset.symbol === symbol ? updated : asset) } } : current);
    } catch (reason) { setError(getApiErrorMessage(reason, 'Trading Universe seçimi kaydedilemedi.')); }
    finally { setSavingSymbol(''); }
  };

  return <AITradingPage title="AI Trading Operasyon Merkezi" description="Autonomous PAPER ve SHADOW sistemini, risk durumunu ve öğrenme döngüsünü tek güvenli görünümde izleyin." icon={Bot} action={<RefreshButton onClick={() => void load()} busy={loading} />}>
    <div className="flex flex-wrap gap-2"><ModeBadge mode="PAPER" /><ModeBadge mode="SHADOW" /><StatusBadge tone="danger">LIVE KAPALI</StatusBadge><StatusBadge tone={data.overview?.globalKillSwitch ? 'danger' : 'safe'}>Risk Engine · {data.overview?.globalKillSwitch ? 'Emergency stop' : 'Aktif'}</StatusBadge></div>
    {error && <ErrorState message={error} />}
    {data.warnings.length > 0 && <div className="rounded-2xl border border-tertiary/20 bg-tertiary/5 p-4 text-sm text-tertiary">Kısmi veri: {data.warnings.join(' ')}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Sistem" value={data.health?.status ?? (loading ? 'Yükleniyor' : '—')} detail={`Son kontrol ${formatDate(data.health?.checkedAt)}`} help="Node runtime, worker heartbeat ve temel autonomous servis kontrollerinin birleşik sağlık sonucudur. HEALTHY, son kontrolde kritik servis kesintisi görülmediğini belirtir." tone={data.health?.status === 'HEALTHY' ? 'safe' : data.health?.status === 'EMERGENCY_STOPPED' ? 'danger' : 'warning'} />
      <MetricCard label="Aktif bot" value={data.health?.metrics.activeBots ?? data.arena?.states.RUNNING ?? 0} detail={`${data.overview?.bots ?? 0} autonomous bot`} help="Runtime state'i RUNNING olan bot sayısıdır. Botun aktif olması, her kararın emir olacağı anlamına gelmez; HOLD, risk reddi veya mevcut pozisyon nedeniyle işlem açmayabilir." />
      <MetricCard label="Arena" value={`${(data.arena?.throughputPerMinute ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}/dk`} detail={`${data.arena?.decisionsLast5m ?? 0} karar · son 5 dk`} help="Botların ürettiği BUY, SELL ve HOLD kararlarının hızıdır. Karar sayısı emir sayısı değildir; yalnız riskten geçen ve entry şartını sağlayan BUY/SELL kararları işleme dönüşür." />
      <MetricCard label="Piyasa rejimi" value={data.market?.market.trend ?? 'UNKNOWN'} detail={`${data.market?.symbol ?? 'BTCUSDT'} · ${data.market?.market.volatility ?? 'Volatilite bilinmiyor'}`} help="OHLCV ve teknik göstergelerden çıkarılan piyasa koşuludur. Router, botun ilgili coin ve rejimdeki geçmiş başarısını bu sınıfla eşleştirir. UNKNOWN veya eski veri yeni entry'yi engelleyebilir." tone={marketFresh(data.market) ? 'safe' : 'warning'} />
      <MetricCard label="Aggregate PAPER equity" value={formatMoney(totals.equity)} detail="Başlangıç bakiyesi + kapanmış net PnL" help="Tüm PAPER botlarının başlangıç bakiyeleri ile yalnızca kapanmış işlemlerden gelen net PnL toplamıdır. Açık pozisyonların anlık PnL'si dahil değildir." />
      <MetricCard label="Net PnL" value={formatMoney(totals.pnl)} detail={`${totals.tradeCount} kapanmış PAPER trade`} help="Kapanmış PAPER işlemlerinin ücret, funding ve slippage sonrası birikmiş gerçekleşen sonucudur. Açılış fill'leri kâr sayılmaz." tone={totals.pnl === null ? 'neutral' : totals.pnl >= 0 ? 'safe' : 'danger'} />
      <MetricCard label="Max drawdown" value={totals.maxDrawdown === null ? '—' : `${totals.maxDrawdown.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}%`} detail="Leaderboard score evidence" help="İzlenen botlar içindeki en yüksek tepe-dip sermaye kaybıdır. Düşük olması daha iyidir; Challenger kapısının varsayılan üst sınırı %20'dir." tone={totals.maxDrawdown && totals.maxDrawdown > 15 ? 'danger' : 'neutral'} />
      <MetricCard label="Risk durumu" value={data.health?.metrics.emergencyStop ? 'DURDURULDU' : 'FAIL-CLOSED'} detail={`${data.health?.metrics.riskRejectsLast24h ?? 0} reject · son 24 saat`} help="Risk Engine'in güvenlik durumudur. FAIL-CLOSED, veri veya limit kanıtı eksikse emrin varsayılan olarak reddedileceğini ve risk kontrolünün bypass edilmediğini gösterir." tone={data.health?.metrics.emergencyStop ? 'danger' : 'safe'} />
    </div>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <LifecycleCard icon={Bot} label="Candidate" value={counts.CANDIDATE + counts.DRAFT} help="Yeni veya kanıt toplama aşamasındaki botlardır. PAPER performansı henüz Challenger kapılarını geçmemiştir." />
      <LifecycleCard icon={Orbit} label="Challenger" value={counts.CHALLENGER} help="Tüm uygunluk kapılarını geçen ve sıralamada ilk 20 içinde kalan PAPER botlarıdır. İlk uygun seçimde PAPER → Challenger olur." />
      <LifecycleCard icon={Trophy} label="Champion" value={data.overview?.champions ?? counts.CHAMPION} help="Uygunluk koşullarını koruyup sonraki seçimde ilk 10 içinde kalan Challenger botlarıdır. Champion olmak gerçek işlemi otomatik açmaz." />
      <LifecycleCard icon={ShieldCheck} label="Live Eligible" value={data.overview?.liveEligible ?? counts.LIVE_ELIGIBLE} help="Champion sonrası SHADOW kanıtlarını ve ek risk kapılarını geçen botlardır. Yine de manual onay gerekir ve LIVE otomatik etkinleşmez." warning />
    </section>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <section className="overflow-hidden rounded-[24px] border border-outline/10 bg-surface"><SectionHeader icon={ChartNoAxesCombined} title="Top botlar" subtitle="Risk-adjusted Bot Score sırası" />{data.leaderboard.length === 0 ? <div className="p-5"><EmptyState title="Leaderboard boş" description="Backend henüz score snapshot üretmedi." /></div> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-surface-high text-xs uppercase text-outline"><tr><th className="p-4">#</th><th className="p-4">Bot</th><th className="p-4">Score</th><th className="p-4">PnL</th><th className="p-4">Snapshot</th></tr></thead><tbody>{data.leaderboard.slice(0, 8).map((row) => <tr className="border-t border-outline/10" key={row.tradingBotId}><td className="p-4 font-black text-primary">{row.rank}</td><td className="p-4 font-bold text-white">{row.botName}</td><td className="p-4">{row.score.toFixed(2)}</td><td className={`p-4 font-bold ${row.netPnl >= 0 ? 'text-secondary' : 'text-error'}`}>{formatMoney(row.netPnl)}</td><td className="p-4 text-xs text-outline">{formatDate(row.snapshotAt)}</td></tr>)}</tbody></table></div>}</section>
      <div className="space-y-5"><section className="rounded-[24px] border border-outline/10 bg-surface"><SectionHeader icon={Activity} title="Arena durumu" subtitle="Simulation-only runtime" /><div className="space-y-3 p-5"><StateRow label="Execution" value={data.arena?.executionMode ?? '—'} /><StateRow label="Son karar" value={formatDate(data.arena?.latestDecisionAt)} /><StateRow label="PAPER bot" value={String(data.arena?.modes.PAPER ?? 0)} /><StateRow label="SHADOW bot" value={String(data.arena?.modes.SHADOW ?? 0)} /></div></section><TradingUniversePanel universe={data.universe} savingSymbol={savingSymbol} onToggle={toggleUniverse} /></div>
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <InsightPanel icon={BrainCircuit} title="Son Teacher insight" empty="Henüz Teacher evaluation yok." text={data.teachers[0]?.observation} badge="ÖNERİ · UYGULANMADI" date={data.teachers[0]?.createdAt} />
      <InsightPanel icon={FlaskConical} title="Son Researcher hypothesis" empty="Henüz Researcher hypothesis yok." text={data.research[0]?.hypothesis} badge="HİPOTEZ · CANDIDATE ONLY" date={data.research[0]?.createdAt} />
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="rounded-[24px] border border-outline/10 bg-surface"><SectionHeader icon={Activity} title="Son aktiviteler" subtitle="Autonomous audit ledger" /><div className="space-y-2 p-5">{data.activity.length === 0 ? <EmptyState title="Aktivite yok" description="AI audit ledger henüz kayıt içermiyor." /> : data.activity.map((item) => <div key={item.id} className="flex flex-col justify-between gap-2 rounded-xl bg-surface-high p-3 sm:flex-row sm:items-center"><div><p className="text-sm font-bold text-white">{humanize(item.action)}</p><p className="mt-1 text-xs text-on-surface-variant">{item.entityType}{item.entityId ? ` · ${item.entityId}` : ''}</p></div><span className="text-xs text-outline">{formatDate(item.createdAt)}</span></div>)}</div></section>
      <section className="rounded-[24px] border border-outline/10 bg-surface"><SectionHeader icon={BrainCircuit} title="Kararı etkileyen faktörler" subtitle="Sinyalden emre giden aktif kanıtlar" /><div className="space-y-2 p-5">{decisionFactors.map((factor) => <div key={factor.name} className="rounded-xl bg-surface-high p-3"><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-white">{factor.name}</p><StatusBadge tone={factor.tone}>{factor.effect}</StatusBadge></div><p className="mt-2 text-xs leading-5 text-on-surface-variant">{factor.description}</p></div>)}<p className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-[11px] leading-5 text-outline"><strong className="text-primary">Akış:</strong> Market verisi → strateji BUY/SELL/HOLD → coin/rejim bazlı router → Risk Engine → PAPER execution. CoinGecko/CMC bağlam ve kalite verisi sağlar; tek başına BUY/SELL üretmez.</p></div></section>
    </div>
  </AITradingPage>;
}

const sectionNames = ['Overview', 'Arena', 'System health', 'Bot', 'Leaderboard', 'Performance', 'Market context', 'Teacher', 'Researcher', 'Audit', 'Trading Universe'];

const decisionFactors: Array<{ name: string; effect: string; tone: 'neutral' | 'safe' | 'warning'; description: string }> = [
  { name: 'Binance fiyat ve OHLCV', effect: 'BİRİNCİL', tone: 'safe', description: 'Mark price, mumlar, hacim ve volatilite entry fiyatı ile teknik sinyalin ana kaynağıdır. Eski veya eksik veri yeni işlemi engeller.' },
  { name: 'Trend ve momentum göstergeleri', effect: 'YÖN', tone: 'neutral', description: 'EMA, MACD, RSI, Bollinger, ATR, ADX ve VWAP; trend, momentum, aşırı alım/satım ve dinamik risk mesafesini birlikte değerlendirir.' },
  { name: 'Funding, open interest ve order book', effect: 'TEYİT', tone: 'neutral', description: 'Vadeli piyasa yoğunluğunu ve alıcı-satıcı dengesini ölçer. Stratejiye göre sinyali güçlendirebilir, zayıflatabilir veya veto ettirebilir.' },
  { name: 'Coin × bot × piyasa rejimi skoru', effect: 'ROUTER', tone: 'warning', description: 'Aynı botun her coin ve rejimdeki kapanmış işlem başarısı ayrı değerlendirilir; uygun bot havuzu risk-adjusted performansa göre sıralanır.' },
  { name: 'Core Trading Universe', effect: 'FİLTRE', tone: 'warning', description: 'Yalnız admin panelinde aktif olan coinlerde yeni pozisyon açılır. Pasife alınan coinin mevcut pozisyonu normal SL/TP kurallarıyla yönetilmeye devam eder.' },
  { name: 'Risk Engine ve execution kapıları', effect: 'SON KAPI', tone: 'safe', description: 'Pozisyon/notional limiti, kaldıraç, bakiye, tekrar karar, veri tazeliği ve kill switch kontrol edilir. Yalnız onaylanan BUY/SELL kararı PAPER emrine dönüşür.' },
];

export function aggregateOverview(bots: AutonomousBot[], summaries: TradeSummary[], leaderboard: LeaderboardRow[]) {
  const pnl = summaries.length ? summaries.reduce((sum, row) => sum + Number(row.totalPnl || 0), 0) : null;
  const startingBalance = bots.filter((bot) => bot.mode === 'PAPER').reduce((sum, bot) => sum + Number(bot.startingPaperBalance || 0), 0);
  const drawdowns = leaderboard.map((row) => row.maxDrawdown).filter(Number.isFinite);
  return { pnl, equity: bots.length || pnl !== null ? startingBalance + (pnl ?? 0) : null, maxDrawdown: drawdowns.length ? Math.max(...drawdowns) : null, tradeCount: summaries.reduce((sum, row) => sum + row.tradeCount, 0) };
}

function lifecycleCounts(bots: AutonomousBot[]) {
  return bots.reduce<Record<AutonomousLifecycle, number>>((result, bot) => { result[bot.lifecycleStatus] += 1; return result; }, { DRAFT: 0, CANDIDATE: 0, PAPER: 0, TESTING: 0, CHALLENGER: 0, CHAMPION: 0, LIVE_ELIGIBLE: 0, LIVE: 0, PAUSED: 0, REJECTED: 0, ARCHIVED: 0 });
}

function marketFresh(market: MarketContext | null) { return market !== null && Object.values(market.sources).some((source) => source.status === 'FRESH') && !Object.values(market.sources).some((source) => source.status === 'STALE'); }
function humanize(value: string) { return value.replace(/^AI_/, '').replaceAll('_', ' '); }
function LifecycleCard({ icon: Icon, label, value, help, warning = false }: { icon: typeof Bot; label: string; value: number; help: string; warning?: boolean }) { return <div tabIndex={0} title={help} className="group/help relative flex items-center gap-4 rounded-[22px] border border-outline/10 bg-surface p-5 outline-none focus-visible:ring-2 focus-visible:ring-primary/60"><div className={`rounded-xl p-2.5 ${warning ? 'bg-tertiary/10 text-tertiary' : 'bg-primary/10 text-primary'}`}><Icon size={19} /></div><div><p className="font-headline text-2xl font-black text-white">{value}</p><p className="text-xs text-on-surface-variant">{label}</p></div><div role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+8px)] left-3 right-3 z-[70] rounded-xl border border-primary/25 bg-background px-3 py-2 text-xs leading-5 text-on-surface-variant opacity-0 shadow-2xl transition-opacity group-hover/help:opacity-100 group-focus-within/help:opacity-100">{help}</div></div>; }
function SectionHeader({ icon: Icon, title, subtitle }: { icon: typeof Activity; title: string; subtitle: string }) { return <div className="flex items-center gap-3 border-b border-outline/10 p-5"><Icon className="text-primary" size={19} /><div><h2 className="font-headline font-black text-white">{title}</h2><p className="text-xs text-on-surface-variant">{subtitle}</p></div></div>; }
function StateRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between rounded-xl bg-surface-high p-3"><span className="text-sm text-on-surface-variant">{label}</span><span className="text-xs font-black text-white">{value}</span></div>; }
function InsightPanel({ icon: Icon, title, empty, text, badge, date }: { icon: typeof BrainCircuit; title: string; empty: string; text?: string; badge: string; date?: string }) { return <section className="rounded-[24px] border border-outline/10 bg-surface p-5"><div className="flex items-center gap-3"><Icon className="text-primary" /><h2 className="font-headline font-black text-white">{title}</h2></div>{text ? <><div className="mt-4"><StatusBadge tone="warning">{badge}</StatusBadge></div><p className="mt-3 text-sm leading-6 text-on-surface-variant">{text}</p><p className="mt-3 text-xs text-outline">{formatDate(date)}</p></> : <p className="mt-4 text-sm text-on-surface-variant">{empty}</p>}</section>; }
function TradingUniversePanel({ universe, savingSymbol, onToggle }: { universe: TradingUniverse | null; savingSymbol: string; onToggle: (symbol: string, enabled: boolean) => Promise<void> }) {
  const enabled = universe?.assets.filter((asset) => asset.enabled).length ?? 0;
  return <section className="overflow-hidden rounded-[24px] border border-outline/10 bg-surface"><SectionHeader icon={Orbit} title="Trading Universe" subtitle={`${enabled}/${universe?.assets.length ?? 20} coin aktif · yeni işlemler için`} /><div className="max-h-[430px] overflow-y-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-surface-high text-outline"><tr><th className="p-3">Aktif</th><th className="p-3">Coin</th><th className="p-3 text-right">Rank</th><th className="p-3 text-right">24s hacim</th></tr></thead><tbody>{universe?.assets.map((asset) => <tr key={asset.symbol} className="border-t border-outline/10"><td className="p-3"><input aria-label={`${asset.symbol} işlemlerini etkinleştir`} type="checkbox" checked={asset.enabled} disabled={savingSymbol === asset.symbol} onChange={(event) => void onToggle(asset.symbol, event.target.checked)} className="h-4 w-4 accent-primary" /></td><td className="p-3"><span className="font-bold text-white">{asset.baseAsset}</span><span className="ml-2 text-outline">{asset.displayName}</span></td><td className="p-3 text-right text-on-surface-variant">{asset.marketRank ? `#${asset.marketRank}` : '—'}</td><td className="p-3 text-right text-on-surface-variant">{compactUsd(asset.volume24h)}</td></tr>) ?? <tr><td className="p-4 text-on-surface-variant" colSpan={4}>Universe yükleniyor…</td></tr>}</tbody></table></div><p className="border-t border-outline/10 p-3 text-[11px] text-outline">Pasif coinlerde yeni exposure engellenir; açık pozisyonların SL/TP lifecycle yönetimi sürer. Intelligence: {universe?.intelligence.providers.join(' + ') || 'Binance primary'}</p></section>;
}
function compactUsd(value: string | null) { const amount = Number(value); return Number.isFinite(amount) && amount > 0 ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(amount) : '—'; }
