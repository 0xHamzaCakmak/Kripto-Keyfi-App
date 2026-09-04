import React from 'react';
import { Bot, Plus, Play, Pause, Settings, RefreshCw, Cpu, Layers } from 'lucide-react';
import { getCoinIcon } from '../CoinIcons';

export const MyBotsView: React.FC = () => {
  const botsList = [
    {
      name: 'AI Momentum Scalper Pro',
      symbol: 'BTCUSDT',
      status: 'ACTIVE',
      strategy: 'High Frequency Flow',
      leverage: '10x',
      pnl30d: '+486.20 USDT',
      winRate: '71.4%',
      trades: 28,
    },
    {
      name: 'ETH Volatility Breakout',
      symbol: 'ETHUSDT',
      status: 'ACTIVE',
      strategy: 'Breakout ML',
      leverage: '10x',
      pnl30d: '+312.50 USDT',
      winRate: '66.7%',
      trades: 24,
    },
    {
      name: 'SOL Ultra Trend Hunter',
      symbol: 'SOLUSDT',
      status: 'ACTIVE',
      strategy: 'Trend Continuation',
      leverage: '15x',
      pnl30d: '+640.80 USDT',
      winRate: '77.4%',
      trades: 31,
    },
    {
      name: 'Altcoin Mean Reversion G1',
      symbol: 'AVAXUSDT',
      status: 'ACTIVE',
      strategy: 'Mean Reversion',
      leverage: '12x',
      pnl30d: '+280.90 USDT',
      winRate: '72.7%',
      trades: 22,
    },
  ];

  return (
    <div id="my-bots-view" className="w-full space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#0b0e11] border border-[#f0b90b]/40 flex items-center justify-center text-[#f0b90b] shadow-[0_0_15px_rgba(240,185,11,0.25)]">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef]">
                Botlarım & Özel Strateji Yönetimi
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/30">
                4 AKTİF BOT
              </span>
            </div>
            <p className="text-xs text-[#848e9c] mt-0.5">
              Kendinize ait özelleştirilmiş bot şablonları, indikatör ağırlıkları ve kâr hedefleri.
            </p>
          </div>
        </div>

        <button className="flex items-center gap-1.5 px-4 py-2 bg-[#f0b90b] hover:bg-[#f0b90b]/90 text-[#0b0e11] font-bold rounded-xl text-xs shadow-[0_0_15px_rgba(240,185,11,0.3)] transition-all">
          <Plus className="w-4 h-4" />
          <span>Yeni Bot Oluştur</span>
        </button>
      </div>

      {/* Bot Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {botsList.map((b, idx) => (
          <div
            key={idx}
            className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-5 shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#2b3139] mb-3">
                <div className="flex items-center gap-2">
                  {getCoinIcon(b.symbol, 20)}
                  <div>
                    <h3 className="text-sm font-bold text-[#eaecef]">{b.name}</h3>
                    <span className="text-[10px] text-[#848e9c]">{b.strategy} • {b.leverage}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30">
                  {b.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 p-3 bg-[#0b0e11]/80 rounded-xl border border-[#2b3139] text-center font-['JetBrains_Mono',monospace] text-xs mb-4">
                <div>
                  <span className="text-[10px] text-[#848e9c] block font-['Inter',sans-serif]">30G PNL</span>
                  <span className="font-bold text-[#02c076]">{b.pnl30d}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#848e9c] block font-['Inter',sans-serif]">KAZANMA</span>
                  <span className="font-bold text-[#eaecef]">{b.winRate}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#848e9c] block font-['Inter',sans-serif]">İŞLEM</span>
                  <span className="font-bold text-[#00d2ff]">{b.trades}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#2b3139]">
              <div className="flex items-center gap-2">
                <button className="p-1.5 rounded-lg bg-[#0b0e11] hover:bg-[#2b3139] border border-[#2b3139] text-[#eaecef] text-xs transition-colors">
                  <Pause className="w-3.5 h-3.5" />
                </button>
                <button className="p-1.5 rounded-lg bg-[#0b0e11] hover:bg-[#2b3139] border border-[#2b3139] text-[#eaecef] text-xs transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <button className="flex items-center gap-1 text-xs font-bold text-[#00d2ff] hover:underline">
                <Settings className="w-3.5 h-3.5" />
                <span>Parametreleri Düzenle</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
