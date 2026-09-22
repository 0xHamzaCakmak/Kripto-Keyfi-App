import { useEffect, useMemo, useState } from 'react';
import type { SignalEvent } from '../../types';

export type FeedRow = { symbol: string; event: SignalEvent | null };
const key = (symbol: string) => symbol.replace('/', '').toUpperCase();
export function buildFeedRows(symbols: string[], events: SignalEvent[]): FeedRow[] {
  const latest = new Map<string, SignalEvent>();
  for (const event of events) {
    const symbol = key(event.symbol);
    if (!latest.has(symbol) || latest.get(symbol)!.timeMs < event.timeMs) latest.set(symbol, event);
  }
  return [...new Set((symbols.length ? symbols : events.map(event => event.symbol)).map(key))]
    .map(symbol => ({ symbol, event: latest.get(symbol) ?? null }));
}

// A shuffled queue visits every pair before repeating, replacing only one row.
export function advanceFeedWindow(order: string[]) {
  return order.length > 10 ? [...order.slice(1), order[0]!] : order;
}

export function useFeedWindow(symbols: string[], events: SignalEvent[], paused = false) {
  const pool = useMemo(() => buildFeedRows(symbols, events), [symbols, events]);
  const identity = pool.map(row => row.symbol).join('|');
  const [order, setOrder] = useState(() => pool.map(row => row.symbol));
  const [snapshot, setSnapshot] = useState(pool);
  useEffect(() => {
    const names = identity ? identity.split('|') : [];
    for (let i = names.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [names[i], names[j]] = [names[j]!, names[i]!];
    }
    setOrder(names);
  }, [identity]);
  useEffect(() => { if (!paused || !pool.length) setSnapshot(pool); }, [pool, paused]);
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setOrder(advanceFeedWindow), 1000);
    return () => window.clearInterval(timer);
  }, [paused]);
  const rows = paused ? snapshot : pool;
  const bySymbol = new Map(rows.map(row => [row.symbol, row]));
  const current = order.filter(symbol => bySymbol.has(symbol));
  const complete = [...current, ...rows.map(row => row.symbol).filter(symbol => !current.includes(symbol))];
  return complete.slice(0, 10).map(symbol => bySymbol.get(symbol)!);
}
