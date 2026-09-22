import React from 'react';
import { Cpu } from 'lucide-react';
import { type TradeProArena, type TradeProHealth, type TradeProOperation, type TradeProPosition, type TradeProRiskProfile } from '../../services/backendDashboard';
import { performanceMetrics } from './dashboardMetrics';

type Props = { arena: TradeProArena | null; positions: TradeProPosition[]; operations: TradeProOperation[]; riskProfile: TradeProRiskProfile | null; health: TradeProHealth | null };

export const BotStatsCard: React.FC<Props> = ({ arena, positions, operations, riskProfile, health }) => {
  const totalBots = Object.values(arena?.states ?? {}).reduce((sum, value) => sum + value, 0);
  const activeBots = arena?.states.RUNNING ?? 0;
  const inactiveBots = Math.max(0, totalBots - activeBots);
  const maximumPositions = riskProfile?.effectiveMaxOpenPositions?.futuresTestnet ?? riskProfile?.maxOpenPositions ?? 0;
  const performance = performanceMetrics(operations, '30 Gün');
  const reaction = health?.metrics.strategyExecution.averagePersistenceLatencyMs;
  const load = totalBots ? Math.round(activeBots / totalBots * 100) : 0;
  return <div id="bot-stats-card" className="h-full bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-5 shadow-xl flex flex-col justify-between">
    <div><div className="flex items-center justify-between pb-3 border-b border-[#2b3139] mb-3"><h3 className="text-xs font-bold tracking-wider text-[#eaecef] uppercase">BOT İSTATİSTİKLERİ</h3><Cpu className="w-4 h-4 text-[#00d2ff]" /></div>
      <div className="space-y-2.5 text-xs"><Row label="Toplam Bot" value={String(totalBots)} /><Row label="Aktif Bot" value={String(activeBots)} tone="green" /><Row label="Durdurulan Bot" value={String(inactiveBots)} tone={inactiveBots ? 'red' : undefined} /><Row label="Maks. Eş Zamanlı Pozisyon" value={positions.length + ' / ' + (maximumPositions || '∞')} /><Row label="Sinyal Doğruluk Oranı" value={'%' + performance.winRate.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} tone="green" /><Row label="Ortalama Tepki Süresi" value={reaction === null || reaction === undefined ? '—' : Math.round(reaction) + 'ms'} tone="cyan" /></div>
    </div>
    <div className="mt-4 pt-3 border-t border-[#2b3139] flex items-center justify-between text-[10px]"><span className="text-[#848e9c]">Filo Yükü</span><div className="flex items-center gap-1.5"><div className="w-16 h-1.5 bg-[#0b0e11] border border-[#2b3139] rounded-full overflow-hidden"><div className="h-full bg-[#00d2ff] rounded-full shadow-[0_0_6px_#00d2ff]" style={{ width: load + '%' }} /></div><span className="font-bold text-[#00d2ff] font-['JetBrains_Mono',monospace]">%{load}</span></div></div>
  </div>;
};

function Row({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' | 'cyan' }) { return <div className="flex items-center justify-between gap-2"><span className="text-[#848e9c]">{label}</span><span className={'font-bold font-[JetBrains_Mono,monospace] ' + (tone === 'green' ? 'text-[#02c076]' : tone === 'red' ? 'text-[#f84960]' : tone === 'cyan' ? 'text-[#00d2ff]' : 'text-[#eaecef]')}>{value}</span></div>; }
