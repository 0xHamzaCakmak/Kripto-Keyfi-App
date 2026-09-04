import React from 'react';
import { Cpu, Server, Activity, Terminal, Shield, CheckCircle2, HardDrive } from 'lucide-react';

export const SystemFullView: React.FC = () => {
  const logs = [
    { time: '12:54:12', level: 'INFO', msg: '[VectorEngine] 128-dim market embeddings re-calibrated successfully.' },
    { time: '12:53:45', level: 'SIGNAL', msg: '[AI Momentum #004] SOLUSDT LONG 15x signal confirmed at $154.20.' },
    { time: '12:50:00', level: 'RISK', msg: '[CircuitBreaker] Global drawdown check passed: 1.23% / 10.00% limit.' },
    { time: '12:45:10', level: 'INFO', msg: '[Binance Testnet WS] Orderbook depth stream latency 42ms (Optimal).' },
    { time: '12:40:02', level: 'TRADE', msg: '[AI Momentum #001] BTCUSDT position entry price updated to $63,840.50.' },
  ];

  return (
    <div id="system-full-view" className="w-full space-y-5 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-[#1e2329]/90 border border-[#2b3139] rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-[#0b0e11] border border-[#00d2ff]/40 flex items-center justify-center text-[#00d2ff] shadow-[0_0_15px_rgba(0,210,255,0.25)]">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#eaecef]">
                Sistem Sağlığı & Canlı Sunucu Logları
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#02c076]/15 text-[#02c076] border border-[#02c076]/30">
                100% OPERASYONEL
              </span>
            </div>
            <p className="text-xs text-[#848e9c] mt-0.5">
              WebSocket bağlantıları, mikrosaniye işlem gecikmeleri ve Python karar motoru log akışı.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-['JetBrains_Mono',monospace]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#02c076] animate-pulse" />
          <span className="text-[#02c076] font-bold">Uptime: 99.98% (42 Gün)</span>
        </div>
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-['JetBrains_Mono',monospace]">
        <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-4 flex justify-between items-center">
          <div>
            <span className="text-[10px] text-[#848e9c] block font-['Inter',sans-serif]">CPU / RAM YÜKÜ</span>
            <span className="text-xl font-bold text-[#00d2ff]">24.8% / 1.4 GB</span>
          </div>
          <Cpu className="w-6 h-6 text-[#00d2ff]" />
        </div>

        <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-4 flex justify-between items-center">
          <div>
            <span className="text-[10px] text-[#848e9c] block font-['Inter',sans-serif]">WS GECİKME (LATENCY)</span>
            <span className="text-xl font-bold text-[#02c076]">42 ms</span>
          </div>
          <Activity className="w-6 h-6 text-[#02c076]" />
        </div>

        <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-4 flex justify-between items-center">
          <div>
            <span className="text-[10px] text-[#848e9c] block font-['Inter',sans-serif]">VERİTABANI IOPS</span>
            <span className="text-xl font-bold text-[#eaecef]">1,280 req/s</span>
          </div>
          <HardDrive className="w-6 h-6 text-[#f0b90b]" />
        </div>
      </div>

      {/* Live Log Stream Terminal */}
      <div className="bg-[#1e2329]/80 border border-[#2b3139] rounded-2xl p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-[#2b3139] mb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#00d2ff]" />
            <h3 className="text-xs font-bold text-[#eaecef] uppercase tracking-wider">
              Canlı Sistem ve Karar Motoru Logları
            </h3>
          </div>
          <span className="text-[10px] text-[#848e9c] font-['JetBrains_Mono',monospace]">
            Otomatik Kaydırma: Açık
          </span>
        </div>

        <div className="bg-[#0b0e11] p-4 rounded-xl border border-[#2b3139] font-['JetBrains_Mono',monospace] text-[11px] space-y-2 max-h-72 overflow-y-auto">
          {logs.map((l, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-[#848e9c] shrink-0">{l.time}</span>
              <span
                className={`font-bold px-1.5 py-0.2 rounded text-[9px] shrink-0 ${
                  l.level === 'SIGNAL'
                    ? 'bg-[#00d2ff]/20 text-[#00d2ff]'
                    : l.level === 'TRADE'
                    ? 'bg-[#02c076]/20 text-[#02c076]'
                    : l.level === 'RISK'
                    ? 'bg-[#f0b90b]/20 text-[#f0b90b]'
                    : 'bg-[#848e9c]/20 text-[#848e9c]'
                }`}
              >
                {l.level}
              </span>
              <span className="text-[#eaecef]">{l.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
