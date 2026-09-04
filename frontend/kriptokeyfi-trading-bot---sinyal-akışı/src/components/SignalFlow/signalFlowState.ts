import { type CoinNodeState, type SignalEvent } from '../../types';
import { type TradeProDecision } from '../../services/backendDashboard';

export const MAX_SIGNAL_NODES = 10;

export function applyDecisionBatch(current: CoinNodeState[], decisions: TradeProDecision[], pulseBase = Date.now()) {
  const next = current.map((coin) => ({ ...coin }));
  decisions.forEach((decision, decisionIndex) => {
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
