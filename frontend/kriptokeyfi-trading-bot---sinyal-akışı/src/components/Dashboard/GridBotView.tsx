import React from 'react';
import { GridBotConfig } from '../../types';
import { getCoinIcon } from '../CoinIcons';
import { Grid, Play, Pause, Plus, ArrowUpRight, TrendingUp } from 'lucide-react';

export const GridBotView: React.FC = () => {
  const gridBots: GridBotConfig[] = [
    {
      id: 'grid-1',
      symbol: 'BTCUSDT',
      status: 'ACTIVE',
      lowerPrice: 60000.0,
      upperPrice: 68000.0,
      gridCount: 50,
      investment: 2000.0,
      profitPerGrid: 0.35,
      totalProfit: 184.5,
      gridType: 'ARITHMETIC',
      matchedOrders: 142,
    },
    {
      id: 'grid-2',
      symbol: 'ETHUSDT',
      status: 'ACTIVE',
      lowerPrice: 3200.0,
      upperPrice: 3800.0,
      gridCount: 40,
      investment: 1500.0,
      profitPerGrid: 0.42,
      totalProfit: 112.3,
      gridType: 'GEOMETRIC',
      matchedOrders: 89,
    },
    {
      id: 'grid-3',
      symbol: 'SOLUSDT',
      status: 'PAUSED',
      lowerPrice: 130.0,
      upperPrice: 180.0,
      gridCount: 30,
      investment: 1000.0,
      profitPerGrid: 0.65,
      totalProfit: 78.4,
      gridType: 'ARITHMETIC',
      matchedOrders: 45,
    },
  ];

  return (
    <div id="grid-bot-view" className="w-full space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#0b0e11] border border-[#02c076]/40 flex items-center justify-center text-[#02c076] shadow-[0_0_15px_rgba(2,192,118,0.25)]">
            <Grid className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef]">
                Grid Bot (Otomatik Dalga Al-Sat Stratejisi)
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30">
                YATAY PİYASA ROBOTU
              </span>
            </div>
            <p className="text-xs text-[#848e9c] mt-0.5">
              Belirlediğiniz fiyat aralıklarında otomatik limit alım-satım ızgaraları oluşturarak pasif getiri sağlar.
            </p>
          </div>
        </div>

        <button className="flex items-center gap-1.5 px-4 py-2 bg-[#02c076] hover:bg-[#02c076]/90 text-[#0b0e11] font-bold rounded-xl text-xs shadow-[0_0_15px_rgba(2,192,118,0.3)] transition-all">
          <Plus className="w-4 h-4" />
          <span>Yeni Grid Bot Kur</span>
        </button>
      </div>

      {/* Grid Bot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {gridBots.map((bot) => (
          <div
            key={bot.id}
            className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-5 shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#2b3139] mb-3">
                <div className="flex items-center gap-2 font-bold text-[#eaecef]">
                  {getCoinIcon(bot.symbol, 18)}
                  <span>{bot.symbol}</span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    bot.status === 'ACTIVE'
                      ? 'bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30'
                      : 'bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/30'
                  }`}
                >
                  {bot.status === 'ACTIVE' ? 'ÇALIŞIYOR' : 'DURDURULDU'}
                </span>
              </div>

              <div className="space-y-2 text-xs font-['JetBrains_Mono',monospace] mb-4">
                <div className="flex justify-between">
                  <span className="text-[#848e9c]">Fiyat Aralığı:</span>
                  <span className="text-[#eaecef] font-bold">
                    ${bot.lowerPrice.toLocaleString()} - ${bot.upperPrice.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#848e9c]">Grid Izgara Sayısı:</span>
                  <span className="text-[#00d2ff] font-bold">{bot.gridCount} Seviye</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#848e9c]">Yatırım Miktarı:</span>
                  <span className="text-[#eaecef] font-bold">${bot.investment.toLocaleString()} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#848e9c]">Eşleşen İşlem:</span>
                  <span className="text-[#eaecef] font-bold">{bot.matchedOrders}</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#0b0e11]/80 rounded-xl border border-[#2b3139] flex items-center justify-between font-['JetBrains_Mono',monospace]">
              <div>
                <span className="text-[10px] text-[#848e9c] block font-['Inter',sans-serif]">Grid Kârı</span>
                <span className="text-sm font-bold text-[#02c076]">+${bot.totalProfit} USDT</span>
              </div>
              <span className="text-[11px] text-[#02c076] font-bold">
                (+{((bot.totalProfit / bot.investment) * 100).toFixed(1)}%)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
