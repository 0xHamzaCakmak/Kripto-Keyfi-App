import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { type TradeProOperation } from '../../services/backendDashboard';
import { performanceMetrics, type PerformancePeriod } from './dashboardMetrics';

export const PerformanceCard: React.FC<{ operations: TradeProOperation[] }> = ({ operations }) => {
  const [period, setPeriod] = useState<PerformancePeriod>('24 Saat');
  const metrics = useMemo(() => performanceMetrics(operations, period), [operations, period]);
  return <div id="performance-card" className="h-full bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-5 shadow-xl flex flex-col justify-between">
    <div><div className="flex items-center justify-between pb-3 border-b border-[#2b3139] mb-3"><h3 className="text-xs font-bold tracking-wider text-[#eaecef] uppercase">PERFORMANS</h3><div className="relative"><select value={period} onChange={(event) => setPeriod(event.target.value as PerformancePeriod)} className="bg-[#0b0e11] border border-[#2b3139] text-[#eaecef] text-xs rounded-lg px-2.5 py-1 pr-6 appearance-none focus:outline-none focus:border-[#00d2ff] cursor-pointer font-medium"><option>24 Saat</option><option>7 Gün</option><option>30 Gün</option></select><ChevronDown className="w-3.5 h-3.5 text-[#848e9c] absolute right-1.5 top-2 pointer-events-none" /></div></div>
      <div className="grid grid-cols-3 gap-2.5 mb-4"><Metric label="TOPLAM PNL" value={money(metrics.totalPnl)} tone={metrics.totalPnl >= 0 ? 'green' : 'red'} detail={metrics.totalTrades + ' kapanan işlem'} /><Metric label="TOPLAM KAZANILAN" value={money(metrics.totalWon)} tone="green" detail={metrics.wins + ' kazanan'} /><Metric label="TOPLAM KAYBEDİLEN" value={money(metrics.totalLost)} tone="red" detail={metrics.losses + ' kaybeden'} /></div>
    </div>
    <div className="pt-3 border-t border-[#2b3139] grid grid-cols-4 gap-1 text-center font-['JetBrains_Mono',monospace] text-xs"><Summary label="TOPLAM İŞLEM" value={String(metrics.totalTrades)} /><Summary label="ORT. KAR" value={money(metrics.averageWin, false)} tone="green" /><Summary label="ORT. ZARAR" value={money(metrics.averageLoss, false)} tone="red" /><Summary label="KAR/ZARAR ORANI" value={metrics.profitFactor === null ? '∞' : metrics.profitFactor.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} /></div>
  </div>;
};

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'green' | 'red' }) { const color = tone === 'green' ? 'text-[#02c076]' : 'text-[#f84960]'; return <div className="p-2.5 rounded-lg bg-[#0b0e11]/80 border border-[#2b3139]"><span className="text-[10px] text-[#848e9c] block mb-1">{label}</span><div className={'text-sm font-bold font-[JetBrains_Mono,monospace] ' + color}>{value} <span className="text-[9px] text-[#eaecef]">USDT</span></div><span className={'text-[10px] font-semibold ' + color}>{detail}</span><div className="mt-2 h-6"><svg className="w-full h-full" viewBox="0 0 100 25" preserveAspectRatio="none"><path d={tone === 'green' ? 'M0,20 Q20,18 35,12 T70,8 T100,2' : 'M0,5 Q30,8 55,14 T85,20 T100,22'} fill="none" stroke={tone === 'green' ? '#02c076' : '#f84960'} strokeWidth="2" /></svg></div></div>; }
function Summary({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) { return <div><span className="text-[9px] text-[#848e9c] block">{label}</span><span className={'font-bold ' + (tone === 'green' ? 'text-[#02c076]' : tone === 'red' ? 'text-[#f84960]' : 'text-[#eaecef]')}>{value}</span></div>; }
function money(value: number, sign = true) { return (sign && value > 0 ? '+' : '') + value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
