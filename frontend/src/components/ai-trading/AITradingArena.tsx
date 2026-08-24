import { Bot, ChevronRight, SlidersHorizontal, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiErrorMessage } from '../../services/apiClient';
import { aiTradingApi, botSymbols, recordNumber, type AutonomousBot, type ChampionCandidate, type LeaderboardRow, type MarketRegime, type PaperPerformance, type TestnetBotOperation, type TradeSummary } from '../../services/aiTradingService';
import { AITradingPage, EmptyState, ErrorState, formatDate, formatMoney, formatPercent, MetricCard, ModeBadge, RefreshButton, StatusBadge } from './AITradingUI';

type ArenaRow = {
  bot: AutonomousBot; score: LeaderboardRow | null; summary: TradeSummary | null; champion: ChampionCandidate | null;
  operation: TestnetBotOperation | null; pnl: number | null; roi: number | null; profitFactor: number | null; drawdown: number | null; trades: number; winRate: number | null; regimeCoverage: number | null;
};
type SortKey = 'score' | 'pnl' | 'profitFactor' | 'drawdown' | 'trades';

const regimes: Array<'ALL' | MarketRegime> = ['ALL', 'TRENDING_UP', 'TRENDING_DOWN', 'RANGING', 'BREAKOUT', 'HIGH_VOLATILITY', 'LOW_VOLATILITY', 'CHAOTIC', 'UNKNOWN'];

export default function AITradingArena() {
  const [bots, setBots] = useState<AutonomousBot[]>([]); const [scores, setScores] = useState<LeaderboardRow[]>([]);
  const [summaries, setSummaries] = useState<TradeSummary[]>([]); const [champions, setChampions] = useState<ChampionCandidate[]>([]);
  const [operations, setOperations] = useState<TestnetBotOperation[]>([]);
  const [regimeIds, setRegimeIds] = useState<Set<string> | null>(null); const [selected, setSelected] = useState<ArenaRow | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: 'ALL', strategy: 'ALL', generation: 'ALL', regime: 'ALL' as 'ALL' | MarketRegime, minScore: '', minPnl: '' });
  const [sort, setSort] = useState<SortKey>('pnl');

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true); setError('');
    try {
      const scoreRequest = aiTradingApi.leaderboard(100)
        .catch((reason) => { setError(getApiErrorMessage(reason, 'Skor verileri geçici olarak alınamadı; botlar skor olmadan gösteriliyor.')); return null; });
      const operationRequest = aiTradingApi.testnetOperations()
        .catch((reason) => { setError(getApiErrorMessage(reason, 'TESTNET operasyon verileri geçici olarak alınamadı; PAPER ve skor verileri gösteriliyor.')); return null; });
      const [botRows, summaryRows, championRows] = await Promise.all([aiTradingApi.bots(), aiTradingApi.tradeSummary('BOT', 100), aiTradingApi.champions()]);
      setBots(botRows); setSummaries(summaryRows); setChampions(championRows);
      void scoreRequest.then((scoreRows) => { if (scoreRows) setScores(scoreRows); });
      void operationRequest.then((operationRows) => { if (operationRows) setOperations(operationRows.data); });
    } catch (reason) { setError(getApiErrorMessage(reason, 'Arena verileri alınamadı.')); }
    finally { if (showSpinner) setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    const refresh = window.setInterval(() => { void load(false); }, 30_000);
    return () => window.clearInterval(refresh);
  }, [load]);
  useEffect(() => {
    if (filters.regime === 'ALL') { setRegimeIds(null); return; }
    let active = true;
    aiTradingApi.regimeLeaderboard(filters.regime, 100).then((rows) => { if (active) setRegimeIds(new Set(rows.map((row) => row.tradingBotId))); }).catch((reason) => { if (active) { setRegimeIds(new Set()); setError(getApiErrorMessage(reason, 'Rejim leaderboard verisi alınamadı.')); } });
    return () => { active = false; };
  }, [filters.regime]);

  const rows = useMemo(() => buildArenaRows(bots, scores, summaries, champions, operations), [bots, scores, summaries, champions, operations]);
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

  return <AITradingPage title="Bot Arena" description="Tüm autonomous PAPER ve Binance TESTNET botlarını gerçek backend kanıtlarıyla izleyin; bot satırına tıklayarak işlem geçmişini ve sermaye kotasını yönetin." icon={Bot} action={<RefreshButton onClick={() => void load()} busy={loading} />}>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MetricCard label="Toplam bot" value={bots.length} detail="PAPER + TESTNET" /><MetricCard label="Score üretilen" value={scores.length} /><MetricCard label="PAPER" value={bots.filter((bot) => bot.mode === 'PAPER').length} tone="warning" /><MetricCard label="TESTNET" value={operations.length} tone="safe" /><MetricCard label="Açık TESTNET pozisyon" value={operations.filter((item) => item.position).length} tone="safe" /></div>
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
    {loading ? <div className="h-72 animate-pulse rounded-[24px] bg-surface" /> : visibleRows.length === 0 ? <EmptyState title="Eşleşen bot yok" description="Backend henüz bot üretmemiş olabilir veya seçilen filtrelere uyan kanıt bulunmuyor." /> : <section className="overflow-hidden rounded-[24px] border border-outline/10 bg-surface"><div className="overflow-x-auto"><table className="w-full min-w-[1760px] text-left text-xs"><thead className="bg-surface-high uppercase text-outline"><tr>{['Bot', 'Pozisyon ve işlem özeti', 'Score', 'Toplam PnL', 'Açık PnL', 'ROI', 'PF', 'Max DD', 'Win rate', 'Strategy', 'Status', 'Equity', ''].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{visibleRows.map((row, index) => {
      const snapshot = positionSnapshot(row);
      const openPnl = snapshot.openPnl;
      const equity = row.pnl === null ? null : Number(row.bot.startingPaperBalance) + row.pnl;
      return <tr key={row.bot.id} className="cursor-pointer border-t border-outline/10 hover:bg-surface-high/40" onClick={() => setSelected(row)}>
        <td className="p-3"><div className="flex items-start gap-2"><span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/15 text-[10px] font-black text-primary">{index + 1}</span><div><p className="font-bold text-white">{row.bot.name}</p><div className="mt-1"><ModeBadge mode={row.bot.mode} /></div></div></div></td>
        <PositionSummaryCell snapshot={snapshot} trades={row.trades} />
        <Cell value={number(row.score?.score)} strong /><Cell value={formatMoney(row.pnl)} tone={row.pnl} /><Cell value={formatMoney(openPnl)} tone={openPnl} /><Cell value={formatPercent(row.roi)} tone={row.roi} /><Cell value={number(row.profitFactor)} /><Cell value={formatPercent(row.drawdown)} tone={row.drawdown === null ? null : -row.drawdown} /><Cell value={formatPercent(row.winRate)} /><Cell value={row.bot.strategyVersion?.strategy.family ?? '—'} /><td className="p-3"><StatusBadge tone={statusTone(row.bot.lifecycleStatus)}>{row.bot.lifecycleStatus}</StatusBadge></td><Cell value={formatMoney(equity)} tone={row.pnl} /><td className="p-3"><button type="button" onClick={(event) => { event.stopPropagation(); setSelected(row); }} className="rounded-lg p-2 text-primary hover:bg-primary/10" aria-label={`${row.bot.name} detayını aç`}><ChevronRight size={18} /></button></td>
      </tr>;
    })}</tbody></table></div></section>}
    {selected && <BotDrawer row={selected} onClose={() => setSelected(null)} onActivated={load} />}
  </AITradingPage>;
}

export function buildArenaRows(bots: AutonomousBot[], scores: LeaderboardRow[], summaries: TradeSummary[], champions: ChampionCandidate[], operations: TestnetBotOperation[] = []): ArenaRow[] {
  const scoreMap = new Map(scores.map((item) => [item.tradingBotId, item])); const summaryMap = new Map(summaries.map((item) => [item.groupKey, item]));
  const championMap = new Map<string, ChampionCandidate>();
  for (const item of champions) if (!championMap.has(item.tradingBotId)) championMap.set(item.tradingBotId, item);
  const operationMap = new Map(operations.map((item) => [item.botId, item])); return bots.map((bot) => {
    const score = scoreMap.get(bot.id) ?? null; const summary = summaryMap.get(bot.id) ?? null; const champion = championMap.get(bot.id) ?? null;
    const operation = operationMap.get(bot.id) ?? null; const openPnl = operation?.position ? Number(operation.position.unrealizedPnl) : 0;
    const paperPnl = bot.paperPosition ? paperPositionNetPnl(bot.paperPosition) : summary ? Number(summary.totalPnl) : null;
    const pnl = operation ? Number(operation.netRealizedPnl) + openPnl : paperPnl; const start = operation?.allocationUsdt ?? Number(bot.startingPaperBalance); const completed = operation ? operation.wins + operation.losses : summary ? summary.wins + summary.losses : 0;
    return { bot, score, summary, champion, operation, pnl, roi: pnl !== null && start > 0 ? pnl / start : null, profitFactor: operation ? null : summary?.profitFactor ?? null,
      drawdown: recordNumber(champion?.evidence, ['maxDrawdown']), trades: operation?.entryFills ?? bot._count.paperTrades, winRate: completed > 0 ? (operation ? operation.wins : summary!.wins) / completed : null,
      regimeCoverage: recordNumber(champion?.evidence, ['regimeCoverage']) };
  });
}

function paperPositionNetPnl(position: NonNullable<AutonomousBot['paperPosition']>) {
  return Number(position.realizedPnl) - Number(position.totalFees) + Number(position.unrealizedPnl);
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
type PositionSnapshot = { symbol: string; entryPrice: number | null; side: 'LONG' | 'SHORT' | null; leverage: number | null; openPnl: number | null; active: boolean };
function positionSnapshot(row: ArenaRow): PositionSnapshot {
  const testnetPosition = row.operation?.position;
  if (testnetPosition) return {
    symbol: testnetPosition.symbol,
    entryPrice: finiteNumber(testnetPosition.entryPrice),
    side: testnetPosition.side,
    leverage: finiteNumber(testnetPosition.leverage),
    openPnl: finiteNumber(testnetPosition.unrealizedPnl),
    active: true,
  };
  const paperPosition = row.bot.paperPosition;
  const paperQuantity = finiteNumber(paperPosition?.netQuantity) ?? 0;
  if (paperPosition && paperQuantity !== 0) return {
    symbol: paperPosition.symbol,
    entryPrice: finiteNumber(paperPosition.avgEntryPrice),
    side: paperQuantity > 0 ? 'LONG' : 'SHORT',
    leverage: recordNumber(row.bot.configuration, ['leverage']),
    openPnl: finiteNumber(paperPosition.unrealizedPnl),
    active: true,
  };
  return {
    // A flat PAPER ledger keeps its last traded symbol for accounting. Arena
    // must show the bot's current Universe assignment instead of that stale
    // historical symbol; active positions above still use their ledger symbol.
    symbol: row.operation?.symbol ?? botSymbols(row.bot.symbols)[0] ?? paperPosition?.symbol ?? '—',
    entryPrice: null,
    side: null,
    leverage: null,
    openPnl: null,
    active: false,
  };
}
function finiteNumber(value: string | number | null | undefined) { const parsed = Number(value); return value === null || value === undefined || !Number.isFinite(parsed) ? null : parsed; }
function formatEntryPrice(value: number | null) {
  if (value === null) return '—';
  const maximumFractionDigits = value < 1 ? 8 : value < 100 ? 6 : 2;
  return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits })} USDT`;
}
function PositionSummaryCell({ snapshot, trades }: { snapshot: PositionSnapshot; trades: number }) {
  const directionTone = snapshot.side === 'LONG' ? 'text-secondary' : snapshot.side === 'SHORT' ? 'text-error' : 'text-outline';
  const pnlTone = snapshot.openPnl === null ? 'text-outline' : snapshot.openPnl >= 0 ? 'text-secondary' : 'text-error';
  return <td className="min-w-[540px] p-3"><div className="grid grid-cols-[minmax(80px,1fr)_minmax(120px,1.5fr)_minmax(100px,1fr)_minmax(110px,1fr)_minmax(70px,.7fr)] items-center gap-3 rounded-xl border border-outline/10 bg-background/35 px-3 py-2">
    <PositionDatum label="Coin" value={snapshot.symbol} valueClass="text-primary" />
    <PositionDatum label="Giriş fiyatı" value={formatEntryPrice(snapshot.entryPrice)} />
    <PositionDatum label="Yön / kaldıraç" value={snapshot.side ? `${snapshot.side} · ${snapshot.leverage === null ? '—' : `${number(snapshot.leverage)}x`}` : '—'} valueClass={directionTone} />
    <PositionDatum label="Anlık PnL" value={snapshot.active ? formatMoney(snapshot.openPnl) : '—'} valueClass={pnlTone} />
    <PositionDatum label="İşlem" value={trades.toLocaleString('tr-TR')} />
  </div></td>;
}
function PositionDatum({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) { return <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wide text-outline">{label}</p><p className={`mt-0.5 truncate font-black ${valueClass}`} title={value}>{value}</p></div>; }
function BotDrawer({ row, onClose, onActivated }: { row: ArenaRow; onClose: () => void; onActivated: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [actionError, setActionError] = useState('');
  const [operation, setOperation] = useState<TestnetBotOperation | null>(row.operation);
  const [paperPerformance, setPaperPerformance] = useState<PaperPerformance | null>(row.bot.paperPosition ? { position: row.bot.paperPosition, fills: [] } : null);
  const [detailLoading, setDetailLoading] = useState(row.bot.mode === 'DEMO' || row.bot.mode === 'PAPER');
  const initialAllocation = row.operation?.allocationUsdt ?? recordNumber(row.bot.configuration, ['allocationUsdt']) ?? Number(row.bot.startingPaperBalance);
  const [capitalAmount, setCapitalAmount] = useState(String(initialAllocation));
	const maximumCapital = 10_000;
  useEffect(() => {
    let active = true; setDetailLoading(true);
    const request = row.bot.mode === 'DEMO'
      ? aiTradingApi.testnetBotOperation(row.bot.id).then((value) => { if (active) setOperation(value.data); })
      : row.bot.mode === 'PAPER'
        ? aiTradingApi.paperPerformance(row.bot.id).then((value) => { if (active) setPaperPerformance(value); })
        : Promise.resolve();
    request.catch((reason) => { if (active) setActionError(getApiErrorMessage(reason, 'Bot işlem geçmişi alınamadı.')); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [row.bot.id, row.bot.mode]);
  async function activate() {
    const confirmation = window.prompt('Binance TESTNET canary için tam olarak ENABLE BINANCE TESTNET yazın.'); if (confirmation !== 'ENABLE BINANCE TESTNET') return;
    const note = window.prompt('Audit notu:', 'Admin approved Binance TESTNET canary.'); if (!note || note.trim().length < 3) return;
    setBusy(true); setActionError(''); try { await aiTradingApi.activateTestnet(row.bot.id, note.trim()); await onActivated(); onClose(); }
    catch (reason) { setActionError(getApiErrorMessage(reason, 'TESTNET canary etkinleştirilemedi.')); } finally { setBusy(false); }
  }
  async function changeCapital(action: 'SET' | 'ADD') {
    const amount = Number(capitalAmount);
    const target = action === 'ADD' ? initialAllocation + amount : amount;
    if (!Number.isFinite(amount) || amount <= 0) { setActionError('Geçerli bir USDT tutarı girin.'); return; }
    if (target > maximumCapital) { setActionError(`Bot kotası en fazla ${maximumCapital.toLocaleString('tr-TR')} USDT olabilir.`); return; }
    setBusy(true); setActionError('');
    try {
      await aiTradingApi.changeBotCapital(row.bot.id, action, amount, action === 'ADD' ? 'Admin bot sermayesi ekledi.' : 'Admin bot sermaye kotasını ayarladı.');
      await onActivated(); onClose();
    } catch (reason) { setActionError(getApiErrorMessage(reason, 'Bot sermayesi güncellenemedi.')); }
    finally { setBusy(false); }
  }
  const paperPosition = paperPerformance?.position ?? row.bot.paperPosition;
  const openPnl = operation?.position ? Number(operation.position.unrealizedPnl) : paperPosition ? Number(paperPosition.unrealizedPnl) : null;
  const realizedNet = operation ? Number(operation.netRealizedPnl) : paperPerformance?.closedSummary
    ? Number(paperPerformance.closedSummary.netPnl)
    : paperPosition ? Number(paperPosition.realizedPnl) - Number(paperPosition.totalFees) : null;
  const totalNet = operation ? Number(operation.netRealizedPnl) + (openPnl ?? 0) : paperPosition ? paperPositionNetPnl(paperPosition) : row.pnl;
  const roi = totalNet !== null && initialAllocation > 0 ? totalNet / initialAllocation : row.roi;
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/70" role="dialog" aria-modal="true" aria-label={`${row.bot.name} detayı`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="h-full w-full max-w-4xl overflow-y-auto border-l border-outline/15 bg-background p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-3"><div><ModeBadge mode={row.bot.mode} /><h2 className="mt-4 font-headline text-2xl font-black text-white">{row.bot.name}</h2><p className="mt-1 text-sm text-on-surface-variant">{operation?.symbol ?? (botSymbols(row.bot.symbols).join(', ') || 'Sembol yok')} · {row.bot.timeframe ?? 'Timeframe yok'}</p></div><button type="button" onClick={onClose} className="rounded-xl bg-surface-high p-2 text-white" aria-label="Detayı kapat"><X /></button></div>
      {row.bot.mode === 'PAPER' && row.bot.lifecycleStatus === 'PAPER' && <div className="mt-5 rounded-2xl border border-error/30 bg-error/5 p-4"><p className="text-sm text-on-surface-variant">Yalnız bağlı Binance TESTNET hesabında, 5x–20x isolated ve merkezi Risk Engine korumalı yürütme.</p><button type="button" disabled={busy} onClick={() => void activate()} className="mt-3 rounded-xl bg-error px-4 py-2 text-sm font-black text-white disabled:opacity-50">{busy ? 'Etkinleştiriliyor…' : 'Binance TESTNET canary etkinleştir'}</button></div>}
      {actionError && <ErrorState message={actionError} />}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4"><MetricCard label="Toplam net PnL" value={formatMoney(totalNet)} /><MetricCard label="Gerçekleşmiş net" value={formatMoney(realizedNet)} /><MetricCard label="Açık PnL" value={formatMoney(openPnl)} /><MetricCard label="ROI" value={formatPercent(operation?.position?.roi ?? roi)} /><MetricCard label="Giriş fill" value={operation?.entryFills ?? (paperPerformance?.fills.filter((fill) => Number(fill.realizedPnl) === 0).length ?? '—')} /><MetricCard label="Toplam fill" value={operation?.totalFills ?? row.bot._count.paperFills} /><MetricCard label="Kapanış" value={operation?.closedFills ?? row.summary?.tradeCount ?? 0} /><MetricCard label="Komisyon" value={operation ? formatMoney(Number(operation.commission)) : paperPosition ? formatMoney(Number(paperPosition.totalFees)) : '—'} /></div>
      <section className="mt-5 rounded-[22px] border border-primary/20 bg-primary/5 p-5"><h3 className="font-headline font-black text-white">Bot sermayesi ve işlem kotası</h3><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]"><label className="text-xs font-bold text-on-surface-variant">USDT<input type="number" min="1" max={maximumCapital} step="1" value={capitalAmount} onChange={(event) => setCapitalAmount(event.target.value)} className="mt-1.5 w-full rounded-xl border border-outline/15 bg-background/70 p-3 text-white" /></label><button type="button" disabled={busy} onClick={() => void changeCapital('SET')} className="self-end rounded-xl border border-primary/30 px-4 py-3 text-sm font-black text-primary disabled:opacity-50">Kotayı ayarla</button><button type="button" disabled={busy} onClick={() => void changeCapital('ADD')} className="self-end rounded-xl bg-primary px-4 py-3 text-sm font-black text-background disabled:opacity-50">Bakiye ekle</button></div><p className="mt-3 text-xs leading-5 text-outline">Mevcut kota {formatMoney(operation?.allocationUsdt ?? initialAllocation)}; bot başına sınır {formatMoney(maximumCapital)}. “Kotayı ayarla” yazdığınız tutarı toplam kota yapar; “Bakiye ekle” yazdığınız tutarı mevcut kotanın üzerine ekler. PAPER için simülasyon sermayesidir. TESTNET için Binance Demo ortak cüzdan bakiyesini değiştirmez; yalnız bu botun kullanabileceği uygulama kotasını artırır.</p></section>
      {operation && <section className="mt-5 rounded-[22px] border border-outline/10 bg-surface p-5"><h3 className="font-headline font-black text-white">Aktif Binance TESTNET pozisyonu</h3>{operation.position ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Yön" value={`${operation.position.side} · ${operation.position.leverage}x`} /><Detail label="Miktar" value={operation.position.quantity} /><Detail label="Giriş" value={operation.position.entryPrice} /><Detail label="Mark" value={operation.position.markPrice} /><Detail label="Kullanılan kota" value={`${formatMoney(Number(operation.position.notional))} / ${formatMoney(operation.allocationUsdt)}`} /><Detail label="Kota kullanımı" value={formatPercent(Math.min(Number(operation.position.notional) / operation.allocationUsdt, 1))} /><Detail label="Margin" value={formatMoney(Number(operation.position.margin))} /><Detail label="Stop-loss trigger" value={operation.stopLoss ?? 'Onarılıyor'} /><Detail label="Take-profit trigger" value={operation.takeProfit ?? 'Onarılıyor'} /></div> : <p className="mt-3 text-sm text-on-surface-variant">Açık pozisyon yok; bot uygun grafik sinyali arıyor.</p>}<p className="mt-4 text-xs leading-5 text-outline">Aynı yönde yeni grafik sinyali oluşursa bot, {formatMoney(operation.allocationUsdt)} toplam notional kotasına kadar MARKET ek giriş yapabilir. Her ek girişten sonra SL/TP toplam pozisyon miktarına göre yeniden kurulur. Ters sinyal pozisyonu büyütmez.</p></section>}
      {row.bot.mode === 'PAPER' && <section className="mt-5 rounded-[22px] border border-tertiary/20 bg-tertiary/5 p-5"><h3 className="font-headline font-black text-white">Aktif PAPER pozisyonu</h3>{paperPosition && Number(paperPosition.netQuantity) !== 0 ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Yön" value={Number(paperPosition.netQuantity) > 0 ? 'LONG' : 'SHORT'} /><Detail label="Miktar" value={paperPosition.netQuantity} /><Detail label="Ort. giriş" value={paperPosition.avgEntryPrice} /><Detail label="Son mark" value={paperPosition.lastMarkPrice} /><Detail label="Gerçekleşmemiş PnL" value={formatMoney(Number(paperPosition.unrealizedPnl))} /><Detail label="Toplam ücret" value={formatMoney(Number(paperPosition.totalFees))} /><Detail label="Son fill" value={formatDate(paperPosition.lastFilledAt ?? undefined)} /><Detail label="Ledger güncelleme" value={formatDate(paperPosition.updatedAt)} /></div> : <p className="mt-3 text-sm text-on-surface-variant">Açık PAPER pozisyonu yok; bot uygun sinyal arıyor.</p>}</section>}
      <div className="mt-5 space-y-3 rounded-[22px] border border-outline/10 bg-surface p-5"><Detail label="Lifecycle" value={row.bot.lifecycleStatus} /><Detail label="Runtime state" value={`${row.bot.state} → ${row.bot.desiredState}`} /><Detail label="Strategy" value={row.bot.strategyVersion ? `${row.bot.strategyVersion.strategy.name} v${row.bot.strategyVersion.version}` : '—'} /><Detail label="Strategy family" value={row.bot.strategyVersion?.strategy.family ?? '—'} /><Detail label="Generation" value={row.bot.generationId ?? '—'} /><Detail label="Snapshot" value={formatDate(row.score?.snapshotAt)} /></div>
      <section className={`${row.bot.mode === 'DEMO' ? 'mt-5' : 'hidden'} overflow-hidden rounded-[22px] border border-outline/10 bg-surface`}><div className="p-5"><h3 className="font-headline font-black text-white">Gerçekleşmiş Binance TESTNET işlemleri</h3><p className="mt-1 text-xs text-outline">Yalnız Binance tarafından fill edilmiş işlemler; açık conditional emirler bu tabloda gösterilmez.</p></div>{detailLoading ? <div className="h-32 animate-pulse bg-surface-high" /> : !operation?.fills?.length ? <div className="px-5 pb-5 text-sm text-on-surface-variant">Henüz gerçekleşmiş fill yok.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-surface-high uppercase text-outline"><tr>{['Zaman', 'Sembol', 'İşlem', 'Yön', 'Fiyat', 'Miktar', 'Notional', 'Realized PnL', 'Komisyon', 'Net'].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{operation.fills.map((fill) => <tr key={`${fill.symbol}-${fill.tradeId}`} className="border-t border-outline/10"><td className="p-3 text-on-surface-variant">{formatDate(fill.occurredAt)}</td><td className="p-3 font-bold text-white">{fill.symbol}</td><td className="p-3 text-on-surface-variant">{fill.reduceOnly ? 'KAPANIŞ' : 'GİRİŞ'} · {fill.orderType}</td><td className={`p-3 font-bold ${fill.side === 'BUY' ? 'text-secondary' : 'text-error'}`}>{fill.side}</td><td className="p-3 text-white">{fill.price}</td><td className="p-3 text-on-surface-variant">{fill.quantity}</td><td className="p-3 text-on-surface-variant">{formatMoney(Number(fill.quoteQuantity))}</td><td className={`p-3 font-bold ${Number(fill.realizedPnl) >= 0 ? 'text-secondary' : 'text-error'}`}>{formatMoney(Number(fill.realizedPnl))}</td><td className="p-3 text-on-surface-variant">{fill.commission} {fill.commissionAsset}</td><td className={`p-3 font-black ${fill.netRealizedPnl >= 0 ? 'text-secondary' : 'text-error'}`}>{formatMoney(fill.netRealizedPnl)}</td></tr>)}</tbody></table></div>}</section>
      {row.bot.mode === 'PAPER' && <PaperTradeHistory performance={paperPerformance} loading={detailLoading} />}
      {row.bot.mode === 'PAPER' && <PaperFillHistory performance={paperPerformance} loading={detailLoading} />}
    </aside>
  </div>;
}
function PaperTradeHistory({ performance, loading }: { performance: PaperPerformance | null; loading: boolean }) {
  const trades = performance?.trades ?? [];
  return <section className="mt-5 overflow-hidden rounded-[22px] border border-primary/20 bg-surface">
    <div className="p-5"><h3 className="font-headline font-black text-white">PAPER işlem sonuçları</h3><p className="mt-1 text-xs text-outline">Her satır bağımsız bir trade'dir. Açık işlemlerde anlık, kapanmış işlemlerde fee sonrası net PnL gösterilir.</p></div>
    {loading ? <div className="h-32 animate-pulse bg-surface-high" /> : !trades.length ? <div className="px-5 pb-5 text-sm text-on-surface-variant">Henüz PAPER trade oluşmadı.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-xs"><thead className="bg-surface-high uppercase text-outline"><tr>{['Açılış', 'Coin', 'Durum', 'Yön / kaldıraç', 'Giriş', 'Mark / çıkış', 'Teminat', 'Notional', 'Miktar', 'PnL', 'PnL %', 'SL / TP', 'Kapanış nedeni'].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{trades.map((trade) => { const pnl = Number(trade.netPnl); return <tr key={trade.id} className="border-t border-outline/10"><td className="p-3 text-on-surface-variant">{formatDate(trade.openedAt)}</td><td className="p-3 font-black text-primary">{trade.symbol}</td><td className={`p-3 font-bold ${trade.status === 'OPEN' ? 'text-tertiary' : 'text-on-surface-variant'}`}>{trade.status === 'OPEN' ? 'AÇIK' : trade.status === 'CLOSED' ? 'KAPALI' : 'LİKİDE'}</td><td className={`p-3 font-bold ${trade.side === 'BUY' ? 'text-secondary' : 'text-error'}`}>{trade.side === 'BUY' ? 'LONG' : 'SHORT'} · {trade.leverage}x</td><td className="p-3 text-white">{formatEntryPrice(Number(trade.entryPrice))}</td><td className="p-3 text-white">{formatEntryPrice(Number(trade.status === 'OPEN' ? trade.markPrice : trade.exitPrice ?? trade.markPrice))}</td><td className="p-3">{formatMoney(Number(trade.initialMargin))}</td><td className="p-3">{formatMoney(Number(trade.notional))}</td><td className="p-3">{trade.quantity}</td><td className={`p-3 font-black ${pnl >= 0 ? 'text-secondary' : 'text-error'}`}>{formatMoney(pnl)}{trade.status === 'OPEN' ? ' (anlık)' : ''}</td><td className={`p-3 font-bold ${pnl >= 0 ? 'text-secondary' : 'text-error'}`}>{Number(trade.pnlPct).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}%</td><td className="p-3 text-on-surface-variant">{trade.stopLoss ?? '—'} / {trade.takeProfit ?? '—'}</td><td className="p-3 text-on-surface-variant">{trade.closeReason ?? (trade.status === 'OPEN' ? 'Pozisyon açık' : '—')}</td></tr>; })}</tbody></table></div>}
  </section>;
}
function PaperFillHistory({ performance, loading }: { performance: PaperPerformance | null; loading: boolean }) {
  const summary = performance?.closedSummary;
  return <section className="mt-5 overflow-hidden rounded-[22px] border border-outline/10 bg-surface">
    <div className="p-5"><h3 className="font-headline font-black text-white">PAPER fill geçmişi</h3><p className="mt-1 text-xs text-outline">Giriş fill'lerinde realized PnL oluşmaz. Toplam kazanç yalnızca kapanmış trade'lerin fee sonrası net sonucudur.</p>
      {summary && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><MetricCard label="Kapanmış trade" value={String(summary.tradeCount)} /><MetricCard label="Kazanan / Kaybeden" value={`${summary.wins} / ${summary.losses}`} /><MetricCard label="Fee sonrası net PnL" value={formatMoney(Number(summary.netPnl))} /><MetricCard label="Kapanan trade ücretleri" value={formatMoney(Number(summary.fees))} /></div>}
    </div>{loading ? <div className="h-32 animate-pulse bg-surface-high" /> : !performance?.fills.length ? <div className="px-5 pb-5 text-sm text-on-surface-variant">Henüz PAPER fill yok.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-surface-high uppercase text-outline"><tr>{['Zaman', 'Tür', 'Yön', 'Mark', 'Fill', 'Miktar', 'Notional', 'Fill PnL', 'Ücret'].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{performance.fills.map((fill) => { const pnl = Number(fill.realizedPnl); const isExit = pnl !== 0; return <tr key={fill.id} className="border-t border-outline/10"><td className="p-3 text-on-surface-variant">{formatDate(fill.occurredAt)}</td><td className="p-3 font-bold text-white">{isExit ? 'KAPANIŞ' : 'GİRİŞ'}</td><td className={`p-3 font-bold ${fill.side === 'BUY' ? 'text-secondary' : 'text-error'}`}>{fill.side}</td><td className="p-3">{fill.markPrice}</td><td className="p-3 font-bold text-white">{fill.fillPrice}</td><td className="p-3">{fill.quantity}</td><td className="p-3">{formatMoney(Number(fill.notional))}</td><td className={pnl > 0 ? 'p-3 font-bold text-secondary' : pnl < 0 ? 'p-3 font-bold text-error' : 'p-3 font-bold text-outline'}>{isExit ? formatMoney(pnl) : '—'}</td><td className="p-3">{formatMoney(Number(fill.fee))}</td></tr>; })}</tbody></table></div>}</section>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-4 text-sm"><span className="text-on-surface-variant">{label}</span><span className="text-right font-bold text-white">{value}</span></div>; }
