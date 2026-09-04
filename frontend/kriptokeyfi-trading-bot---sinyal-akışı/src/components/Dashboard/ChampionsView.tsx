import React from 'react';
import { ChampionBot } from '../../types';
import { getCoinIcon } from '../CoinIcons';
import { Trophy, Award, TrendingUp, Zap, Star, ShieldCheck, Flame } from 'lucide-react';

export const ChampionsView: React.FC = () => {
  const champions: ChampionBot[] = [
    {
      rank: 1,
      name: 'AI Momentum G1 #004',
      strategy: 'Breakout High Volatility',
      coin: 'SOLUSDT',
      roi30d: 48.6,
      winRate: 77.4,
      profitFactor: 2.88,
      sharpeRatio: 3.14,
      maxDrawdown: 4.2,
      score: 96,
      badge: 'ELITE',
    },
    {
      rank: 2,
      name: 'AI Momentum G1 #013',
      strategy: 'Trend Continuation ML',
      coin: 'SUIUSDT',
      roi30d: 42.1,
      winRate: 76.9,
      profitFactor: 2.65,
      sharpeRatio: 2.92,
      maxDrawdown: 5.1,
      score: 93,
      badge: 'MASTER',
    },
    {
      rank: 3,
      name: 'AI Momentum G1 #001',
      strategy: 'Multi-Timeframe Flow',
      coin: 'BTCUSDT',
      roi30d: 36.4,
      winRate: 71.4,
      profitFactor: 2.45,
      sharpeRatio: 2.78,
      maxDrawdown: 3.8,
      score: 89,
      badge: 'MASTER',
    },
    {
      rank: 4,
      name: 'AI Momentum G1 #016',
      strategy: 'AI Momentum Sentiment',
      coin: 'FETUSDT',
      roi30d: 31.8,
      winRate: 70.0,
      profitFactor: 2.2,
      sharpeRatio: 2.45,
      maxDrawdown: 6.2,
      score: 85,
      badge: 'CHALLENGER',
    },
    {
      rank: 5,
      name: 'AI Momentum G1 #008',
      strategy: 'Mean Reversion Dynamic',
      coin: 'AVAXUSDT',
      roi30d: 28.5,
      winRate: 72.7,
      profitFactor: 2.1,
      sharpeRatio: 2.31,
      maxDrawdown: 4.9,
      score: 84,
      badge: 'CHALLENGER',
    },
  ];

  return (
    <div id="champions-view" className="w-full space-y-5 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#0b0e11] border border-[#f0b90b]/40 flex items-center justify-center text-[#f0b90b] shadow-[0_0_15px_rgba(240,185,11,0.25)]">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef]">
                Champions (Liderlik Tablosu)
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f0b90b]/20 text-[#f0b90b] border border-[#f0b90b]/40">
                TOP MODELLER
              </span>
            </div>
            <p className="text-xs text-[#848e9c] mt-0.5">
              En yüksek ROI, Sharpe oranı ve istikrarlı kâr faktörüne sahip 1. nesil yapay zeka bot modelleri.
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0b0e11] border border-[#2b3139] text-xs text-[#848e9c]">
          <Flame className="w-4 h-4 text-[#f0b90b]" />
          <span>Haftalık Eleme & Terfi Sistemi Aktif</span>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {champions.slice(0, 3).map((bot, idx) => (
          <div
            key={bot.rank}
            className={`bg-[#1e2329]/80 border rounded-2xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between ${
              idx === 0
                ? 'border-[#f0b90b]/60 shadow-[0_0_20px_rgba(240,185,11,0.15)]'
                : idx === 1
                ? 'border-[#00d2ff]/40 shadow-[0_0_15px_rgba(0,210,255,0.1)]'
                : 'border-[#02c076]/40 shadow-[0_0_15px_rgba(2,192,118,0.1)]'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                    idx === 0
                      ? 'bg-[#f0b90b] text-[#0b0e11]'
                      : idx === 1
                      ? 'bg-[#00d2ff] text-[#0b0e11]'
                      : 'bg-[#02c076] text-[#0b0e11]'
                  }`}
                >
                  #{bot.rank}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#eaecef]">{bot.name}</h3>
                  <span className="text-[10px] text-[#848e9c]">{bot.strategy}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-[#f0b90b]">
                {getCoinIcon(bot.coin, 16)}
                <span>{bot.coin}</span>
              </div>
            </div>

            <div className="my-4 grid grid-cols-3 gap-2 p-3 bg-[#0b0e11]/80 rounded-xl border border-[#2b3139] text-center font-['JetBrains_Mono',monospace]">
              <div>
                <span className="text-[9px] text-[#848e9c] block font-['Inter',sans-serif]">30G ROI</span>
                <span className="text-sm font-bold text-[#02c076]">+{bot.roi30d}%</span>
              </div>
              <div>
                <span className="text-[9px] text-[#848e9c] block font-['Inter',sans-serif]">KAZANMA</span>
                <span className="text-sm font-bold text-[#eaecef]">{bot.winRate}%</span>
              </div>
              <div>
                <span className="text-[9px] text-[#848e9c] block font-['Inter',sans-serif]">SHARPE</span>
                <span className="text-sm font-bold text-[#00d2ff]">{bot.sharpeRatio}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-[#2b3139]">
              <span className="text-[#848e9c]">Max DD: %{bot.maxDrawdown}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#0b0e11] text-[#f0b90b] border border-[#f0b90b]/30">
                SCORE: {bot.score}/100
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Full Leaderboard Table */}
      <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-[#2b3139] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#eaecef] uppercase tracking-wider">
            Tüm Modellerin Performans Skalası
          </h3>
          <span className="text-xs text-[#848e9c]">Son 30 günlük backtest ve forward live testnet verileri</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-['JetBrains_Mono',monospace]">
            <thead>
              <tr className="bg-[#0b0e11] text-[11px] font-bold text-[#848e9c] uppercase tracking-wider border-b border-[#2b3139]">
                <th className="py-3 px-4">SIRA</th>
                <th className="py-3 px-4 font-['Inter',sans-serif]">BOT VE STRATEJİ</th>
                <th className="py-3 px-4">PARİTE</th>
                <th className="py-3 px-4 text-right">30G ROI</th>
                <th className="py-3 px-4 text-right">KAZANMA %</th>
                <th className="py-3 px-4 text-right">PROFIT FACTOR</th>
                <th className="py-3 px-4 text-right">SHARPE</th>
                <th className="py-3 px-4 text-right">MAX DD</th>
                <th className="py-3 px-4 text-center">SKOR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b3139]">
              {champions.map((b) => (
                <tr key={b.rank} className="hover:bg-[#2b3139]/40 transition-colors">
                  <td className="py-3 px-4 font-bold text-[#f0b90b]">#{b.rank}</td>
                  <td className="py-3 px-4 font-['Inter',sans-serif]">
                    <div className="font-bold text-[#eaecef]">{b.name}</div>
                    <div className="text-[10px] text-[#848e9c]">{b.strategy}</div>
                  </td>
                  <td className="py-3 px-4 font-bold text-[#f0b90b]">
                    <div className="flex items-center gap-1.5">
                      {getCoinIcon(b.coin, 14)}
                      <span>{b.coin}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-[#02c076]">+{b.roi30d}%</td>
                  <td className="py-3 px-4 text-right font-bold text-[#eaecef]">{b.winRate}%</td>
                  <td className="py-3 px-4 text-right font-bold text-[#eaecef]">{b.profitFactor}</td>
                  <td className="py-3 px-4 text-right font-bold text-[#00d2ff]">{b.sharpeRatio}</td>
                  <td className="py-3 px-4 text-right text-[#f84960] font-bold">-%{b.maxDrawdown}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded text-[11px] font-black bg-[#0b0e11] text-[#f0b90b] border border-[#f0b90b]/30">
                      {b.score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
