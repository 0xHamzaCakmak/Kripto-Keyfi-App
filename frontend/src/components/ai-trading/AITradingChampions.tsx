import { Trophy } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiErrorMessage } from '../../services/apiClient';
import { aiTradingApi, type AutonomousBot, type AutonomousLifecycle, type ChampionCandidate, type TestnetBotOperation } from '../../services/aiTradingService';
import { AITradingPage, EmptyState, ErrorState, formatDate, MetricCard, ModeBadge, RefreshButton, StatusBadge } from './AITradingUI';

const columns: Array<{ title: string; statuses: AutonomousLifecycle[]; tone: 'neutral' | 'warning' | 'safe' | 'danger'; description: string }> = [
  { title: 'Kanıt topluyor', statuses: ['DRAFT', 'CANDIDATE', 'PAPER', 'TESTING'], tone: 'neutral', description: '50 kapanmış TESTNET işlemini tamamlamayı bekliyor.' },
  { title: 'Challenger', statuses: ['CHALLENGER'], tone: 'warning', description: 'En az 50 kapanmış Binance TESTNET işlemi var.' },
  { title: 'Champion', statuses: ['CHAMPION'], tone: 'safe', description: 'İleri performans değerlendirmesini geçti.' },
  { title: 'Live hazırlık', statuses: ['LIVE_ELIGIBLE'], tone: 'danger', description: 'Gerçek para için ayrıca risk doğrulaması ve yönetici onayı gerekir.' },
];

export default function AITradingChampions() {
  const [bots, setBots] = useState<AutonomousBot[]>([]);
  const [history, setHistory] = useState<ChampionCandidate[]>([]);
  const [operations, setOperations] = useState<TestnetBotOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [botRows, candidates, operationRows] = await Promise.all([aiTradingApi.bots(), aiTradingApi.champions(), aiTradingApi.testnetOperations()]);
      setBots(botRows.filter((bot) => bot.mode === 'DEMO' && bot.lifecycleStatus !== 'ARCHIVED'));
      setHistory(candidates);
      setOperations(operationRows.data);
    } catch (reason) { setError(getApiErrorMessage(reason, 'TESTNET Challenger verileri alınamadı.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const latest = useMemo(() => { const map = new Map<string, ChampionCandidate>(); for (const item of history) if (!map.has(item.tradingBotId)) map.set(item.tradingBotId, item); return map; }, [history]);
  const operationMap = useMemo(() => new Map(operations.map((item) => [item.botId, item])), [operations]);

  return <AITradingPage title="TESTNET Challenger Havuzu" description="Aynı 20 botun TESTNET kanıtını koruyun; 50 kapanmış işleme ulaşan bot Challenger seviyesine otomatik geçer." icon={Trophy} action={<RefreshButton onClick={() => void load()} busy={loading} />}>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{columns.map((column) => <MetricCard key={column.title} label={column.title} value={bots.filter((bot) => column.statuses.includes(bot.lifecycleStatus)).length} detail={column.description} tone={column.tone} />)}</div>
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-on-surface-variant"><strong className="text-primary">Terfi kuralı:</strong> Her bot için Binance TESTNET üzerindeki reduce-only kapanış emirleri ayrı işlem olarak sayılır. Eşik <strong className="text-white">50 kapanmış işlem</strong>. PAPER verisi bu sayaca dahil edilmez; terfi botu durdurmaz ve LIVE yetkisi vermez.</div>
    {error && <ErrorState message={error} />}
    {loading ? <div className="h-72 animate-pulse rounded-[24px] bg-surface" /> : <div className="grid gap-4 xl:grid-cols-4">{columns.map((column) => { const rows = bots.filter((bot) => column.statuses.includes(bot.lifecycleStatus)); return <section key={column.title} className="rounded-[24px] border border-outline/10 bg-surface p-4"><div className="flex items-center justify-between"><h2 className="font-headline font-black text-white">{column.title}</h2><StatusBadge tone={column.tone}>{rows.length}</StatusBadge></div><p className="mt-2 text-xs leading-5 text-outline">{column.description}</p><div className="mt-4 space-y-3">{rows.length === 0 ? <EmptyState title="Bot yok" description="Bu yaşam döngüsü seviyesinde TESTNET botu yok." /> : rows.map((bot) => <BotCard key={bot.id} bot={bot} candidate={latest.get(bot.id) ?? null} operation={operationMap.get(bot.id) ?? null} />)}</div></section>; })}</div>}
  </AITradingPage>;
}

function BotCard({ bot, candidate, operation }: { bot: AutonomousBot; candidate: ChampionCandidate | null; operation: TestnetBotOperation | null }) {
  const evidence = candidate?.evidence && !Array.isArray(candidate.evidence) && typeof candidate.evidence === 'object' ? candidate.evidence as Record<string, unknown> : null;
  const exactTrades = Number(evidence?.totalTrades);
  const trades = Number.isFinite(exactTrades) ? exactTrades : operation?.closedFills ?? 0;
  const score = candidate?.score === null || candidate?.score === undefined ? null : Number(candidate.score);
  return <article className="rounded-2xl border border-outline/10 bg-surface-high p-4"><ModeBadge mode="DEMO" /><h3 className="mt-3 font-bold text-white">{bot.name}</h3><p className="mt-1 text-xs text-outline">{bot.strategyVersion?.strategy.family ?? 'Strategy yok'} · {operation?.symbol ?? 'Sembol bekleniyor'}</p><div className="mt-4 grid grid-cols-2 gap-2"><MetricCard label="Kapanış kanıtı" value={`${trades}/50`} tone={trades >= 50 ? 'safe' : 'neutral'} /><MetricCard label="Score" value={score !== null && Number.isFinite(score) ? score.toFixed(2) : '—'} /></div><div className="mt-3 flex items-center justify-between text-xs"><span className="text-on-surface-variant">Durum</span><StatusBadge tone={bot.lifecycleStatus === 'CHALLENGER' ? 'warning' : bot.lifecycleStatus === 'CHAMPION' ? 'safe' : 'neutral'}>{bot.lifecycleStatus}</StatusBadge></div><p className="mt-3 text-[11px] text-outline">Son değerlendirme: {formatDate(candidate?.evaluatedAt)}</p></article>;
}
