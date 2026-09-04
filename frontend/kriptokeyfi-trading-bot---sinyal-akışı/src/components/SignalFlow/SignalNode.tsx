import React, { useEffect, useState } from 'react';
import { CoinNodeState } from '../../types';
import { getCoinIcon } from '../CoinIcons';
import { ArrowUpRight, ArrowDownRight, Minus, Zap } from 'lucide-react';

interface SignalNodeProps {
  coin: CoinNodeState;
  index: number;
  onAttachRef?: (el: HTMLDivElement | null, index: number) => void;
}

export const SignalNode: React.FC<SignalNodeProps> = ({ coin, index, onAttachRef }) => {
  const [isPulsing, setIsPulsing] = useState(false);

  useEffect(() => {
    if (coin.pulseTrigger > 0) {
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 900);
      return () => clearTimeout(timer);
    }
  }, [coin.pulseTrigger]);

  const getDecisionBadge = () => {
    switch (coin.decision) {
      case 'LONG':
        return (
          <div
            id={`signal-badge-${coin.symbol.replace('/', '-')}`}
            className={`px-2.5 py-0.5 rounded text-xs font-bold tracking-wider transition-all duration-300 flex items-center gap-1 bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30 ${
              isPulsing ? 'shadow-[0_0_15px_rgba(2,192,118,0.6)] scale-105 border-[#02c076]' : ''
            }`}
          >
            <ArrowUpRight className="w-3 h-3 text-[#02c076]" />
            <span>LONG</span>
          </div>
        );
      case 'SHORT':
        return (
          <div
            id={`signal-badge-${coin.symbol.replace('/', '-')}`}
            className={`px-2.5 py-0.5 rounded text-xs font-bold tracking-wider transition-all duration-300 flex items-center gap-1 bg-[#f84960]/15 text-[#f84960] border border-[#f84960]/30 ${
              isPulsing ? 'shadow-[0_0_15px_rgba(248,73,96,0.6)] scale-105 border-[#f84960]' : ''
            }`}
          >
            <ArrowDownRight className="w-3 h-3 text-[#f84960]" />
            <span>SHORT</span>
          </div>
        );
      case 'HOLD':
      default:
        return (
          <div
            id={`signal-badge-${coin.symbol.replace('/', '-')}`}
            className={`px-2.5 py-0.5 rounded text-xs font-bold tracking-wider transition-all duration-300 flex items-center gap-1 bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/30 ${
              isPulsing ? 'shadow-[0_0_15px_rgba(240,185,11,0.6)] scale-105 border-[#f0b90b]' : ''
            }`}
          >
            <Minus className="w-3 h-3 text-[#f0b90b]" />
            <span>HOLD</span>
          </div>
        );
    }
  };

  const getAkisColor = () => {
    switch (coin.decision) {
      case 'LONG':
        return {
          track: 'bg-[#02c076]/20',
          line: 'border-[#02c076]/40',
          dot: 'bg-[#02c076] shadow-[0_0_8px_#02c076]',
          arrow: 'text-[#02c076]',
        };
      case 'SHORT':
        return {
          track: 'bg-[#f84960]/20',
          line: 'border-[#f84960]/40',
          dot: 'bg-[#f84960] shadow-[0_0_8px_#f84960]',
          arrow: 'text-[#f84960]',
        };
      case 'HOLD':
      default:
        return {
          track: 'bg-[#f0b90b]/20',
          line: 'border-[#f0b90b]/40',
          dot: 'bg-[#f0b90b] shadow-[0_0_8px_#f0b90b]',
          arrow: 'text-[#f0b90b]',
        };
    }
  };

  const getLeftBorderColor = () => {
    switch (coin.decision) {
      case 'LONG':
        return 'border-l-[#02c076]';
      case 'SHORT':
        return 'border-l-[#f84960]';
      case 'HOLD':
      default:
        return 'border-l-[#f0b90b]';
    }
  };

  const akisStyle = getAkisColor();

  return (
    <div
      ref={(el) => onAttachRef && onAttachRef(el, index)}
      id={`signal-node-${coin.symbol.replace('/', '-')}`}
      className={`relative grid grid-cols-12 items-center gap-2 py-2 px-3 rounded-lg border border-[#2b3139] border-l-4 ${getLeftBorderColor()} transition-all duration-300 ${
        isPulsing
          ? 'bg-[#2b3139]/90 shadow-[0_0_20px_rgba(0,210,255,0.2)]'
          : 'bg-[#1e2329]/90 hover:bg-[#2b3139]/60'
      }`}
    >
      {/* Coin Symbol & Icon (Cols: 4) */}
      <div className="col-span-4 flex items-center gap-2.5 min-w-0">
        <div className="relative flex-shrink-0">
          {getCoinIcon(coin.symbol, 22)}
          {isPulsing && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00d2ff] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00d2ff]"></span>
            </span>
          )}
        </div>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-[#eaecef] font-['JetBrains_Mono',monospace] tracking-tight truncate">
              {coin.symbol}
            </span>
            {coin.activePosition && (
              <span
                id={`badge-open-pos-${coin.symbol.replace('/', '-')}`}
                className="hidden xl:inline-flex items-center px-1.5 py-0.2 text-[9px] font-bold bg-[#02c076] text-[#0b0e11] rounded"
              >
                ● OPEN
              </span>
            )}
          </div>
          {coin.activePosition && (
            <span className="text-[10px] text-[#02c076] font-bold font-['JetBrains_Mono',monospace]">
              +{coin.activePosition.roe}% ROE
            </span>
          )}
        </div>
      </div>

      {/* Decision Pill (Cols: 3) */}
      <div className="col-span-3 flex justify-center">{getDecisionBadge()}</div>

      {/* Confidence % (Cols: 2) */}
      <div className="col-span-2 text-right">
        <span
          id={`confidence-${coin.symbol.replace('/', '-')}`}
          className="text-xs font-semibold font-['JetBrains_Mono',monospace] text-[#848e9c]"
        >
          %{coin.confidence}
        </span>
      </div>

      {/* AKIŞ / Flow Laser Track (Cols: 3) */}
      <div className="col-span-3 flex items-center justify-end pl-2">
        <div className="relative w-full max-w-[90px] h-4 flex items-center">
          {/* Base Track Line */}
          <div className="absolute inset-x-0 h-[2px] bg-[#2b3139] rounded-full overflow-hidden">
            <div className={`h-full w-full border-b ${akisStyle.line}`} />
          </div>

          {/* Flowing animated dots */}
          <div className="absolute inset-0 flex items-center justify-between pointer-events-none">
            <div
              className={`w-1.5 h-1.5 rounded-full ${akisStyle.dot} transition-transform`}
              style={{
                animation: `pulse 1.4s ease-in-out infinite`,
                animationDelay: `${index * 0.15}s`,
              }}
            />
            <div
              className={`w-2 h-2 rounded-full ${akisStyle.dot}`}
              style={{
                animation: `pulse 1.4s ease-in-out infinite`,
                animationDelay: `${index * 0.15 + 0.4}s`,
              }}
            />
            <div
              className={`w-1.5 h-1.5 rounded-full ${akisStyle.dot}`}
              style={{
                animation: `pulse 1.4s ease-in-out infinite`,
                animationDelay: `${index * 0.15 + 0.8}s`,
              }}
            />
          </div>

          {/* End Arrow */}
          <div className="absolute right-0 flex items-center">
            <svg
              className={`w-3.5 h-3.5 ${akisStyle.arrow}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
