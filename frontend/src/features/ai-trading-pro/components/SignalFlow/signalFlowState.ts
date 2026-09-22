import { type CoinNodeState, type SignalEvent } from '../../types';
import { type TradeProDecision } from '../../services/backendDashboard';

export const MAX_SIGNAL_NODES = 20;
export const VISIBLE_SIGNAL_NODES = 9;

export function buildUniversePool(symbols: string[], decisions: TradeProDecision[]) {
  const observed = applyDecisionBatch([], decisions);
  return [...new Set(symbols.map(formatPair))].slice(0, MAX_SIGNAL_NODES).map(symbol =>
    observed.find(row => row.symbol === symbol) ?? {
      symbol, name: symbol.split('/')[0]!, decision: 'HOLD' as const, awaitingDecision: true,
      confidence: 0, price: 0, change24h: 0, lastUpdated: 0, pulseTrigger: 0, signalStrength: 0,
    });
}

export function latestPerSymbol<T extends { symbol: string; occurredAt: string }>(rows: T[]): T[] {
  const latest = new Map<string, T>();
  for (const row of rows) {
    const symbol = formatPair(row.symbol);
    const previous = latest.get(symbol);
    if (!previous || new Date(row.occurredAt).getTime() > new Date(previous.occurredAt).getTime()) latest.set(symbol, row);
  }
  return [...latest.values()].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
}

// Rotation is presentation only; retain the actual decision and its timestamp.
export function rotateSignalWindow(current: CoinNodeState[], pool: CoinNodeState[], shownAt: Map<string, number>, now: number, random = Math.random) {
  const latest = new Map(pool.map(coin => [coin.symbol, coin]));
  const visible = current.filter(coin => latest.has(coin.symbol)).map(coin => ({ ...latest.get(coin.symbol)!, pulseTrigger: coin.pulseTrigger }));
  const candidates = pool.filter(coin => !visible.some(row => row.symbol === coin.symbol));
  if (!candidates.length) return visible;
  const oldest = Math.min(...candidates.map(coin => shownAt.get(coin.symbol) ?? -Infinity));
  const preferred = candidates.filter(coin => (shownAt.get(coin.symbol) ?? -Infinity) === oldest);
  const selected = preferred[Math.floor(random() * preferred.length)]!;
  shownAt.set(selected.symbol, now);
  return [...visible.slice(-(VISIBLE_SIGNAL_NODES - 1)), { ...selected, pulseTrigger: now }];
}

export function applyDecisionBatch(current: CoinNodeState[], decisions: TradeProDecision[], pulseBase = Date.now()) {
  const next = current.map((coin) => ({ ...coin }));
  latestPerSymbol(decisions).reverse().forEach((decision, decisionIndex) => {
    const event = decisionToSignalEvent(decision);
    const existingIndex = next.findIndex((coin) => coin.symbol === event.symbol);
    const updated: CoinNodeState = {
      symbol: event.symbol,
      name: event.symbol.split('/')[0] ?? event.symbol,
      decision: event.decision,
      confidence: event.confidence,
      price: event.price,
      change24h: event.changePercent,
      lastUpdated: event.timeMs,
      pulseTrigger: pulseBase + decisionIndex,
      signalStrength: event.confidence,
    };

    if (existingIndex >= 0) {
      if (next[existingIndex]!.lastUpdated > updated.lastUpdated) return;
      next[existingIndex] = updated;
      return;
    }
    if (next.length >= MAX_SIGNAL_NODES) {
      const oldestIndex = next.reduce((result, coin, index, rows) => coin.lastUpdated < rows[result]!.lastUpdated ? index : result, 0);
      next.splice(oldestIndex, 1);
    }
    next.push(updated);
  });
  return next;
}

export function beamMultipliers(coins: CoinNodeState[]) {
  const newestFirst = coins
    .map((coin, index) => ({ index, lastUpdated: coin.lastUpdated }))
    .sort((left, right) => right.lastUpdated - left.lastUpdated);
  const multiplierByIndex = new Map(newestFirst.map((item, rank) => [item.index, rank === 0 ? 2 : rank <= 3 ? 1.5 : 1]));
  return coins.map((_, index) => multiplierByIndex.get(index) ?? 1);
}

export function decisionToSignalEvent(decision: TradeProDecision): SignalEvent {
  const occurredAt = new Date(decision.occurredAt);
  const rawConfidence = Number(decision.confidence);
  return {
    id: decision.id,
    timestamp: Number.isNaN(occurredAt.getTime()) ? '—' : occurredAt.toLocaleTimeString('tr-TR', { hour12: false }),
    timeMs: Number.isNaN(occurredAt.getTime()) ? Date.now() : occurredAt.getTime(),
    symbol: formatPair(decision.symbol),
    decision: decision.action,
    confidence: Math.round(rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence),
    changePercent: 0,
    price: 0,
  };
}

export function formatPair(symbol: string) {
  if (symbol.includes('/')) return symbol.toUpperCase();
  const upper = symbol.toUpperCase();
  const quote = ['USDT', 'USDC', 'BUSD', 'FDUSD', 'USD'].find((candidate) => upper.endsWith(candidate));
  return quote ? `${upper.slice(0, -quote.length)}/${quote}` : upper;
}
