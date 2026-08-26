import { api } from './apiClient';

export type TradingAccount = {
  id: string; name: string; provider: 'BINANCE' | 'BYBIT'; environment: 'TESTNET' | 'DEMO';
  accountType: 'USDT_M' | 'UNIFIED';
  isActive: boolean; canTrade: boolean; connectionStatus: 'CONNECTED' | 'DEGRADED' | 'ERROR' | 'DISABLED';
  executionEngine: 'TYPESCRIPT' | 'GO';
};
export type TradingSymbol = {
  symbol: string; baseAsset: string; quoteAsset: string; tickSize: string; stepSize: string;
  minQuantity: string; maxQuantity: string; minNotional: string; maxLeverage: number;
};
export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'STOP_LIMIT';
export type MarginMode = 'ISOLATED' | 'CROSS';
export type OrderPreview = {
  id: string; exchangeAccountId: string; accountName: string; provider: 'BINANCE' | 'BYBIT'; symbol: string;
  side: OrderSide; type: OrderType; quantity: string; price?: string; stopPrice?: string; leverage: number;
  marginMode: MarginMode; reduceOnly: boolean; markPrice: string; estimatedNotional: string;
  estimatedInitialMargin: string; expiresAt: string; warnings: string[];
};
export type OpenOrder = {
  exchangeOrderId: string; clientOrderId: string; symbol: string; side: OrderSide; type: OrderType; status: string;
  quantity: string; executedQuantity: string; price?: string; stopPrice?: string; reduceOnly: boolean; createdAt?: string;
  localOrderId?: string; pending?: boolean;
};
export type OpenPosition = {
  positionKey: string; symbol: string; side: 'LONG' | 'SHORT'; quantity: string; entryPrice: string; markPrice: string;
  liquidationPrice?: string; unrealizedPnl: string; leverage: string; marginMode: MarginMode;
  lifecycleStatus?: 'CLOSING' | 'CLOSE_FAILED';
};
export type ManualMentorPosition = OpenPosition & {
  manualEntryId: string;
  mentorPublished: boolean;
  mentorEligible: boolean;
};
export type TradingExecutionProfile = {
  minLeverage: number; maxLeverage: number; botAllocationUsdt: string; minInitialMarginUsdt: string;
  maxOrderNotional: string; maxInitialMargin: string; maxAccountOpenNotional: string;
  stopLossBps: number; takeProfitBps: number; maxOrdersPerMinute: number; entryPaused: boolean;
};

function normalizeTradingExecutionProfile(profile: TradingExecutionProfile): TradingExecutionProfile {
  return {
    minLeverage: profile.minLeverage,
    maxLeverage: profile.maxLeverage,
    botAllocationUsdt: profile.botAllocationUsdt,
    minInitialMarginUsdt: profile.minInitialMarginUsdt,
    maxOrderNotional: profile.maxOrderNotional,
    maxInitialMargin: profile.maxInitialMargin,
    maxAccountOpenNotional: profile.maxAccountOpenNotional,
    stopLossBps: profile.stopLossBps,
    takeProfitBps: profile.takeProfitBps,
    maxOrdersPerMinute: profile.maxOrdersPerMinute,
    entryPaused: profile.entryPaused === true,
  };
}
export type TradingBotState = 'DRAFT' | 'VALIDATING' | 'STARTING' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'RISK_BLOCKED' | 'RECONCILING' | 'EMERGENCY_STOPPED' | 'ERROR';
export type TradingBot = {
  id: string; exchangeAccountId: string; name: string; type: 'SCALPING' | 'GRID'; mode: 'SHADOW' | 'PAPER' | 'DEMO';
  state: TradingBotState; desiredState: 'RUNNING' | 'PAUSED' | 'STOPPED'; symbol: string; intervalSeconds: number;
  configuration: Record<string, unknown>; stateReason?: string; lastErrorCode?: string; lastErrorMessage?: string;
  heartbeatAt?: string; lastDecisionAt?: string; startedAt?: string; stoppedAt?: string; createdAt: string; updatedAt: string;
  exchangeAccount: Pick<TradingAccount, 'name' | 'provider' | 'environment' | 'connectionStatus' | 'isActive'>;
};
export type TradingBotDecision = {
  id: string; type: 'SCALPING' | 'GRID'; mode: 'SHADOW' | 'PAPER' | 'DEMO'; symbol: string;
  kind: 'WARMING_UP' | 'HOLD' | 'BUY' | 'SELL' | 'GRID_BUY' | 'GRID_SELL' | 'OUT_OF_RANGE';
  summary: string; markPrice: string; referencePrice: string | null; hypotheticalOrder: Record<string, unknown> | null;
  metrics: Record<string, unknown> | null; occurredAt: string;
};
export type TradingBotSignal = {
  id: string; decisionId: string | null; source: 'RULE_ENGINE' | 'AI_MODEL'; action: 'HOLD' | 'BUY' | 'SELL';
  status: 'OBSERVED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'; confidence: string; rationale: string;
  modelProvider: string | null; modelName: string | null; promptVersion: string | null;
  features: Record<string, unknown> | null; safetyChecks: Record<string, unknown>; expiresAt: string | null;
  decidedAt: string | null; createdAt: string;
};
export type TradingBotPaperPerformance = {
  position: null | {
    tradingBotId: string; symbol: string; netQuantity: string; avgEntryPrice: string; realizedPnl: string;
    unrealizedPnl: string; totalFees: string; lastMarkPrice: string; netPnl: string; totalFills: number;
    openedAt: string | null; lastFilledAt: string | null; updatedAt: string;
  };
  fills: Array<{
    id: string; decisionId: string; side: 'BUY' | 'SELL'; quantity: string; markPrice: string; fillPrice: string;
    notional: string; fee: string; realizedPnl: string; slippageBps: string; feeBps: string; occurredAt: string;
  }>;
};
export type TradingGridPlan = {
  symbol: string; marketType: 'FUTURES'; gridDirection: 'NEUTRAL'; spacingType: 'ARITHMETIC';
  lowerPrice: string; upperPrice: string; markPrice: string; markPriceInRange: boolean;
  gridLevels: number; gridIntervals: number; priceSpacing: string; quantityPerGrid: string; leverage: number; marginMode: MarginMode;
  buyCount: number; sellCount: number; waitCount: number; maximumPlannedNotional: string; estimatedMaximumInitialMargin: string;
  account: { id: string; name: string; provider: string; environment: string; accountType: string };
  levels: Array<{ index: number; price: string; side: 'BUY' | 'SELL' | 'WAIT'; quantity: string; notional: string; estimatedInitialMargin: string; distancePercent: string; status: 'PLANNED' }>;
  generatedAt: string; submittedToExchange: false; warnings: string[];
};
export type CreateTradingBotInput = {
  name: string; exchangeAccountId: string; type: 'SCALPING'; mode: 'SHADOW' | 'PAPER'; symbol: string; intervalSeconds: number;
  configuration: { side: 'BUY' | 'SELL' | 'BOTH'; quantity: string; leverage: number; marginMode: MarginMode; signalThresholdBps: number; paperFeeBps: number; paperSlippageBps: number };
} | {
  name: string; exchangeAccountId: string; type: 'GRID'; mode: 'SHADOW' | 'PAPER'; symbol: string; intervalSeconds: number;
  configuration: { marketType: 'FUTURES'; gridDirection: 'NEUTRAL'; spacingType: 'ARITHMETIC'; lowerPrice: string; upperPrice: string; gridLevels: number; quantityPerGrid: string; leverage: number; marginMode: MarginMode; paperFeeBps: number; paperSlippageBps: number };
};

export async function getTradingAccounts() {
  return (await api.get<{ data: TradingAccount[] }>('/admin/trading/exchange-accounts')).data.data;
}
export async function getTradingSymbols(exchangeAccountId: string) {
  return (await api.get<{ data: TradingSymbol[] }>('/admin/trading/symbols', { params: { exchangeAccountId } })).data.data;
}
export async function previewOrder(input: {
  exchangeAccountId: string; symbol: string; side: OrderSide; type: OrderType; quantity: string; price?: string;
  stopPrice?: string; leverage: number; marginMode: MarginMode; reduceOnly: boolean;
}) {
  return (await api.post<{ data: OrderPreview }>('/admin/trading/orders/preview', input)).data.data;
}
export async function confirmOrder(previewId: string) {
  return (await api.post('/admin/trading/orders', { previewId, idempotencyKey: crypto.randomUUID() })).data.data;
}
export async function getOpenOrders(exchangeAccountId: string) {
  return (await api.get<{ data: OpenOrder[] }>('/admin/trading/orders', { params: { exchangeAccountId } })).data.data;
}
export async function cancelOrder(exchangeAccountId: string, order: OpenOrder) {
  return api.post(`/admin/trading/orders/${encodeURIComponent(order.exchangeOrderId)}/cancel`, { exchangeAccountId, symbol: order.symbol, idempotencyKey: crypto.randomUUID() });
}
export async function getOpenPositions(exchangeAccountId: string) {
  return (await api.get<{ data: OpenPosition[] }>('/admin/trading/positions', { params: { exchangeAccountId } })).data.data;
}
export async function getManualMentorPositions(exchangeAccountId: string) {
  return (await api.get<{ data: ManualMentorPosition[] }>('/admin/trading/manual-mentor-positions', { params: { exchangeAccountId } })).data.data;
}
export async function publishManualMentorSignal(exchangeAccountId: string, positionKey: string) {
  return (await api.post<{ data: { signalKey: string; targetedBotCount: number; action: 'BUY' | 'SELL'; baseAsset: string; forcesTrade: false } }>(
    `/admin/trading/manual-mentor-positions/${encodeURIComponent(positionKey)}/publish`,
    { exchangeAccountId },
  )).data.data;
}
export async function getTradingExecutionProfile(exchangeAccountId: string) {
  const profile = (await api.get<{ data: TradingExecutionProfile }>(`/admin/trading/exchange-accounts/${encodeURIComponent(exchangeAccountId)}/risk-profile`)).data.data;
  return normalizeTradingExecutionProfile(profile);
}
export async function updateTradingExecutionProfile(exchangeAccountId: string, input: TradingExecutionProfile) {
  // The GET response also contains server-managed fields (IDs, kill-switch
  // state, timestamps and effective limits). Never echo those fields into the
  // strict PATCH contract; send only the administrator-editable values.
  const payload = normalizeTradingExecutionProfile(input);
  const profile = (await api.patch<{ data: TradingExecutionProfile }>(
    `/admin/trading/exchange-accounts/${encodeURIComponent(exchangeAccountId)}/risk-profile`,
    payload,
  )).data.data;
  return normalizeTradingExecutionProfile(profile);
}
export async function closeOpenPosition(
  exchangeAccountId: string,
  position: OpenPosition,
  options: { type: 'MARKET' | 'LIMIT'; quantity?: string; price?: string },
) {
  return api.post(`/admin/trading/positions/${encodeURIComponent(position.positionKey)}/close`, {
    exchangeAccountId,
    idempotencyKey: crypto.randomUUID(),
    ...options,
  });
}
export async function getTradingBots() {
  return (await api.get<{ data: TradingBot[] }>('/admin/trading/bots')).data.data;
}
export async function getTradingBotDecisions(id: string) {
  return (await api.get<{ data: TradingBotDecision[] }>(`/admin/trading/bots/${encodeURIComponent(id)}/decisions`)).data.data;
}
export async function getTradingBotSignals(id: string) {
  return (await api.get<{ data: TradingBotSignal[] }>(`/admin/trading/bots/${encodeURIComponent(id)}/signals`)).data.data;
}
export async function getTradingBotPaperPerformance(id: string) {
  return (await api.get<{ data: TradingBotPaperPerformance }>(`/admin/trading/bots/${encodeURIComponent(id)}/paper-performance`)).data.data;
}
export async function previewTradingGridPlan(input: { exchangeAccountId: string; symbol: string; configuration: Extract<CreateTradingBotInput, { type: 'GRID' }>['configuration'] }) {
  return (await api.post<{ data: TradingGridPlan }>('/admin/trading/bots/grid-plan/preview', input)).data.data;
}
export async function getTradingBotGridPlan(id: string) {
  return (await api.get<{ data: TradingGridPlan }>(`/admin/trading/bots/${encodeURIComponent(id)}/grid-plan`)).data.data;
}
export async function createTradingBot(input: CreateTradingBotInput) {
  return (await api.post<{ data: TradingBot }>('/admin/trading/bots', input)).data.data;
}
export async function runTradingBotAction(id: string, action: 'validate' | 'start' | 'pause' | 'resume' | 'stop' | 'emergency-stop') {
  return (await api.post<{ data: TradingBot }>(`/admin/trading/bots/${encodeURIComponent(id)}/${action}`)).data.data;
}
