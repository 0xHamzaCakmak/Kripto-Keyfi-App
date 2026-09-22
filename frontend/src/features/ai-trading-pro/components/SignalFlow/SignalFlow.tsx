import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CoinNodeState, SignalEvent } from '../../types';
import { type TradeProArena, type TradeProPosition } from '../../services/backendDashboard';
import { SignalNode } from './SignalNode';
import { SignalFlowCanvas, type SignalBurst } from './SignalFlowCanvas';
import { buildUniversePool, beamMultipliers, formatPair, rotateSignalWindow } from './signalFlowState';
import { Play, Pause } from 'lucide-react';

interface SignalFlowProps {
  onNewSignal?: (signal: SignalEvent) => void;
  accountId: string | null;
  arena: TradeProArena | null;
  positions: TradeProPosition[];
  totalBalance: number;
}

export const SignalFlow: React.FC<SignalFlowProps> = ({ accountId, arena, positions, totalBalance }) => {
  const [coins, setCoins] = useState<CoinNodeState[]>([]);
  const [isRunning, setIsRunning] = useState(true);
  const [signalBursts, setSignalBursts] = useState<SignalBurst[]>([]);
  const poolRef = useRef<CoinNodeState[]>([]);
  const visibleRef = useRef<CoinNodeState[]>([]);
  const shownAtRef = useRef(new Map<string, number>());

  const containerRef = useRef<HTMLDivElement | null>(null);
  const sourceNodeRef = useRef<HTMLDivElement | null>(null);
  const coinNodeElementsRef = useRef<(HTMLDivElement | null)[]>([]);

  const [canvasDimensions, setCanvasDimensions] = useState({ width: 600, height: 440 });
  const [sourceCoord, setSourceCoord] = useState<{ x: number; y: number }>({ x: 70, y: 220 });
  const [targetCoords, setTargetCoords] = useState<{ x: number; y: number }[]>([]);
  // Update DOM measurements for Canvas curves
  const updateMeasurements = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();

    setCanvasDimensions({
      width: containerRect.width,
      height: containerRect.height,
    });

    if (sourceNodeRef.current) {
      const srcRect = sourceNodeRef.current.getBoundingClientRect();
      setSourceCoord({
        x: srcRect.left - containerRect.left + srcRect.width / 2,
        y: srcRect.top - containerRect.top + srcRect.height / 2,
      });
    }

    const coords: { x: number; y: number }[] = [];
    coinNodeElementsRef.current.forEach((el) => {
      if (el) {
        const rect = el.getBoundingClientRect();
        coords.push({
          x: rect.left - containerRect.left + 16, // Connect directly to coin icon
          y: rect.top - containerRect.top + rect.height / 2,
        });
      }
    });

    setTargetCoords(coords);
  }, []);

  // Listen to window / container resizes
  useEffect(() => {
    updateMeasurements();
    const handleResize = () => updateMeasurements();
    window.addEventListener('resize', handleResize);

    const observer = new ResizeObserver(() => updateMeasurements());
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Measure after fonts and DOM settles
    const t1 = setTimeout(updateMeasurements, 100);
    const t2 = setTimeout(updateMeasurements, 400);

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [updateMeasurements]);

  useEffect(() => {
    const timer = window.setTimeout(updateMeasurements, 40);
    return () => window.clearTimeout(timer);
  }, [coins, positions, updateMeasurements]);

  useEffect(() => {
    poolRef.current = [];
    visibleRef.current = [];
    shownAtRef.current.clear();
    setCoins([]);
    setSignalBursts([]);
  }, [accountId]);

  useEffect(() => {
    if (!arena) return;
    poolRef.current = buildUniversePool(arena.botSymbols ?? arena.recentDecisions.map(row => row.symbol), arena.recentDecisions);
  }, [arena]);

  // Keep a stable clock even when backend polling returns every second.
  useEffect(() => {
    if (!isRunning || !accountId) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      const next = rotateSignalWindow(visibleRef.current, poolRef.current, shownAtRef.current, now);
      visibleRef.current = next;
      setCoins(next);
      const added = next.find(coin => coin.pulseTrigger === now);
      setSignalBursts(added && !added.awaitingDecision ? [{ id: 'rotation-' + now, symbol: added.symbol, decision: added.decision }] : []);
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [accountId, isRunning]);

  const displayCoins = useMemo(() => coins.map((coin) => {
    const position = positions.find((item) => formatPair(item.symbol) === coin.symbol && Math.abs(Number(item.quantity)) > 0);
    if (!position) return { ...coin, activePosition: undefined };
    const entryPrice = Number(position.entryPrice);
    const currentPrice = Number(position.markPrice);
    const pnl = Number(position.unrealizedPnl);
    const notional = Math.abs(Number(position.quantity) * entryPrice);
    const margin = notional / Math.max(Number(position.leverage), 1);
    return {
      ...coin,
      activePosition: {
        direction: position.side,
        roe: Number((margin > 0 ? pnl / margin * 100 : 0).toFixed(2)),
        pnl,
        entryPrice,
        currentPrice,
      },
    };
  }), [coins, positions]);
  const nodeBeamMultipliers = useMemo(() => beamMultipliers(displayCoins), [displayCoins]);
  const nodeSymbols = useMemo(() => displayCoins.map((coin) => coin.symbol), [displayCoins]);
  const nodeDecisions = useMemo(() => displayCoins.map((coin) => coin.decision), [displayCoins]);

  const handleToggleRunning = () => {
    setIsRunning((running) => !running);
  };

  const setCoinRef = (el: HTMLDivElement | null, index: number) => {
    coinNodeElementsRef.current[index] = el;
  };

  return (
    <div
      id="signal-flow-card"
      className="h-full bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-5 shadow-xl relative overflow-hidden backdrop-blur-md flex flex-col justify-between flow-radial-bg"
    >
      {/* Background ambient accents */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-[#00d2ff]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-[#02c076]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Card Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[#2b3139] relative z-20">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold tracking-wider text-[#eaecef] uppercase font-['Inter','Plus_Jakarta_Sans',sans-serif]">
              SİNYAL AKIŞI
            </h2>
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isRunning ? 'bg-[#00d2ff] opacity-75' : 'bg-[#f0b90b] opacity-75'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${isRunning ? 'bg-[#00d2ff]' : 'bg-[#f0b90b]'}`}></span>
            </span>
          </div>
          <p className="text-xs text-[#848e9c]">Parite başına son karar · her saniye bir coin · 9 görünür</p>
          {arena && <p className="text-[10px] text-[#848e9c]">{arena.recentDecisions.length}/{arena.botSymbols?.length ?? 0} paritede kayıtlı karar var. Diğerleri karar bekliyor.</p>}
        </div>

        {/* Live Controls */}
        <div className="flex items-center gap-2">
          {/* Pause / Resume */}
          <button
            id="toggle-stream-btn"
            onClick={handleToggleRunning}
            className={`p-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition-all ${
              isRunning
                ? 'bg-[#1e2329] hover:bg-[#2b3139] text-[#848e9c] hover:text-[#eaecef] border-[#2b3139]'
                : 'bg-[#02c076]/10 hover:bg-[#02c076]/20 text-[#02c076] border-[#02c076]/40'
            }`}
          >
            {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Signal Flow Canvas & Grid Container */}
      <div
        ref={containerRef}
        id="signal-flow-network-container"
        className="relative w-full min-h-[420px] flex flex-1 items-center"
      >
        {/* Dynamic High-Performance Neon Canvas */}
        <SignalFlowCanvas
          key={accountId ?? 'no-account'}
          nodeCount={coins.length}
          nodeSymbols={nodeSymbols}
          nodeDecisions={nodeDecisions}
          nodeBeamMultipliers={nodeBeamMultipliers}
          signalBursts={signalBursts}
          ambientSpawnInterval={110}
          targetCoordinates={targetCoords}
          sourceCoordinate={sourceCoord}
          width={canvasDimensions.width}
          height={canvasDimensions.height}
        />

        <div className="relative z-10 w-full grid grid-cols-12 gap-3 items-center">
          {/* Left Column: Source Node ($ USDT / Balance Origin) */}
          <div className="col-span-3 sm:col-span-3 flex flex-col items-center justify-center">
            <div
              ref={sourceNodeRef}
              id="source-usdt-node"
              className="relative group cursor-pointer"
            >
              {/* Pulsing Outer Glow */}
              <div className="absolute -inset-2 rounded-full bg-[#00d2ff]/20 blur-md animate-pulse-ring pointer-events-none" />

              {/* Main Source Card (Sleek Theme Style) */}
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-[#1e2329] border-2 border-[#00d2ff] flex flex-col items-center justify-center shadow-[0_0_30px_rgba(0,210,255,0.35)] text-center p-2">
                <h3 className="text-base sm:text-lg font-bold tracking-wider text-[#00d2ff] font-['JetBrains_Mono',monospace]">
                  USDT
                </h3>
                <p className="text-[9px] text-[#848e9c] tracking-tight uppercase font-medium">
                  CASH RESERVE
                </p>
                <p className="text-[11px] sm:text-xs font-bold text-[#02c076] font-['JetBrains_Mono',monospace] mt-0.5">
                  ${formatCompactBalance(totalBalance)}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Column Headers & Target Coin Nodes */}
          <div className="col-span-9 sm:col-span-9 flex flex-col gap-2 pl-2 sm:pl-4">
            {/* Headers */}
            <div className="grid grid-cols-12 gap-2 px-3 py-1 text-[11px] font-semibold text-[#848e9c] tracking-wider uppercase border-b border-[#2b3139]">
              <div className="col-span-4">PARİTE</div>
              <div className="col-span-3 text-center">SON KARAR</div>
              <div className="col-span-2 text-right">GÜVEN</div>
              <div className="col-span-3 text-right pr-2">AKIŞ</div>
            </div>

            {!displayCoins.length && <p className="p-3 text-xs text-[#848e9c]">Gerçek motor kararı bekleniyor.</p>}
            {/* List of Coins */}
            <div className="flex flex-col gap-1.5">
              {displayCoins.map((coin, index) => (
                <SignalNode
                  key={coin.symbol}
                  coin={coin}
                  index={index}
                  onAttachRef={setCoinRef}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function formatCompactBalance(value: number) {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
