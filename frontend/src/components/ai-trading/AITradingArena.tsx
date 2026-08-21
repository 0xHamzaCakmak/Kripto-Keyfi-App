import { Bot, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiErrorMessage } from '../../services/apiClient';
import { aiTradingApi, botSymbols, recordNumber, type AutonomousBot, type ChampionCandidate, type LeaderboardRow, type MarketRegime, type TradeSummary } from '../../services/aiTradingService';
import { AITradingPage, EmptyState, ErrorState, formatDate, formatMoney, formatPercent, MetricCard, ModeBadge, RefreshButton, StatusBadge } from './AITradingUI';

type ArenaRow = {
  bot: AutonomousBot; score: LeaderboardRow | null; summary: TradeSummary | null; champion: ChampionCandidate | null;
  pnl: number | null; roi: number | null; profitFactor: number | null; drawdown: number | null; trades: number; winRate: number | null; regimeCoverage: number | null;
};
type SortKey = 'score' | 'pnl' | 'profitFactor' | 'drawdown' | 'trades';

const regimes: Array<'ALL' | MarketRegime> = ['ALL', 'TRENDING_UP', 'TRENDING_DOWN', 'RANGING', 'BREAKOUT', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'CHAOTIC', 'UNKNOWN'];

export default function AITradingArena() {
  const [bots, setBots] = useState<AutonomousBot[]>([]); const [scores, setScores] = useState<LeaderboardRow[]>([]);
  const [summaries, setSummaries] = useState<TradeSummary[]>([]); const [champions, setChampions] = useState<ChampionCandidate[]>([]);
  const [regimeIds, setRegimeIds] = useState<Set<string> | null>(null); const [selected, setSelected] = useState<ArenaRow | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: 'ALL', strategy: 'ALL', generation: 'ALL', regime: 'ALL' as 'ALL' | MarketRegime, minScore: '', minPnl: '' });
  const [sort, setSort] = useState<SortKey>('score');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [botRows, scoreRows, summaryRows, championRows] = await Promise.all([aiTradingApi.bots(), aiTradingApi.leaderboard(100), aiTradingApi.tradeSummary('BOT', 100), aiTradingApi.champions()]);
      setBots(botRows); setScores(scoreRows); setSummaries(summaryRows); setChampions(championRows);
    } catch (reason) { setError(getApiErrorMessage(reason, 'Arena verileri alınamadı.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (filters.regime === 'ALL') { setRegimeIds(null); return; }
    let active = true;
    aiTradingApi.regimeLeaderboard(filters.regime, 100).then((rows) => { if (active) setRegimeIds(new Set(rows.map((row) => row.tradingBotId))); }).catch((reason) => { if (active) { setRegimeIds(new Set()); setError(getApiErrorMessage(reason, 'Rejim leaderboard verisi alınamadı.')); } });
    return () => { active = false; };
  }, [filters.regime]);

  const rows = useMemo(() => buildArenaRows(bots, scores, summaries, champions), [bots, scores, summaries, champions]);
  const strategies = useMemo(() => [...new Set(bots.map((bot) => bot.strategyVersion?.strategy.family).filter(Boolean))] as string[], [bots]);
  const generations = useMemo(() => [...new Set(bots.map((bot) => bot.generationId).filter((id): id is string => Boolean(id)))], [bots]);
  const statuses = useMemo(() => [...new Set(bots.map((bot) => bot.lifecycleStatus))], [bots]);
  const visibleRows = useMemo(() => rows.filter((row) => {
    const minimumScore = filters.minScore === '' ? null : Number(filters.minScore); const minimumPnl = filters.minPnl === '' ? null : Number(filters.minPnl);
    return (filters.status === 'ALL' || row.bot.lifecycleStatus === filters.status)
      && (filters.strategy === 'ALL' || row.bot.strategyVersion?.strategy.family === filters.strategy)
      && (filters.generation === 'ALL' || row.bot.generationId === filters.generation)
      && (regimeIds === null || regimeIds.has(row.bot.id))
      && (minimumScore === null || (row.score?.score ?? Number.NEGATIVE_INFINITY) >= minimumScore)
      && (minimumPnl === null || (row.pnl ?? Number.NEGATIVE_INFINITY) >= minimumPnl);
  }).sort((left, right) => compareRows(left, right, sort)), [rows, filters, regimeIds, sort]);

  return <AITradingPage title="Bot Arena" description="En fazla 100 autonomous PAPER/SHADOW botu gerçek backend kanıtlarıyla filtreleyin ve risk-adjusted performansa göre karşılaştırın." icon={Bot} action={<RefreshButton onClick={() => void load()} busy={loading} />}>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Population" value={`${bots.length} / 100`} detail="Autonomous bot" /><MetricCard label="Score üretilen" value={scores.length} /><MetricCard label="PAPER" value={bots.filter((bot) => bot.mode === 'PAPER').length} tone="warning" /><MetricCard label="SHADOW" value={bots.filter((bot) => bot.mode === 'SHADOW').length} /></div>
    {error && <ErrorState message={error} />}
    <section className="rounded-[24px] border border-outline/10 bg-surface p-5"><div className="flex items-center gap-2 text-sm font-black text-white"><SlidersHorizontal size={18} className="text-primary" /> Filtreler ve sıralama</div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      <Select label="Status" value={filters.status} onChange={(status) => setFilters((value) => ({ ...value, status }))} options={['ALL', ...statuses]} />
      <Select label="Strategy" value={filters.strategy} onChange={(strategy) => setFilters((value) => ({ ...value, strategy }))} options={['ALL', ...strategies]} />
      <Select label="Generation" value={filters.generation} onChange={(generation) => setFilters((value) => ({ ...value, generation }))} options={['ALL', ...generations]} />
      <Select label="Regime" value={filters.regime} onChange={(regime) => setFilters((value) => ({ ...value, regime: regime as 'ALL' | MarketRegime }))} options={regimes} />
      <NumberFilter label="Min score" value={filters.minScore} onChange={(minScore) => setFilters((value) => ({ ...value, minScore }))} />
      <NumberFilter label="Min PnL" value={filters.minPnl} onChange={(minPnl) => setFilters((value) => ({ ...value, minPnl }))} />
      <Select label="Sırala" value={sort} onChange={(value) => setSort(value as SortKey)} options={['score', 'pnl', 'profitFactor', 'drawdown', 'trades']} />
    </div></section>
    {loading ? <div className="h-72 animate-pulse rounded-[24px] bg-surface" /> : visibleRows.length === 0 ? <EmptyState title="Eşleşen bot yok" description="Backend henüz bot üretmemiş olabilir veya seçilen filtrelere uyan kanıt bulunmuyor." /> : <section className="overflow-hidden rounded-[24px] border border-outline/10 bg-surface"><div className="overflow-x-auto"><table className="w-full min-w-[1320px] text-left text-xs"><thead className="bg-surface-high uppercase text-outline"><tr>{['Bot', 'Score', 'PnL', 'ROI', 'PF', 'Max DD', 'Trades', 'Win rate', 'Strategy', 'Generation', 'Regime fit', 'Status', 'Equity', ''].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{visibleRows.map((row) => <tr key={row.bot.id} className="border-t border-outline/10 hover:bg-surface-high/40"><td className="p-3"><p className="font-bold text-white">{row.bot.name}</p><div className="mt-1"><ModeBadge mode={row.bot.mode} /></div></td><Cell value={number(row.score?.score)} strong /><Cell value={formatMoney(row.pnl)} tone={row.pnl} /><Cell value={formatPercent(row.roi)} tone={row.roi} /><Cell value={number(row.profitFactor)} /><Cell value={formatPercent(row.drawdown)} tone={row.drawdown === null ? null : -row.drawdown} /><Cell value={String(row.trades)} /><Cell value={formatPercent(row.winRate)} /><Cell value={row.bot.strategyVersion?.strategy.family ?? '—'} /><Cell value={row.bot.generationId ?? '—'} compact /><Cell value={row.regimeCoverage === null ? '—' : `${row.regimeCoverage} rejim`} /><td className="p-3"><StatusBadge tone={statusTone(row.bot.lifecycleStatus)}>{row.bot.lifecycleStatus}</StatusBadge></td><Cell value="Veri yok" compact /><td className="p-3"><button type="button" onClick={() => setSelected(row)} className="rounded-lg p-2 text-primary hover:bg-primary/10" aria-label={`${row.bot.name} detayını aç`}><ChevronRight size={18} /></button></td></tr>)}</tbody></table></div></section>}
    {selected && <BotDrawer row={selected} onClose={() => setSelected(null)} />}
  </AITradingPage>;
}

export function buildArenaRows(bots: AutonomousBot[], scores: LeaderboardRow[], summaries: TradeSummary[], champions: ChampionCandidate[]): ArenaRow[] {
  const scoreMap = new Map(scores.map((item) => [item.tradingBotId, item])); const summaryMap = new Map(summaries.map((item) => [item.groupKey, item]));
  const championMap = new Map<string, ChampionCandidate>();
  for (const item of champions) if (!championMap.has(item.tradingBotId)) championMap.set(item.tradingBotId, item);
  return bots.map((bot) => {
    const score = scoreMap.get(bot.id) ?? null; const summary = summaryMap.get(bot.id) ?? null; const champion = championMap.get(bot.id) ?? null;
    const pnl = summary ? Number(summary.totalPnl) : null; const start = Number(bot.startingPaperBalance); const completed = summary ? summary.wins + summary.losses : 0;
    return { bot, score, summary, champion, pnl, roi: pnl !== null && start > 0 ? pnl / start : null, profitFactor: summary?.profitFactor ?? null,
      drawdown: recordNumber(champion?.evidence, ['maxDrawdown']), trades: summary?.tradeCount ?? 0, winRate: completed > 0 && summary ? summary.wins / completed : null,
      regimeCoverage: recordNumber(champion?.evidence, ['regimeCoverage']) };
  });
}

function compareRows(left: ArenaRow, right: ArenaRow, key: SortKey) {
  const values: Record<SortKey, [number | null, number | null]> = { score: [left.score?.score ?? null, right.score?.score ?? null], pnl: [left.pnl, right.pnl], profitFactor: [left.profitFactor, right.profitFactor], drawdown: [left.drawdown, right.drawdown], trades: [left.trades, right.trades] };
  const [a, b] = values[key]; if (a === null && b === null) return left.bot.name.localeCompare(right.bot.name); if (a === null) return 1; if (b === null) return -1;
  return key === 'drawdown' ? a - b : b - a;
}
function statusTone(status: string): 'neutral' | 'safe' | 'warning' | 'danger' { return status === 'CHAMPION' ? 'safe' : status === 'LIVE_ELIGIBLE' ? 'danger' : ['REJECTED', 'ARCHIVED'].includes(status) ? 'danger' : ['CHALLENGER', 'CANDIDATE'].includes(status) ? 'warning' : 'neutral'; }
function number(value: number | null | undefined) { return value === null || value === undefined ? '—' : value.toLocaleString('tr-TR', { maximumFractionDigits: 2 }); }
function Cell({ value, strong = false, compact = false, tone = null }: { value: string; strong?: boolean; compact?: boolean; tone?: number | null }) { return <td className={`p-3 ${strong ? 'font-black text-primary' : tone === null ? 'text-on-surface-variant' : tone >= 0 ? 'font-bold text-secondary' : 'font-bold text-error'} ${compact ? 'max-w-32 truncate' : ''}`} title={compact ? value : undefined}>{value}</td>; }
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[] }) { return <label className="text-xs font-bold text-on-surface-variant">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-outline/15 bg-background/40 p-2.5 text-xs text-white">{options.map((option) => <option key={option}>{option}</option>)}</select></label>; }
function NumberFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-xs font-bold text-on-surface-variant">{label}<input type="number" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-outline/15 bg-background/40 p-2.5 text-xs text-white" placeholder="Tümü" /></label>; }
function BotDrawer({ row, onClose }: { row: ArenaRow; onClose: () => void }) { return <div className="fixed inset-0 z-50 flex justify-end bg-black/70" role="dialog" aria-modal="true" aria-label={`${row.bot.name} detayı`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="h-full w-full max-w-xl overflow-y-auto border-l border-outline/15 bg-background p-6 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><ModeBadge mode={row.bot.mode} /><h2 className="mt-4 font-headline text-2xl font-black text-white">{row.bot.name}</h2><p className="mt-1 text-sm text-on-surface-variant">{botSymbols(row.bot.symbols).join(', ') || 'Sembol yok'} · {row.bot.timeframe ?? 'Timeframe yok'}</p></div><button type="button" onClick={onClose} className="rounded-xl bg-surface-high p-2 text-white" aria-label="Detayı kapat"><X /></button></div><div className="mt-6 grid grid-cols-2 gap-3"><MetricCard label="Score" value={number(row.score?.score)} /><MetricCard label="Net PnL" value={formatMoney(row.pnl)} /><MetricCard label="ROI" value={formatPercent(row.roi)} /><MetricCard label="Profit factor" value={number(row.profitFactor)} /><MetricCard label="Max drawdown" value={formatPercent(row.drawdown)} /><MetricCard label="Trades" value={row.trades} /></div><div className="mt-5 space-y-3 rounded-[22px] border border-outline/10 bg-surface p-5"><Detail label="Lifecycle" value={row.bot.lifecycleStatus} /><Detail label="Runtime state" value={`${row.bot.state} → ${row.bot.desiredState}`} /><Detail label="Strategy" value={row.bot.strategyVersion ? `${row.bot.strategyVersion.strategy.name} v${row.bot.strategyVersion.version}` : '—'} /><Detail label="Strategy family" value={row.bot.strategyVersion?.strategy.family ?? '—'} /><Detail label="Generation" value={row.bot.generationId ?? '—'} /><Detail label="Creation" value={row.bot.factoryCreationMethod ?? '—'} /><Detail label="Snapshot" value={formatDate(row.score?.snapshotAt)} /></div><section className="mt-5 rounded-[22px] border border-outline/10 bg-surface p-5"><h3 className="font-headline font-black text-white">Equity sparkline</h3><p className="mt-2 text-sm text-on-surface-variant">Backend bu bot için equity zaman serisi sağlamıyor; grafik üretilmedi.</p></section></aside></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4 text-sm"><span className="text-on-surface-variant">{label}</span><span className="text-right font-bold text-white">{value}</span></div>; }
