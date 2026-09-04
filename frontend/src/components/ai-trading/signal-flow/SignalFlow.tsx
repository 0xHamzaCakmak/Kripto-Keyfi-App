import { Activity, CircleDollarSign, Radio } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { aiTradingApi, type ArenaDecision, type ArenaStatus, type TestnetAccountSummary, type TestnetBotOperation, type TestnetPosition } from '../../../services/aiTradingService';
import { subscribeTradingEvents, type TradingStreamStatus } from '../../../services/tradingEvents';
import { formatMoney } from '../AITradingUI';

type SignalFlowProps = {
  accountId: string | null;
  initialArena: ArenaStatus | null;
  initialAccount: TestnetAccountSummary | null;
};

type SignalTone = { text: string; soft: string; border: string };

const MAX_NETWORK_NODES = 8;
const MAX_FEED_ITEMS = 12;

export default function SignalFlow({ accountId, initialArena, initialAccount }: SignalFlowProps) {
  const [decisions, setDecisions] = useState<ArenaDecision[]>(initialArena?.recentDecisions ?? []);
  const [operations, setOperations] = useState<TestnetBotOperation[]>([]);
  const [account, setAccount] = useState<TestnetAccountSummary | null>(initialAccount);
  const [streamStatus, setStreamStatus] = useState<TradingStreamStatus>('CONNECTING');
  const [updatedAt, setUpdatedAt] = useState<string | null>(initialArena?.latestDecisionAt ?? null);
  const decisionRequestActive = useRef(false);
  const portfolioRequestActive = useRef(false);

  useEffect(() => { setAccount(initialAccount); }, [initialAccount]);
  useEffect(() => {
    if (!initialArena) return;
    setDecisions((current) => mergeDecisions(current, initialArena.recentDecisions ?? []));
    setUpdatedAt(initialArena.latestDecisionAt);
  }, [initialArena]);

  const refreshDecisions = useCallback(async () => {
    if (decisionRequestActive.current) return;
    decisionRequestActive.current = true;
    try {
      const arena = await aiTradingApi.arenaStatus();
      setDecisions((current) => mergeDecisions(current, arena.data.recentDecisions ?? []));
      setUpdatedAt(arena.data.latestDecisionAt);
    } catch { /* The last valid signal snapshot remains visible during a transient poll failure. */ }
    finally { decisionRequestActive.current = false; }
  }, []);

  const refreshPortfolio = useCallback(async () => {
    if (portfolioRequestActive.current) return;
    portfolioRequestActive.current = true;
    try {
      const [operationEnvelope, accountEnvelope] = await Promise.all([
        aiTradingApi.testnetOperations(), aiTradingApi.testnetAccountSummary(),
      ]);
      setOperations(operationEnvelope.data);
      setAccount(accountEnvelope.data);
    } catch { /* SSE/polling will retry; never replace valid portfolio data with an empty fallback. */ }
    finally { portfolioRequestActive.current = false; }
  }, []);

  useEffect(() => {
    void refreshDecisions(); void refreshPortfolio();
    const decisionTimer = window.setInterval(() => void refreshDecisions(), 4_000);
    const portfolioTimer = window.setInterval(() => void refreshPortfolio(), 15_000);
    return () => { window.clearInterval(decisionTimer); window.clearInterval(portfolioTimer); };
  }, [refreshDecisions, refreshPortfolio]);

  useEffect(() => {
    if (!accountId) { setStreamStatus('OFFLINE'); return; }
    return subscribeTradingEvents(accountId, (event) => {
      if (event.topic === 'trading.position' || event.topic === 'trading.account' || event.topic === 'trading.order') void refreshPortfolio();
    }, setStreamStatus);
  }, [accountId, refreshPortfolio]);

  const visibleDecisions = useMemo(() => latestBySymbol(decisions).slice(0, MAX_NETWORK_NODES), [decisions]);
  const positionsByBot = useMemo(() => new Map(operations.filter((item) => item.position).map((item) => [item.botId, item.position!])), [operations]);

  return <section className="overflow-hidden rounded-[28px] border border-primary/15 bg-surface shadow-2xl shadow-black/20">
    <header className="flex flex-col gap-3 border-b border-outline/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Activity size={20}/></span><div><h2 className="font-headline text-lg font-black text-white">Sinyal Akışı</h2><p className="text-xs text-on-surface-variant">Gerçek bot kararları · yoğun sinyaller coin bazında gruplanır</p></div></div>
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[.12em]"><span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${streamTone(streamStatus)}`}><Radio size={12}/>{streamLabel(streamStatus)}</span><span className="rounded-full border border-outline/15 px-3 py-1.5 text-outline">Kararlar 4 sn</span>{updatedAt && <span className="text-outline">Son {clock(updatedAt)}</span>}</div>
    </header>

    <div className="grid xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="relative min-h-[620px] overflow-hidden border-b border-outline/10 bg-[radial-gradient(circle_at_13%_50%,color-mix(in_srgb,var(--color-primary)_13%,transparent),transparent_28%)] xl:border-b-0 xl:border-r">
        <div className="absolute left-[4%] top-1/2 z-20 hidden -translate-y-1/2 lg:block"><BalanceNode account={account}/></div>
        {visibleDecisions.length > 0 ? <>
          <svg className="absolute inset-0 hidden h-full w-full lg:block" viewBox="0 0 1000 620" preserveAspectRatio="none" aria-hidden="true">
            {visibleDecisions.map((decision, index) => <SignalParticle key={`${decision.symbol}-${decision.id}`} decision={decision} index={index} total={visibleDecisions.length}/>) }
          </svg>
          <div className="absolute inset-0 z-10 hidden lg:block">{visibleDecisions.map((decision, index) => <SignalNode key={`${decision.symbol}-${decision.id}`} decision={decision} position={positionsByBot.get(decision.botId) ?? null} index={index} total={visibleDecisions.length}/>)}</div>
          <div className="space-y-2 p-4 lg:hidden"><div className="mb-4"><BalanceNode account={account}/></div>{visibleDecisions.map((decision) => <CompactSignalNode key={`${decision.symbol}-${decision.id}`} decision={decision} position={positionsByBot.get(decision.botId) ?? null}/>)}</div>
        </> : <div className="flex min-h-[620px] items-center justify-center p-8 text-center"><div><Radio className="mx-auto text-outline" size={32}/><p className="mt-3 font-bold text-white">Henüz karar akışı yok</p><p className="mt-1 text-sm text-on-surface-variant">Botların ilk LONG, SHORT veya HOLD kararı burada hareket etmeye başlayacak.</p></div></div>}
      </div>
      <SignalFeed decisions={decisions.slice(0, MAX_FEED_ITEMS)}/>
    </div>
  </section>;
}

const SignalParticle = memo(function SignalParticle({ decision, index, total }: { decision: ArenaDecision; index: number; total: number }) {
  const y = nodeY(index, total);
  const path = `M 135 310 C 255 310, 275 ${y}, 430 ${y}`;
  const tone = toneFor(decision.action);
  return <g className={tone.text}>
    <path d={path} fill="none" stroke="currentColor" strokeOpacity=".28" strokeWidth="1.8" className="signal-flow-path"/>
    <path d={path} fill="none" stroke="currentColor" strokeOpacity=".08" strokeWidth="9" className="signal-flow-glow"/>
    <circle r="4" fill="currentColor" className="signal-motion-particle"><animateMotion dur={`${2.4 + (index % 3) * .35}s`} repeatCount="indefinite" path={path}/></circle>
    <circle r="2.5" fill="currentColor" opacity=".75" className="signal-motion-particle"><animateMotion begin="-1.2s" dur={`${3.1 + (index % 2) * .45}s`} repeatCount="indefinite" path={path}/></circle>
  </g>;
});

const SignalNode = memo(function SignalNode({ decision, position, index, total }: { decision: ArenaDecision; position: TestnetPosition | null; index: number; total: number }) {
  const tone = toneFor(decision.action); const confidence = confidencePercent(decision.confidence);
  return <article style={{ top: `${nodeY(index, total) / 6.2}%` }} className={`signal-node-pulse absolute left-[43%] right-[3%] -translate-y-1/2 rounded-2xl border bg-background/80 px-4 py-2.5 backdrop-blur-md ${tone.border} ${tone.text}`}>
    <div className="grid grid-cols-[minmax(0,1fr)_82px_58px] items-center gap-3"><div className="flex min-w-0 items-center gap-3"><CoinMark symbol={decision.symbol}/><div className="min-w-0"><p className="truncate text-sm font-black text-white">{pair(decision.symbol)}</p><p className="truncate text-[10px] text-outline">{decision.botName}</p></div></div><span className={`rounded-lg px-2 py-1.5 text-center text-[11px] font-black ${tone.soft}`}>{decision.action}</span><span title={`Confidence kaynağı: ${decision.confidenceSource}`} className="text-right text-sm font-black text-white">%{confidence}</span></div>
    <div className="mt-2 flex items-center gap-3"><span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-highest"><span className="block h-full rounded-full bg-current transition-[width] duration-700" style={{ width: `${confidence}%` }}/></span>{position && <span className="shrink-0 text-[9px] font-black uppercase text-on-surface-variant">● Açık {position.side} <span className={Number(position.roi) >= 0 ? 'text-secondary' : 'text-error'}>{signedPercent(position.roi * 100)}</span></span>}</div>
  </article>;
});

function CompactSignalNode({ decision, position }: { decision: ArenaDecision; position: TestnetPosition | null }) {
  const tone = toneFor(decision.action); const confidence = confidencePercent(decision.confidence);
  return <article className={`signal-node-pulse rounded-2xl border bg-background/60 p-3 ${tone.border} ${tone.text}`}><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><CoinMark symbol={decision.symbol}/><div><p className="font-black text-white">{pair(decision.symbol)}</p><p className="text-[10px] text-outline">{clock(decision.occurredAt)}</p></div></div><span className={`rounded-lg px-2.5 py-1 text-[10px] font-black ${tone.soft}`}>{decision.action}</span><span className="font-black text-white">%{confidence}</span></div>{position && <p className="mt-2 text-[10px] font-black uppercase text-on-surface-variant">● Açık {position.side} · ROE <span className={Number(position.roi) >= 0 ? 'text-secondary' : 'text-error'}>{signedPercent(position.roi * 100)}</span></p>}</article>;
}

function SignalFeed({ decisions }: { decisions: ArenaDecision[] }) {
  return <aside className="min-h-[420px] bg-background/25 p-4"><div className="flex items-center justify-between"><div><h3 className="font-headline text-sm font-black uppercase tracking-[.1em] text-white">Canlı Sinyaller</h3><p className="mt-1 text-[10px] text-outline">Son gerçek strateji kararları</p></div><span className="flex items-center gap-1.5 text-[10px] font-black text-secondary"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-secondary"/> LIVE</span></div><div className="mt-4 space-y-2">{decisions.length === 0 ? <p className="rounded-xl border border-dashed border-outline/15 p-4 text-xs text-outline">Sinyal bekleniyor…</p> : decisions.map((decision) => { const tone = toneFor(decision.action); return <div key={decision.id} className="signal-feed-enter grid grid-cols-[52px_minmax(0,1fr)_52px_42px] items-center gap-2 rounded-xl border border-outline/10 bg-surface-high/70 px-3 py-2.5 text-[10px]"><span className="tabular-nums text-outline">{clock(decision.occurredAt)}</span><span className="truncate font-bold text-white">{pair(decision.symbol)}</span><span className={`font-black ${tone.text}`}>{decision.action}</span><span className="text-right font-black text-on-surface">%{confidencePercent(decision.confidence)}</span></div>; })}</div></aside>;
}

function BalanceNode({ account }: { account: TestnetAccountSummary | null }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-background/75 p-3 text-primary shadow-[0_0_32px_currentColor] backdrop-blur-md lg:block lg:h-24 lg:w-24 lg:rounded-full lg:p-0"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-current/30 bg-primary/10 lg:absolute lg:left-1/2 lg:top-2 lg:-translate-x-1/2"><CircleDollarSign size={25}/></span><div className="min-w-0 lg:absolute lg:bottom-3 lg:left-1/2 lg:w-36 lg:-translate-x-1/2 lg:translate-y-full lg:text-center"><p className="text-[9px] font-black uppercase tracking-[.12em] text-outline">Bakiye kaynağı</p><p className="truncate text-xs font-black text-white">{account?.connected ? formatMoney(Number(account.equity)) : 'USDT / USDC'}</p></div></div>;
}

function CoinMark({ symbol }: { symbol: string }) { const base = symbol.replace(/USDT$|USDC$/i, ''); return <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/30 bg-current/10 text-[10px] font-black">{base.slice(0, 2)}</span>; }
function mergeDecisions(current: ArenaDecision[], incoming: ArenaDecision[]) { const rows = new Map([...current, ...incoming].map((item) => [item.id, item])); return [...rows.values()].sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt) || Number(BigInt(right.id) - BigInt(left.id))).slice(0, 60); }
function latestBySymbol(decisions: ArenaDecision[]) { const seen = new Set<string>(); return decisions.filter((decision) => !seen.has(decision.symbol) && Boolean(seen.add(decision.symbol))); }
function nodeY(index: number, total: number) { if (total <= 1) return 310; const top = 56; const bottom = 564; return top + index * ((bottom - top) / (total - 1)); }
function pair(symbol: string) { return symbol.replace(/(USDT|USDC)$/i, '/$1'); }
function confidencePercent(value: number) { return Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100); }
function clock(value: string) { return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)); }
function signedPercent(value: number) { return `${value >= 0 ? '+' : ''}${value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}%`; }
function toneFor(action: ArenaDecision['action']): SignalTone { return action === 'LONG' ? { text: 'text-secondary', soft: 'bg-secondary/10 text-secondary', border: 'border-secondary/25' } : action === 'SHORT' ? { text: 'text-error', soft: 'bg-error/10 text-error', border: 'border-error/25' } : { text: 'text-primary', soft: 'bg-primary/10 text-primary', border: 'border-primary/25' }; }
function streamLabel(status: TradingStreamStatus) { return ({ CONNECTING: 'Bağlanıyor', LIVE: 'Canlı', RECONNECTING: 'Yeniden bağlanıyor', OFFLINE: 'Polling' } as const)[status]; }
function streamTone(status: TradingStreamStatus) { return status === 'LIVE' ? 'border-secondary/25 bg-secondary/5 text-secondary' : status === 'OFFLINE' ? 'border-outline/20 text-outline' : 'border-primary/25 bg-primary/5 text-primary'; }
