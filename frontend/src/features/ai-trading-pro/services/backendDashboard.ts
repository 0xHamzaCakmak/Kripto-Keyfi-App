import { api } from '../../../services/apiClient';

export type ManualTradingSymbol = {
  symbol: string; baseAsset: string; quoteAsset: string; tickSize: string; stepSize: string;
  minQuantity: string; maxQuantity: string; minNotional: string; maxLeverage: number;
};

export type ManualOrderPreview = {
  id: string; symbol: string; side: 'BUY' | 'SELL'; type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'STOP_LIMIT';
  quantity: string; price?: string; stopPrice?: string; leverage: number; marginMode: 'ISOLATED' | 'CROSS';
  markPrice: string; estimatedNotional: string; estimatedInitialMargin: string; expiresAt: string; warnings: string[];
};

export async function getManualTradingSymbols(exchangeAccountId: string) {
  return (await api.get<{ data: ManualTradingSymbol[] }>('/admin/trading/symbols', { params: { exchangeAccountId } })).data.data;
}

export async function getManualSymbolPrice(exchangeAccountId: string, symbol: string) {
  return (await api.get<{ data: { symbol: string; markPrice: string; fetchedAt: string } }>('/admin/trading/symbols/price', {
    params: { exchangeAccountId, symbol },
  })).data.data;
}

export async function previewManualOrder(input: {
  exchangeAccountId: string; symbol: string; side: 'BUY' | 'SELL'; type: 'MARKET' | 'LIMIT' | 'STOP_MARKET';
  quantity: string; price?: string; stopPrice?: string; leverage: number; marginMode: 'ISOLATED'; reduceOnly: false;
}) {
  return (await api.post<{ data: ManualOrderPreview }>('/admin/trading/orders/preview', input)).data.data;
}

export async function confirmManualOrder(previewId: string) {
  return (await api.post('/admin/trading/orders', { previewId, idempotencyKey: crypto.randomUUID() })).data.data;
}

export type TradeProMode = 'DEMO' | 'LIVE';

export type TradeProExchangeAccount = {
  id: string;
  name: string;
  provider: 'BINANCE' | 'BYBIT';
  environment: 'TESTNET' | 'DEMO' | 'LIVE';
  accountType: 'USDT_M' | 'UNIFIED' | 'SPOT';
  isActive: boolean;
  connectionStatus: 'CONNECTED' | 'DEGRADED' | 'ERROR' | 'DISABLED';
};

export type TradeProBalance = {
  walletType: 'SPOT' | 'USD_M_FUTURES' | 'UNIFIED';
  asset: string;
  walletBalance: string;
  availableBalance: string;
  lockedBalance?: string;
  unrealizedPnl: string;
  marginAvailable?: boolean;
  priceUsdt?: string;
  valueUsdt?: string;
};

export type TradeProDecision = {
  id: string;
  botId: string;
  botName: string;
  symbol: string;
  action: 'LONG' | 'SHORT' | 'HOLD';
  confidence: number;
  summary: string;
  occurredAt: string;
};

export type TradeProArena = {
  evolutionEnabled?: boolean;
  analysisFresh?: boolean;
  states: Record<string, number>;
  modes: Record<string, number>;
  decisionsLast5m: number;
  throughputPerMinute: number;
  latestDecisionAt: string | null;
  oldestRunningAt: string | null;
  refreshedAt: string;
  botSymbols: string[];
  recentDecisions: TradeProDecision[];
  recentSignals?: (TradeProDecision & { source: string; status: string })[];
};

// Only call with snapshots from the same exchange account. An omitted row is
// not a new HOLD decision: preserve its last actual direction and timestamp.
export function retainLastArenaDecisions(previous: TradeProArena | null, next: TradeProArena): TradeProArena {
  const normalize = (symbol: string) => symbol.replace('/', '').toUpperCase();
  const allowed = new Set(next.botSymbols.map(normalize));
  function merge<T extends TradeProDecision>(older: T[], newer: T[]): T[] {
    const rows = new Map<string, T>();
    for (const row of [...older, ...newer]) {
      const symbol = normalize(row.symbol);
      if (!allowed.has(symbol)) continue;
      const current = rows.get(symbol);
      if (!current || new Date(row.occurredAt).getTime() >= new Date(current.occurredAt).getTime()) rows.set(symbol, row);
    }
    return [...rows.values()].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }
  return { ...next,
    recentDecisions: merge(previous?.recentDecisions ?? [], next.recentDecisions),
    recentSignals: merge(previous?.recentSignals ?? [], next.recentSignals ?? []),
  };
}

export type TradeProPosition = {
  positionKey: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: string;
  entryPrice: string;
  markPrice: string;
  liquidationPrice?: string;
  unrealizedPnl: string;
  leverage: string;
  marginMode: 'ISOLATED' | 'CROSS';
};

export type TradeProFill = {
  tradeId: string;
  symbol: string;
  realizedPnl: string;
  commission: string;
  commissionAsset: string;
  netRealizedPnl: number;
  occurredAt: string;
  reduceOnly: boolean;
};

export type TradeProOperation = {
  botId: string;
  symbol: string;
  state: string;
  position: (TradeProPosition & { notional: string; margin: string; roi: number }) | null;
  stopLoss: string | null;
  takeProfit: string | null;
  wins: number;
  losses: number;
  fills?: TradeProFill[];
};

export type TradeProRiskProfile = {
  enabled: boolean;
  accountKillSwitch: boolean;
  globalKillSwitch: boolean;
  maxRiskPerTradePct: string;
  maxDailyLossPct: string;
  maxDrawdownPct: string;
  maxAccountOpenNotional: string;
  maxOpenPositions: number;
  stopLossRequired: boolean;
  effectiveMaxOpenPositions?: { paper: number; futuresTestnet: number; live: number };
};

export type TradeProHealth = {
  status: 'HEALTHY' | 'DEGRADED' | 'EMERGENCY_STOPPED';
  checkedAt: string;
  metrics: {
    strategyExecution: { averagePersistenceLatencyMs: number | null };
    riskRejectsLast24h: number;
    exchangeErrorsLast24h: number;
    pnlCalculationErrors: number;
    emergencyStop: boolean;
  };
};

export type TradeProDashboardDetails = {
  operations: TradeProOperation[];
  riskProfile: TradeProRiskProfile | null;
  health: TradeProHealth | null;
};

type AutonomousEnvelope<T> = {
  apiVersion: 'v1';
  kind: string;
  data: T;
  liveTradingEnabled: false;
};

export async function getTradeProAccounts() {
  return (await api.get<{ data: TradeProExchangeAccount[] }>('/admin/trading/exchange-accounts')).data.data;
}

export async function getTradeProBalances(exchangeAccountId: string) {
  return (await api.get<{ data: TradeProBalance[] }>(
    `/admin/trading/exchange-accounts/${encodeURIComponent(exchangeAccountId)}/balances`,
  )).data.data;
}

export async function getTradeProArena(exchangeAccountId: string) {
  const envelope = (await api.get<{ data: AutonomousEnvelope<TradeProArena> }>(
    '/admin/trading/autonomous/arena-status',
    { params: { exchangeAccountId } },
  )).data.data;
  if (envelope.apiVersion !== 'v1') throw new Error('AI Trade Pro veri sözleşmesi doğrulanamadı.');
  return envelope.data;
}

export async function getTradeProDashboardDetails(exchangeAccountId: string): Promise<TradeProDashboardDetails> {
  const [operations, riskProfile, health] = await Promise.allSettled([
    getTradeProOperations(exchangeAccountId),
    api.get<{ data: TradeProRiskProfile }>(`/admin/trading/exchange-accounts/${encodeURIComponent(exchangeAccountId)}/risk-profile`),
    api.get<{ data: TradeProHealth }>('/admin/trading/system-health'),
  ]);
  return {
    operations: operations.status === 'fulfilled' ? operations.value : [],
    riskProfile: riskProfile.status === 'fulfilled' ? riskProfile.value.data.data : null,
    health: health.status === 'fulfilled' ? health.value.data.data : null,
  };
}

// Exchange positions are authoritative, including orders placed outside this app.
// Do not join/filter them against bot operations or turn read failures into [].
export async function getTradeProPositions(exchangeAccountId: string, signal?: AbortSignal) {
  return (await api.get<{ data: TradeProPosition[] }>('/admin/trading/positions', {
    params: { exchangeAccountId }, signal,
  })).data.data;
}

export async function getTradeProOperations(exchangeAccountId: string) {
  const [bots, operations] = await Promise.all([
    api.get<{ data: Array<{ id: string; exchangeAccountId: string; mode: string }> }>('/admin/trading/bot-factory/bots'),
    api.get<{ data: AutonomousEnvelope<TradeProOperation[]> }>('/admin/trading/autonomous/testnet-operations', { params: { exchangeAccountId } }),
  ]);
  const botIds = new Set(bots.data.data.filter((bot) => bot.exchangeAccountId === exchangeAccountId && bot.mode === 'DEMO').map((bot) => bot.id));
  return operations.data.data.data.filter((operation) => botIds.has(operation.botId));
}

export async function closeTradeProPosition(exchangeAccountId: string, position: TradeProPosition) {
  return api.post(
    `/admin/trading/positions/${encodeURIComponent(position.positionKey)}/close`,
    {
      exchangeAccountId,
      quantity: position.quantity,
      type: 'MARKET',
      idempotencyKey: crypto.randomUUID(),
    },
  );
}

export function isDemoAccount(account: TradeProExchangeAccount) {
  return account.environment !== 'LIVE';
}

export function tradeProTotalBalance(balances: TradeProBalance[]) {
  return balances.reduce((total, balance) => {
    const explicitValue = Number(balance.valueUsdt);
    const walletBalance = Number(balance.walletBalance);
    const priceUsdt = Number(balance.priceUsdt ?? 1);
    const value = Number.isFinite(explicitValue) && explicitValue !== 0
      ? explicitValue
      : (Number.isFinite(walletBalance) && Number.isFinite(priceUsdt) ? walletBalance * priceUsdt : 0);
    return total + Math.max(value, 0);
  }, 0);
}
