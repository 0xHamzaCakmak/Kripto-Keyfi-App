import { useEffect, useState } from 'react';
import { aiTradingApi, type TestnetAccountSummary } from '../../../../src/services/aiTradingService';
import { getApiErrorMessage } from '../../../../src/services/apiClient';

export function DemoAccountSummary({ accountId }: { accountId: string }) {
  const [summary, setSummary] = useState<TestnetAccountSummary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let busy = false;
    const load = async () => {
      if (busy) return;
      busy = true;
      try {
        const response = await aiTradingApi.testnetAccountSummary(accountId);
        if (active) { setSummary(response.data.accountId === accountId ? response.data : null); setError(''); }
      } catch (reason) { if (active) { setSummary(null); setError(getApiErrorMessage(reason, 'Demo hesap özeti alınamadı.')); } }
      finally { busy = false; }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [accountId]);
  if (error) return <p role="alert" className="text-xs text-[#f84960]">{error}</p>;
  if (!summary) return null;
  const metrics = [['Futures bakiye', summary.totalBalance], ['Kullanılabilir', summary.availableBalance], ['İşlemdeki teminat', summary.activeMargin], ['Açık PnL', summary.unrealizedPnl], ['Toplam değer', summary.equity]];
  return <section className="grid gap-3 rounded-xl border border-[#2b3139] bg-[#1e2329] p-4 sm:grid-cols-5">{metrics.map(([label, value]) => <div key={label}><p className="text-xs text-[#848e9c]">{label}</p><p className="mt-1 text-sm font-bold text-[#eaecef]">{Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} USD</p></div>)}</section>;
}
