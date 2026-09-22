import { useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../../services/apiClient';
import { getTradeProPositions, type TradeProPosition } from './backendDashboard';
import { subscribeTradingEvents } from '../../../services/tradingEvents';

type Snapshot = { accountId: string | null; positions: TradeProPosition[]; loading: boolean; error: string; updatedAt: string | null };
const empty = (accountId: string | null): Snapshot => ({ accountId, positions: [], loading: Boolean(accountId), error: '', updatedAt: null });

export function useTradeProPositions(accountId: string | null) {
  const [snapshot, setSnapshot] = useState<Snapshot>(() => empty(accountId));
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((current) => current + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    setSnapshot((current) => current.accountId === accountId ? { ...current, loading: Boolean(accountId) } : empty(accountId));
    if (!accountId) return;

    async function load() {
      if (busy) return;
      busy = true;
      try {
        const positions = await getTradeProPositions(accountId!, controller.signal);
        if (!controller.signal.aborted) setSnapshot({ accountId, positions, loading: false, error: '', updatedAt: new Date().toISOString() });
      } catch (reason) {
        if (!controller.signal.aborted) setSnapshot((current) => ({
          ...current, loading: false, error: getApiErrorMessage(reason, 'Borsa pozisyonları alınamadı. Yeniden deneyin.'),
        }));
      } finally { busy = false; }
    }
    void load();
    const timer = window.setInterval(() => void load(), 10_000);
    let eventTimer: number | undefined;
    const unsubscribe = subscribeTradingEvents(accountId, (event) => {
      if (controller.signal.aborted || event.exchangeAccountId !== accountId) return;
      if (!['trading.position', 'trading.account', 'trading.snapshot', 'trading.order'].includes(event.topic)) return;
      if (eventTimer !== undefined) return;
      eventTimer = window.setTimeout(() => { eventTimer = undefined; void load(); }, 500);
    }, (status) => { if (status === 'LIVE' && !controller.signal.aborted) void load(); });
    return () => { controller.abort(); unsubscribe(); window.clearInterval(timer); window.clearTimeout(eventTimer); };
  }, [accountId, revision]);

  // Switching accounts hides the previous account's positions immediately.
  return { ...(snapshot.accountId === accountId ? snapshot : empty(accountId)), refresh };
}
