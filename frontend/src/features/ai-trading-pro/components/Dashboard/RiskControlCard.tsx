import React from 'react';
import { CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { type TradeProHealth, type TradeProOperation, type TradeProPosition, type TradeProRiskProfile } from '../../services/backendDashboard';
import { performanceMetrics } from './dashboardMetrics';

type Props = { positions: TradeProPosition[]; operations: TradeProOperation[]; riskProfile: TradeProRiskProfile | null; health: TradeProHealth | null };

export const RiskControlCard: React.FC<Props> = ({ positions, operations, riskProfile, health }) => {
  const exposure = positions.reduce((sum, position) => sum + Math.abs(Number(position.quantity) * Number(position.markPrice)), 0);
  const capacity = Number(riskProfile?.maxAccountOpenNotional ?? 0);
  const exposureRatio = capacity > 0 ? exposure / capacity * 100 : 0;
  const daily = performanceMetrics(operations, '24 Saat');
  const estimatedCapital = capacity > 0 ? capacity : Math.max(exposure, 1);
  const dailyLossPct = Math.abs(Math.min(0, daily.totalPnl)) / estimatedCapital * 100;
  const maxDailyLossPct = Number(riskProfile?.maxDailyLossPct ?? 0);
  const dailyLimitUsage = maxDailyLossPct > 0 ? dailyLossPct / maxDailyLossPct * 100 : 0;
  const riskScore = Math.min(100, Math.max(exposureRatio, dailyLimitUsage));
  const riskLabel = riskScore >= 75 ? 'Yüksek' : riskScore >= 40 ? 'Orta' : 'Düşük';
  const riskColor = riskScore >= 75 ? '#f84960' : riskScore >= 40 ? '#f0b90b' : '#02c076';
  const healthy = health?.status === 'HEALTHY';
  const healthLabel = health?.status === 'EMERGENCY_STOPPED' ? 'Durduruldu' : health?.status === 'DEGRADED' ? 'Uyarı' : health?.status === 'HEALTHY' ? 'İyi' : 'Bilinmiyor';
  const protectionActive = Boolean(riskProfile?.enabled && riskProfile.stopLossRequired && !riskProfile.accountKillSwitch && !riskProfile.globalKillSwitch);
  return <div id="risk-control-card" className="h-full bg-[#1e2329]/80 border border-[#2b3139] rounded-xl p-5 shadow-xl flex flex-col justify-between">
    <div><div className="flex items-center justify-between pb-3 border-b border-[#2b3139] mb-3"><h3 className="text-xs font-bold tracking-wider text-[#eaecef] uppercase">RİSK KONTROL</h3><ShieldAlert className="w-4 h-4 text-[#f0b90b]" /></div>
      <div className="space-y-3 text-xs"><Row label="Maks. Riske Edilen" value={percent(Number(riskProfile?.maxRiskPerTradePct ?? 0))} /><Row label="Günlük Maks. Kayıp" value={percent(maxDailyLossPct)} /><Row label="Mevcut Risk" value={percent(exposureRatio)} tone={riskScore >= 75 ? 'red' : 'green'} />
        <div className="flex items-center justify-between pt-1"><span className="text-[#848e9c]">Risk Skoru</span><div className="flex items-center gap-2"><Bar value={riskScore} color={riskColor} /><span className="font-bold text-xs" style={{ color: riskColor }}>{riskLabel}</span></div></div>
        <div className="flex items-center justify-between pt-1"><span className="text-[#848e9c]">Sistem Sağlığı</span><div className="flex items-center gap-2"><Bar value={healthy ? 100 : health ? 45 : 0} color={healthy ? '#02c076' : '#f0b90b'} /><span className={healthy ? 'font-bold text-[#02c076]' : 'font-bold text-[#f0b90b]'}>{healthLabel}</span></div></div>
      </div>
    </div>
    <div className="mt-4 pt-3 border-t border-[#2b3139] flex items-center justify-between text-[10px]"><span className="text-[#848e9c]">Otomatik Stop-Loss</span><div className={protectionActive ? 'flex items-center gap-1 text-[#02c076] font-semibold' : 'flex items-center gap-1 text-[#f84960] font-semibold'}>{protectionActive ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}<span>{protectionActive ? 'Devrede' : 'Devre Dışı'}</span></div></div>
  </div>;
};

function Row({ label, value, tone }: { label: string; value: string; tone?: 'green' | 'red' }) { return <div className="flex items-center justify-between"><span className="text-[#848e9c]">{label}</span><span className={'font-bold font-[JetBrains_Mono,monospace] ' + (tone === 'green' ? 'text-[#02c076]' : tone === 'red' ? 'text-[#f84960]' : 'text-[#eaecef]')}>{value}</span></div>; }
function Bar({ value, color }: { value: number; color: string }) { return <div className="w-14 h-2 bg-[#0b0e11] border border-[#2b3139] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: Math.max(0, Math.min(100, value)) + '%', backgroundColor: color, boxShadow: '0 0 8px ' + color }} /></div>; }
function percent(value: number) { return '%' + value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
