import React from 'react';
import { DollarSign, TrendingUp, Calendar, ArrowUpRight, ArrowDownRight, PieChart } from 'lucide-react';

export const PnLAnalyticsView: React.FC = () => {
  const days = [
    { day: 'Pzt (25 Ağu)', pnl: '+142.50', win: true },
    { day: 'Sal (26 Ağu)', pnl: '+89.20', win: true },
    { day: 'Çar (27 Ağu)', pnl: '-34.10', win: false },
    { day: 'Per (28 Ağu)', pnl: '+210.40', win: true },
    { day: 'Cum (29 Ağu)', pnl: '+95.80', win: true },
    { day: 'Cmt (30 Ağu)', pnl: '+256.34', win: true },
  ];

  return (
    <div id="pnl-analytics-view" className="w-full space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#0b0e11] border border-[#02c076]/40 flex items-center justify-center text-[#02c076] shadow-[0_0_15px_rgba(2,192,118,0.25)]">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef]">
                Kâr / Zarar & Finansal Günlük Raporu
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30">
                GÜNLÜK PNL TAKVİMİ
              </span>
            </div>
            <p className="text-xs text-[#848e9c] mt-0.5">
              Günlük, haftalık ve aylık kâr/zarar performans dökümü ve komisyon giderleri analizi.
            </p>
          </div>
        </div>

        <div className="text-right font-['JetBrains_Mono',monospace]">
          <span className="text-[10px] text-[#848e9c] block font-['Inter',sans-serif]">BU AYKİ TOPLAM KÂR</span>
          <span className="text-base font-black text-[#02c076]">+$1,482.60 USDT</span>
        </div>
      </div>

      {/* Daily PnL Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {days.map((d, i) => (
          <div
            key={i}
            className="bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-3.5 flex flex-col justify-between shadow-lg font-['JetBrains_Mono',monospace]"
          >
            <span className="text-[10px] text-[#848e9c] font-['Inter',sans-serif] block">{d.day}</span>
            <div
              className={`text-sm sm:text-base font-black my-2 ${
                d.win ? 'text-[#02c076]' : 'text-[#f84960]'
              }`}
            >
              {d.pnl} USDT
            </div>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.2 rounded w-fit ${
                d.win ? 'bg-[#02c076]/15 text-[#02c076]' : 'bg-[#f84960]/15 text-[#f84960]'
              }`}
            >
              {d.win ? 'KÂRLI GÜN' : 'ZARARLI GÜN'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
