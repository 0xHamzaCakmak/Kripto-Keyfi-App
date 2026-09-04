import React from 'react';
import { TrendingUp, BarChart3, PieChart, Activity, ArrowUpRight, ArrowDownRight, Calendar } from 'lucide-react';

export const PerformanceDeepView: React.FC = () => {
  return (
    <div id="performance-deep-view" className="w-full space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#0b0e11] border border-[#02c076]/40 flex items-center justify-center text-[#02c076] shadow-[0_0_15px_rgba(2,192,118,0.25)]">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef]">
                Derin Performans ve Getiri Analitiği
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30">
                GERÇEK ZAMANLI
              </span>
            </div>
            <p className="text-xs text-[#848e9c] mt-0.5">
              Kümülatif PnL eğrisi, Sharpe oranı, aylık kâr/zarar dağılımı ve risk ayarlı getiri metrikleri.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select className="bg-[#0b0e11] border border-[#2b3139] text-[#eaecef] text-xs rounded-xl px-3 py-2 font-medium focus:outline-none focus:border-[#00d2ff]">
            <option>Son 30 Gün</option>
            <option>Son 7 Gün</option>
            <option>Tüm Zamanlar</option>
          </select>
        </div>
      </div>

      {/* 4 Big Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-['JetBrains_Mono',monospace]">
        <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-4 shadow-lg">
          <span className="text-[11px] font-bold text-[#848e9c] uppercase tracking-wider font-['Inter',sans-serif]">
            NET KÜMÜLATİF KÂR
          </span>
          <div className="my-2 text-2xl font-black text-[#02c076]">+$3,492.80</div>
          <span className="text-[11px] text-[#02c076] font-bold">+34.92% (İlk Sermaye: $10,000)</span>
        </div>

        <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-4 shadow-lg">
          <span className="text-[11px] font-bold text-[#848e9c] uppercase tracking-wider font-['Inter',sans-serif]">
            KAZANMA ORANI (WIN RATE)
          </span>
          <div className="my-2 text-2xl font-black text-[#eaecef]">68.6%</div>
          <span className="text-[11px] text-[#848e9c]">72 Başarılı / 33 Kayıp</span>
        </div>

        <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-4 shadow-lg">
          <span className="text-[11px] font-bold text-[#848e9c] uppercase tracking-wider font-['Inter',sans-serif]">
            PROFIT FACTOR (KÂR FAKTÖRÜ)
          </span>
          <div className="my-2 text-2xl font-black text-[#00d2ff]">2.31</div>
          <span className="text-[11px] text-[#848e9c]">Brüt Kâr / Brüt Zarar</span>
        </div>

        <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-4 shadow-lg">
          <span className="text-[11px] font-bold text-[#848e9c] uppercase tracking-wider font-['Inter',sans-serif]">
            MAKSİMUM DRAWDOWN
          </span>
          <div className="my-2 text-2xl font-black text-[#f84960]">-4.82%</div>
          <span className="text-[11px] text-[#848e9c]">Kurtarma Süresi: 1.2 Gün</span>
        </div>
      </div>

      {/* Simulated Cumulative Equity Curve */}
      <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#2b3139] mb-4">
          <h3 className="text-xs font-bold text-[#eaecef] uppercase tracking-wider">
            Kümülatif Bakiye Eğrisi (Equity Curve USDT)
          </h3>
          <span className="text-xs font-bold text-[#02c076] font-['JetBrains_Mono',monospace]">
            Mevcut: $13,492.80 USDT
          </span>
        </div>

        {/* SVG Equity Chart */}
        <div className="h-48 w-full">
          <svg className="w-full h-full" viewBox="0 0 800 160" preserveAspectRatio="none">
            <defs>
              <linearGradient id="equityGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#02c076" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#02c076" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* Grid horizontal lines */}
            <line x1="0" y1="40" x2="800" y2="40" stroke="#2b3139" strokeDasharray="4 4" strokeWidth="1" />
            <line x1="0" y1="80" x2="800" y2="80" stroke="#2b3139" strokeDasharray="4 4" strokeWidth="1" />
            <line x1="0" y1="120" x2="800" y2="120" stroke="#2b3139" strokeDasharray="4 4" strokeWidth="1" />

            {/* Gradient Fill */}
            <path
              d="M0,140 Q100,130 200,110 T400,90 T600,45 T800,20 L800,160 L0,160 Z"
              fill="url(#equityGrad)"
            />

            {/* Main Green Line */}
            <path
              d="M0,140 Q100,130 200,110 T400,90 T600,45 T800,20"
              fill="none"
              stroke="#02c076"
              strokeWidth="3"
            />
          </svg>
        </div>

        <div className="flex items-center justify-between text-[11px] text-[#848e9c] pt-2 border-t border-[#2b3139] font-['JetBrains_Mono',monospace]">
          <span>1 Ağu 2026 ($10,000)</span>
          <span>10 Ağu 2026</span>
          <span>20 Ağu 2026</span>
          <span className="text-[#02c076] font-bold">Bugün ($13,492.80)</span>
        </div>
      </div>
    </div>
  );
};
