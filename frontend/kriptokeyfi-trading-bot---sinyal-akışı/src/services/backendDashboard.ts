import { api } from '../../../src/services/apiClient';

export type TradeProMode = 'DEMO' | 'LIVE';

export type TradeProExchangeAccount = {
  id: string;
  name: string;
  provider: 'BINANCE' | 'BYBIT';
  environment: 'TESTNET' | 'DEMO' | 'LIVE';
  accountType: 'USDT_M' | 'UNIFIED';
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
  states: Record<string, number>;
  modes: Record<string, number>;
  decisionsLast5m: number;
  throughputPerMinute: number;
  latestDecisionAt: string | null;
  oldestRunningAt: string | null;
  refreshedAt: string;
  botSymbols: string[];
  recentDecisions: TradeProDecision[];
};

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
  positions: TradeProPosition[];
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
  const [positions, operations, riskProfile, health] = await Promise.allSettled([
    api.get<{ data: TradeProPosition[] }>('/admin/trading/positions', { params: { exchangeAccountId } }),
    api.get<{ data: AutonomousEnvelope<TradeProOperation[]> }>('/admin/trading/autonomous/testnet-operations'),
    api.get<{ data: TradeProRiskProfile }>(`/admin/trading/exchange-accounts/${encodeURIComponent(exchangeAccountId)}/risk-profile`),
    api.get<{ data: TradeProHealth }>('/admin/trading/system-health'),
  ]);
  return {
    positions: positions.status === 'fulfilled' ? positions.value.data.data : [],
    operations: operations.status === 'fulfilled' ? operations.value.data.data.data : [],
    riskProfile: riskProfile.status === 'fulfilled' ? riskProfile.value.data.data : null,
    health: health.status === 'fulfilled' ? health.value.data.data : null,
  };
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
