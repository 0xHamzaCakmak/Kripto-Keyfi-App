import React from 'react';
import { Database, Cpu, Brain, Network, Zap, Sliders, RefreshCw } from 'lucide-react';

export const MemoryView: React.FC = () => {
  const memoryModules = [
    {
      name: 'Market Regime Embeddings (MRE)',
      size: '128 Dim Vektör',
      status: 'AKTİF',
      confidence: '94.2%',
      description: 'Piyasanın Boğa / Ayı / Yatay ve Likidite avı modlarını 15m/1h/4h periyotlarında sınıflandırır.',
      updated: '14 sn önce',
    },
    {
      name: 'OrderFlow Volatility Matrix',
      size: '64 Feature Maps',
      status: 'AKTİF',
      confidence: '88.7%',
      description: 'CVD, Funding Rate ve Open Interest anormalliklerini takip ederek sahte kırılımları eler.',
      updated: '45 sn önce',
    },
    {
      name: 'Dynamic Weight Reinforcement (DWR)',
      size: '20 Bot Model Weights',
      status: 'ÖĞRENİYOR',
      confidence: '91.0%',
      description: 'Gerçekleşen kâr/zarar sonuçlarına göre botların sermaye tahsis oranlarını adaptif günceller.',
      updated: '2 dk önce',
    },
  ];

  return (
    <div id="memory-view" className="w-full space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#0b0e11] border border-[#00d2ff]/40 flex items-center justify-center text-[#00d2ff] shadow-[0_0_15px_rgba(0,210,255,0.25)]">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef]">
                AI Bot Memory & Adaptif Öğrenme
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00d2ff]/15 text-[#00d2ff] border border-[#00d2ff]/30">
                VECTOR ENGINE
              </span>
            </div>
            <p className="text-xs text-[#848e9c] mt-0.5">
              Botların anlık karar alırken referans aldığı sinir ağı ağırlıkları, hafıza vektörleri ve piyasa rejimi durumları.
            </p>
          </div>
        </div>

        <button className="flex items-center gap-1.5 px-4 py-2 bg-[#0b0e11] hover:bg-[#2b3139] border border-[#2b3139] text-[#00d2ff] rounded-xl text-xs font-bold transition-all">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Hafızayı Yeniden Kalibre Et</span>
        </button>
      </div>

      {/* Grid of Memory Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {memoryModules.map((m, i) => (
          <div
            key={i}
            className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-5 shadow-xl flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#2b3139] mb-3">
                <h3 className="text-xs font-bold text-[#eaecef]">{m.name}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30">
                  {m.status}
                </span>
              </div>
              <p className="text-xs text-[#848e9c] mb-4">{m.description}</p>
            </div>

            <div className="p-3 bg-[#0b0e11]/80 rounded-xl border border-[#2b3139] grid grid-cols-2 gap-2 text-xs font-['JetBrains_Mono',monospace]">
              <div>
                <span className="text-[10px] text-[#848e9c] block font-['Inter',sans-serif]">Vektör Boyutu</span>
                <span className="text-[#00d2ff] font-bold">{m.size}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#848e9c] block font-['Inter',sans-serif]">Doğruluk</span>
                <span className="text-[#02c076] font-bold">{m.confidence}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Strategy Neural Weights Table */}
      <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-5 shadow-xl">
        <h3 className="text-xs font-bold text-[#eaecef] uppercase tracking-wider mb-4 pb-2 border-b border-[#2b3139]">
          Aktif Karar Motoru Katsayıları (Neural Weight Matrix)
        </h3>

        <div className="space-y-3 text-xs">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#eaecef] font-bold">Trend Takip Ağırlığı (RSI + MACD + EMA200 Cross)</span>
              <span className="font-bold text-[#00d2ff] font-['JetBrains_Mono',monospace]">%42</span>
            </div>
            <div className="h-2 bg-[#0b0e11] rounded-full overflow-hidden border border-[#2b3139]">
              <div className="h-full bg-[#00d2ff] w-[42%] rounded-full shadow-[0_0_8px_#00d2ff]" />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#eaecef] font-bold">Likidite & OrderBook Dengesizlik Skoru</span>
              <span className="font-bold text-[#02c076] font-['JetBrains_Mono',monospace]">%31</span>
            </div>
            <div className="h-2 bg-[#0b0e11] rounded-full overflow-hidden border border-[#2b3139]">
              <div className="h-full bg-[#02c076] w-[31%] rounded-full shadow-[0_0_8px_#02c076]" />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-[#eaecef] font-bold">Hacim Patlaması & Breakout Hassasiyeti</span>
              <span className="font-bold text-[#f0b90b] font-['JetBrains_Mono',monospace]">%27</span>
            </div>
            <div className="h-2 bg-[#0b0e11] rounded-full overflow-hidden border border-[#2b3139]">
              <div className="h-full bg-[#f0b90b] w-[27%] rounded-full shadow-[0_0_8px_#f0b90b]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
