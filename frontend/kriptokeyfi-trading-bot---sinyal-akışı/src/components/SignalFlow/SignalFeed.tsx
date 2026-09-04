import React, { useState, useEffect, useMemo } from 'react';
import { type SignalEvent } from '../../types';
import { type TradeProArena } from '../../services/backendDashboard';
import { getCoinIcon } from '../CoinIcons';
import { ArrowUpRight, ArrowDownRight, Minus, Pause, Play, ChevronRight, History } from 'lucide-react';

interface SignalFeedProps {
  onSelectPair?: (symbol: string) => void;
  arena: TradeProArena | null;
  loading: boolean;
  hasBackendAccount: boolean;
}

export const SignalFeed: React.FC<SignalFeedProps> = ({ onSelectPair, arena, loading, hasBackendAccount }) => {
  const recentDecisions = useMemo(() => (arena?.recentDecisions ?? []).map(toSignalEvent), [arena?.recentDecisions]);
  const [liveStreamEvents, setLiveStreamEvents] = useState<SignalEvent[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    if (!arena) setLiveStreamEvents([]);
    else if (!isPaused) setLiveStreamEvents(recentDecisions);
  }, [arena, isPaused, recentDecisions]);

  const getDecisionBadge = (decision: 'LONG' | 'SHORT' | 'HOLD') => {
    switch (decision) {
      case 'LONG':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30">
            LONG
          </span>
        );
      case 'SHORT':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#f84960]/15 text-[#f84960] border border-[#f84960]/30">
            SHORT
          </span>
        );
      case 'HOLD':
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/30">
            HOLD
          </span>
        );
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
      {/* 1. SON KARARLAR (Gerçek zamanlı sinyaller) */}
      <div
        id="recent-decisions-card"
        className="bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-4 shadow-xl flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#2b3139]">
            <div>
              <h3 className="text-sm font-bold tracking-wider text-[#eaecef] uppercase font-['Inter','Plus_Jakarta_Sans',sans-serif]">
                SON KARARLAR
              </h3>
              <p className="text-[11px] text-[#848e9c]">Gerçek zamanlı sinyaller</p>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#00d2ff] font-['JetBrains_Mono',monospace]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00d2ff] shadow-[0_0_8px_#00d2ff] animate-pulse" />
              <span>{hasBackendAccount && arena ? 'LIVE' : 'OFFLINE'}</span>
            </div>
          </div>

          {/* Decisions List */}
          <div className="space-y-1.5 overflow-hidden">
            {!loading && recentDecisions.length === 0 && <EmptyFeed message={hasBackendAccount ? 'Henüz backend kararı yok' : 'Live API bağlı değil'} />}
            {recentDecisions.slice(0, 10).map((item, idx) => (
              <div
                key={item.id || idx}
                onClick={() => onSelectPair && onSelectPair(item.symbol)}
                className="group flex items-center justify-between p-2 rounded-lg bg-[#0b0e11]/60 hover:bg-[#2b3139]/80 border border-[#2b3139]/70 transition-all cursor-pointer transform duration-200"
                style={{
                  animation: idx === 0 ? 'slideDown 0.25s ease-out' : 'none',
                }}
              >
                {/* Time & Coin */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[10px] font-['JetBrains_Mono',monospace] text-[#848e9c]">
                    {item.timestamp}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {getCoinIcon(item.symbol, 18)}
                    <span className="text-xs font-bold text-[#eaecef] font-['JetBrains_Mono',monospace] tracking-tight">
                      {item.symbol}
                    </span>
                  </div>
                </div>

                {/* Action & Confidence */}
                <div className="flex items-center gap-3">
                  {getDecisionBadge(item.decision)}
                  <span className="text-xs font-bold font-['JetBrains_Mono',monospace] text-[#848e9c] w-9 text-right">
                    %{item.confidence}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Link */}
        <button
          id="btn-all-signal-history"
          onClick={() => setShowHistoryModal(true)}
          className="mt-3 pt-2.5 border-t border-[#2b3139] w-full flex items-center justify-center gap-1 text-xs text-[#00d2ff] hover:text-cyan-300 font-medium transition-colors"
        >
          <span>Tüm sinyal geçmişi</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. CANLI AKIŞ (Son sinyaller) */}
      <div
        id="live-stream-card"
        className="bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-4 shadow-xl flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#2b3139]">
            <div>
              <h3 className="text-sm font-bold tracking-wider text-[#eaecef] uppercase font-['Inter','Plus_Jakarta_Sans',sans-serif]">
                CANLI AKIŞ
              </h3>
              <p className="text-[11px] text-[#848e9c]">Son sinyaller</p>
            </div>
            <button
              id="pause-live-stream-btn"
              onClick={() => setIsPaused(!isPaused)}
              title={isPaused ? 'Akışı Başlat' : 'Akışı Duraklat'}
              className="p-1 rounded bg-[#0b0e11] hover:bg-[#2b3139] text-[#848e9c] hover:text-[#eaecef] border border-[#2b3139] transition-colors"
            >
              {isPaused ? <Play className="w-3 h-3 text-[#02c076]" /> : <Pause className="w-3 h-3" />}
            </button>
          </div>

          {/* Stream Ticks */}
          <div className="space-y-1.5 overflow-hidden">
            {!loading && liveStreamEvents.length === 0 && <EmptyFeed message={hasBackendAccount ? 'Yeni sinyal bekleniyor' : 'Live API bağlı değil'} />}
            {liveStreamEvents.slice(0, 11).map((evt, idx) => (
              <div
                key={evt.id || idx}
                className="flex items-center justify-between p-1.5 rounded-lg bg-[#0b0e11]/40 hover:bg-[#2b3139]/50 border border-[#2b3139]/40 text-xs transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#848e9c] font-['JetBrains_Mono',monospace]">
                    {evt.timestamp}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {getCoinIcon(evt.symbol, 16)}
                    <span className="font-semibold text-[#eaecef] font-['JetBrains_Mono',monospace] text-[11px]">
                      {evt.symbol}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {getDecisionBadge(evt.decision)}
                  <span
                    className={`text-[11px] font-bold font-['JetBrains_Mono',monospace] flex items-center ${
                      evt.decision === 'LONG'
                        ? 'text-[#02c076]'
                        : evt.decision === 'SHORT'
                        ? 'text-[#f84960]'
                        : 'text-[#f0b90b]'
                    }`}
                  >
                    %{evt.confidence}
                    {evt.decision === 'LONG' && <ArrowUpRight className="w-3 h-3 ml-0.5" />}
                    {evt.decision === 'SHORT' && <ArrowDownRight className="w-3 h-3 ml-0.5" />}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sleek Theme Live Throughput Meter */}
        <div className="mt-2 pt-2 border-t border-[#2b3139]">
          <div className="flex items-center justify-between text-[10px] text-[#848e9c] mb-1.5 font-bold uppercase tracking-wider">
            <span>THROUGHPUT</span>
            <span className="text-[#00d2ff] font-['JetBrains_Mono',monospace]">{formatThroughput(arena?.throughputPerMinute)} ACT/MIN</span>
          </div>
          <div className="h-1.5 bg-[#0b0e11] border border-[#2b3139] rounded-full overflow-hidden">
            <div className="h-full bg-[#00d2ff] rounded-full shadow-[0_0_8px_#00d2ff] transition-all duration-500" style={{ width: `${Math.min(100, (arena?.throughputPerMinute ?? 0) * 2)}%` }} />
          </div>
        </div>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div
          id="signal-history-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
        >
          <div className="bg-[#1e2329] border border-[#2b3139] rounded-2xl w-full max-w-2xl max-h-[85vh] p-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#2b3139]">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-[#00d2ff]" />
                <h3 className="text-base font-bold text-[#eaecef]">Sinyal Karar Geçmişi (Canlı Log)</h3>
              </div>
              <button
                id="close-history-modal-btn"
                onClick={() => setShowHistoryModal(false)}
                className="text-[#848e9c] hover:text-[#eaecef] text-sm font-semibold p-1.5 rounded-lg bg-[#0b0e11] border border-[#2b3139]"
              >
                ✕ Kapat
              </button>
            </div>

            <div className="mt-4 overflow-y-auto flex-1 space-y-2 pr-1">
              {liveStreamEvents.map((ev, i) => (
                <div
                  key={ev.id || i}
                  className="flex items-center justify-between p-2.5 bg-[#0b0e11]/80 rounded-xl border border-[#2b3139] text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-['JetBrains_Mono',monospace] text-[#848e9c]">{ev.timestamp}</span>
                    <div className="flex items-center gap-2">
                      {getCoinIcon(ev.symbol, 20)}
                      <span className="font-bold text-[#eaecef] font-['JetBrains_Mono',monospace]">{ev.symbol}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getDecisionBadge(ev.decision)}
                    <span className="font-semibold text-[#848e9c] font-['JetBrains_Mono',monospace]">
                      Güven: %{ev.confidence}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function toSignalEvent(decision: TradeProArena['recentDecisions'][number]): SignalEvent {
  const occurredAt = new Date(decision.occurredAt);
  const rawConfidence = Number(decision.confidence);
  return {
    id: decision.id,
    timestamp: Number.isNaN(occurredAt.getTime()) ? '—' : occurredAt.toLocaleTimeString('tr-TR', { hour12: false }),
    timeMs: Number.isNaN(occurredAt.getTime()) ? 0 : occurredAt.getTime(),
    symbol: decision.symbol,
    decision: decision.action,
    confidence: Math.round(rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence),
    changePercent: 0,
    price: 0,
  };
}

function formatThroughput(value: number | null | undefined) {
  return (value ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
}

function EmptyFeed({ message }: { message: string }) {
  return <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-[#2b3139] bg-[#0b0e11]/30 px-3 text-center text-[10px] text-[#848e9c]">{message}</div>;
}
