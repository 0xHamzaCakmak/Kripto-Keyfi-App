import { Activity, Bot, BrainCircuit, ChartNoAxesCombined, FlaskConical, Orbit, ShieldCheck, Trophy } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiErrorMessage } from '../../services/apiClient';
import { aiTradingApi, recordNumber, type ArenaStatus, type AuditActivity, type AutonomousBot, type AutonomousHealth, type AutonomousLifecycle, type AutonomousOverview, type LeaderboardRow, type MarketContext, type ResearchHypothesis, type TeacherEvaluation, type TradeSummary } from '../../services/aiTradingService';
import { AITradingPage, EmptyState, ErrorState, formatDate, formatMoney, MetricCard, ModeBadge, RefreshButton, StatusBadge } from './AITradingUI';

type OverviewState = {
  overview: AutonomousOverview | null; arena: ArenaStatus | null; health: AutonomousHealth | null;
  bots: AutonomousBot[]; leaderboard: LeaderboardRow[]; summaries: TradeSummary[]; market: MarketContext | null;
  teachers: TeacherEvaluation[]; research: ResearchHypothesis[]; activity: AuditActivity[]; warnings: string[];
};

const emptyState: OverviewState = { overview: null, arena: null, health: null, bots: [], leaderboard: [], summaries: [], market: null, teachers: [], research: [], activity: [], warnings: [] };

export default function AITradingOverview() {
  const [data, setData] = useState<OverviewState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    const requests = await Promise.allSettled([
      aiTradingApi.overview(), aiTradingApi.arenaStatus(), aiTradingApi.health(), aiTradingApi.bots(),
      aiTradingApi.leaderboard(10), aiTradingApi.tradeSummary('BOT', 100), aiTradingApi.marketContext(),
      aiTradingApi.teacherEvaluations(5), aiTradingApi.researchHypotheses(5), aiTradingApi.audit(12),
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
      market: value(6, null), teachers: value(7, []), research: value(8, []), activity: value(9, []), warnings,
    });
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const totals = useMemo(() => aggregateOverview(data.bots, data.summaries, data.leaderboard), [data.bots, data.summaries, data.leaderboard]);
  const counts = useMemo(() => lifecycleCounts(data.bots), [data.bots]);

  return <AITradingPage title="AI Trading Operasyon Merkezi" description="Autonomous PAPER ve SHADOW sistemini, risk durumunu ve öğrenme döngüsünü tek güvenli görünümde izleyin." icon={Bot} action={<RefreshButton onClick={() => void load()} busy={loading} />}>
    <div className="flex flex-wrap gap-2"><ModeBadge mode="PAPER" /><ModeBadge mode="SHADOW" /><StatusBadge tone="danger">LIVE KAPALI</StatusBadge><StatusBadge tone={data.overview?.globalKillSwitch ? 'danger' : 'safe'}>Risk Engine · {data.overview?.globalKillSwitch ? 'Emergency stop' : 'Aktif'}</StatusBadge></div>
    {error && <ErrorState message={error} />}
    {data.warnings.length > 0 && <div className="rounded-2xl border border-tertiary/20 bg-tertiary/5 p-4 text-sm text-tertiary">Kısmi veri: {data.warnings.join(' ')}</div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Sistem" value={data.health?.status ?? (loading ? 'Yükleniyor' : '—')} detail={`Son kontrol ${formatDate(data.health?.checkedAt)}`} tone={data.health?.status === 'HEALTHY' ? 'safe' : data.health?.status === 'EMERGENCY_STOPPED' ? 'danger' : 'warning'} />
      <MetricCard label="Aktif bot" value={data.health?.metrics.activeBots ?? data.arena?.states.RUNNING ?? 0} detail={`${data.overview?.bots ?? 0} autonomous bot`} />
      <MetricCard label="Arena" value={`${(data.arena?.throughputPerMinute ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}/dk`} detail={`${data.arena?.decisionsLast5m ?? 0} karar · son 5 dk`} />
      <MetricCard label="Piyasa rejimi" value={data.market?.market.trend ?? 'UNKNOWN'} detail={`${data.market?.symbol ?? 'BTCUSDT'} · ${data.market?.market.volatility ?? 'Volatilite bilinmiyor'}`} tone={marketFresh(data.market) ? 'safe' : 'warning'} />
      <MetricCard label="Aggregate PAPER equity" value={formatMoney(totals.equity)} detail="Başlangıç bakiyesi + kapanmış net PnL" />
      <MetricCard label="Net PnL" value={formatMoney(totals.pnl)} detail={`${totals.tradeCount} kapanmış PAPER trade`} tone={totals.pnl === null ? 'neutral' : totals.pnl >= 0 ? 'safe' : 'danger'} />
      <MetricCard label="Max drawdown" value={totals.maxDrawdown === null ? '—' : `${totals.maxDrawdown.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}%`} detail="Leaderboard score evidence" tone={totals.maxDrawdown && totals.maxDrawdown > 15 ? 'danger' : 'neutral'} />
      <MetricCard label="Risk durumu" value={data.health?.metrics.emergencyStop ? 'DURDURULDU' : 'FAIL-CLOSED'} detail={`${data.health?.metrics.riskRejectsLast24h ?? 0} reject · son 24 saat`} tone={data.health?.metrics.emergencyStop ? 'danger' : 'safe'} />
    </div>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <LifecycleCard icon={Bot} label="Candidate" value={counts.CANDIDATE + counts.DRAFT} />
      <LifecycleCard icon={Orbit} label="Challenger" value={counts.CHALLENGER} />
      <LifecycleCard icon={Trophy} label="Champion" value={data.overview?.champions ?? counts.CHAMPION} />
      <LifecycleCard icon={ShieldCheck} label="Live Eligible" value={data.overview?.liveEligible ?? counts.LIVE_ELIGIBLE} warning />
    </section>
    <div className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
      <section className="overflow-hidden rounded-[24px] border border-outline/10 bg-surface"><SectionHeader icon={ChartNoAxesCombined} title="Top botlar" subtitle="Risk-adjusted Bot Score sırası" />{data.leaderboard.length === 0 ? <div className="p-5"><EmptyState title="Leaderboard boş" description="Backend henüz score snapshot üretmedi." /></div> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-surface-high text-xs uppercase text-outline"><tr><th className="p-4">#</th><th className="p-4">Bot</th><th className="p-4">Score</th><th className="p-4">PnL</th><th className="p-4">Snapshot</th></tr></thead><tbody>{data.leaderboard.slice(0, 8).map((row) => <tr className="border-t border-outline/10" key={row.tradingBotId}><td className="p-4 font-black text-primary">{row.rank}</td><td className="p-4 font-bold text-white">{row.botName}</td><td className="p-4">{row.score.toFixed(2)}</td><td className="p-4">{formatMoney(recordNumber(row.breakdown, ['netPnl', 'totalPnl', 'pnl']))}</td><td className="p-4 text-xs text-outline">{formatDate(row.snapshotAt)}</td></tr>)}</tbody></table></div>}</section>
      <section className="rounded-[24px] border border-outline/10 bg-surface"><SectionHeader icon={Activity} title="Arena durumu" subtitle="Simulation-only runtime" /><div className="space-y-3 p-5"><StateRow label="Execution" value={data.arena?.executionMode ?? '—'} /><StateRow label="Son karar" value={formatDate(data.arena?.latestDecisionAt)} /><StateRow label="PAPER bot" value={String(data.arena?.modes.PAPER ?? 0)} /><StateRow label="SHADOW bot" value={String(data.arena?.modes.SHADOW ?? 0)} /></div></section>
    </div>
    <div className="grid gap-5 xl:grid-cols-2">
      <InsightPanel icon={BrainCircuit} title="Son Teacher insight" empty="Henüz Teacher evaluation yok." text={data.teachers[0]?.observation} badge="ÖNERİ · UYGULANMADI" date={data.teachers[0]?.createdAt} />
      <InsightPanel icon={FlaskConical} title="Son Researcher hypothesis" empty="Henüz Researcher hypothesis yok." text={data.research[0]?.hypothesis} badge="HİPOTEZ · CANDIDATE ONLY" date={data.research[0]?.createdAt} />
    </div>
    <section className="rounded-[24px] border border-outline/10 bg-surface"><SectionHeader icon={Activity} title="Son aktiviteler" subtitle="Autonomous audit ledger" /><div className="space-y-2 p-5">{data.activity.length === 0 ? <EmptyState title="Aktivite yok" description="AI audit ledger henüz kayıt içermiyor." /> : data.activity.map((item) => <div key={item.id} className="flex flex-col justify-between gap-2 rounded-xl bg-surface-high p-3 sm:flex-row sm:items-center"><div><p className="text-sm font-bold text-white">{humanize(item.action)}</p><p className="mt-1 text-xs text-on-surface-variant">{item.entityType}{item.entityId ? ` · ${item.entityId}` : ''}</p></div><span className="text-xs text-outline">{formatDate(item.createdAt)}</span></div>)}</div></section>
  </AITradingPage>;
}

const sectionNames = ['Overview', 'Arena', 'System health', 'Bot', 'Leaderboard', 'Performance', 'Market context', 'Teacher', 'Researcher', 'Audit'];

export function aggregateOverview(bots: AutonomousBot[], summaries: TradeSummary[], leaderboard: LeaderboardRow[]) {
  const pnl = summaries.length ? summaries.reduce((sum, row) => sum + Number(row.totalPnl || 0), 0) : null;
  const startingBalance = bots.filter((bot) => bot.mode === 'PAPER').reduce((sum, bot) => sum + Number(bot.startingPaperBalance || 0), 0);
  const drawdowns = leaderboard.map((row) => recordNumber(row.breakdown, ['maxDrawdownPct', 'maxDrawdown', 'drawdown'])).filter((value): value is number => value !== null);
  return { pnl, equity: bots.length || pnl !== null ? startingBalance + (pnl ?? 0) : null, maxDrawdown: drawdowns.length ? Math.max(...drawdowns) : null, tradeCount: summaries.reduce((sum, row) => sum + row.tradeCount, 0) };
}

function lifecycleCounts(bots: AutonomousBot[]) {
  return bots.reduce<Record<AutonomousLifecycle, number>>((result, bot) => { result[bot.lifecycleStatus] += 1; return result; }, { DRAFT: 0, CANDIDATE: 0, PAPER: 0, TESTING: 0, CHALLENGER: 0, CHAMPION: 0, LIVE_ELIGIBLE: 0, PAUSED: 0, REJECTED: 0, ARCHIVED: 0 });
}

function marketFresh(market: MarketContext | null) { return market !== null && Object.values(market.sources).some((source) => source.status === 'FRESH') && !Object.values(market.sources).some((source) => source.status === 'STALE'); }
function humanize(value: string) { return value.replace(/^AI_/, '').replaceAll('_', ' '); }
function LifecycleCard({ icon: Icon, label, value, warning = false }: { icon: typeof Bot; label: string; value: number; warning?: boolean }) { return <div className="flex items-center gap-4 rounded-[22px] border border-outline/10 bg-surface p-5"><div className={`rounded-xl p-2.5 ${warning ? 'bg-tertiary/10 text-tertiary' : 'bg-primary/10 text-primary'}`}><Icon size={19} /></div><div><p className="font-headline text-2xl font-black text-white">{value}</p><p className="text-xs text-on-surface-variant">{label}</p></div></div>; }
function SectionHeader({ icon: Icon, title, subtitle }: { icon: typeof Activity; title: string; subtitle: string }) { return <div className="flex items-center gap-3 border-b border-outline/10 p-5"><Icon className="text-primary" size={19} /><div><h2 className="font-headline font-black text-white">{title}</h2><p className="text-xs text-on-surface-variant">{subtitle}</p></div></div>; }
function StateRow({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between rounded-xl bg-surface-high p-3"><span className="text-sm text-on-surface-variant">{label}</span><span className="text-xs font-black text-white">{value}</span></div>; }
function InsightPanel({ icon: Icon, title, empty, text, badge, date }: { icon: typeof BrainCircuit; title: string; empty: string; text?: string; badge: string; date?: string }) { return <section className="rounded-[24px] border border-outline/10 bg-surface p-5"><div className="flex items-center gap-3"><Icon className="text-primary" /><h2 className="font-headline font-black text-white">{title}</h2></div>{text ? <><div className="mt-4"><StatusBadge tone="warning">{badge}</StatusBadge></div><p className="mt-3 text-sm leading-6 text-on-surface-variant">{text}</p><p className="mt-3 text-xs text-outline">{formatDate(date)}</p></> : <p className="mt-4 text-sm text-on-surface-variant">{empty}</p>}</section>; }
