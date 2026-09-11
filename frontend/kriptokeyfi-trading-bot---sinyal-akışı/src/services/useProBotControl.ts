import { useCallback, useEffect, useRef, useState } from 'react';
import { aiTradingApi, type AutonomousBot } from '../../../src/services/aiTradingService';
import { getTradingExecutionProfile, updateTradingExecutionProfile } from '../../../src/services/tradingService';
import { getApiErrorMessage } from '../../../src/services/apiClient';

export function selectedDemoBots(accountId: string, bots: AutonomousBot[]) {
  return bots.filter((bot) => bot.exchangeAccountId === accountId && bot.mode === 'DEMO' && bot.lifecycleStatus !== 'ARCHIVED');
}

export function useProBotControl(accountId: string | null) {
  const currentAccount = useRef(accountId);
  currentAccount.current = accountId;
  const [snapshot, setSnapshot] = useState<{ accountId: string; bots: AutonomousBot[]; paused: boolean } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let active = true, reading = false;
    setLoading(true); setError('');
    if (!accountId) { setSnapshot(null); setLoading(false); return; }
    const load = async () => {
      if (reading) return;
      reading = true;
      try {
        const [bots, profile] = await Promise.all([aiTradingApi.bots(), getTradingExecutionProfile(accountId)]);
        if (active) { setSnapshot({ accountId, bots: selectedDemoBots(accountId, bots), paused: profile.entryPaused }); setError(''); }
      } catch (reason) { if (active) setError(getApiErrorMessage(reason, 'Bot durumu alınamadı.')); }
      finally { reading = false; if (active) setLoading(false); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    window.addEventListener('trading-execution-updated', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('trading-execution-updated', refresh); };
  }, [accountId, revision, refresh]);
  const current = snapshot?.accountId === accountId ? snapshot : null;
  async function toggle() {
    if (!accountId || !current || busy || loading || error || !current.bots.length) return;
    if (!window.confirm(`Seçili hesabın otomatik işlemleri ${current.paused ? 'açılsın' : 'durdurulsun'} mı? Bu hesap kontrolü PAPER ve DEMO otomatik botlarını etkiler. Durdurma otomatik pozisyon yönetimini de duraklatır; açık pozisyonları kapatmaz. Başlatma, durmuş botları tek tek başlatmaz ve hemen emir göndermez.`)) return;
    setBusy(true); setError('');
    try { await updateTradingExecutionProfile(accountId, { entryPaused: !current.paused }); refresh(); }
    catch (reason) { if (currentAccount.current === accountId) setError(getApiErrorMessage(reason, 'Otomatik işlem kontrolü kaydedilemedi.')); }
    finally { setBusy(false); }
  }
  return { bots: current?.bots ?? [], paused: current?.paused ?? null, loading: loading || (Boolean(accountId) && !current && !error), busy, error, refresh, toggle };
}
