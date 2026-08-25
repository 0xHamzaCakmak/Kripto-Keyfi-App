import { api } from './apiClient';

export type SafeTradingMode = 'PAPER' | 'SHADOW' | 'DEMO';
export type AutonomousLifecycle = 'DRAFT' | 'CANDIDATE' | 'PAPER' | 'TESTING' | 'CHALLENGER' | 'CHAMPION' | 'LIVE_ELIGIBLE' | 'LIVE' | 'PAUSED' | 'REJECTED' | 'ARCHIVED';

export type AutonomousEnvelope<T> = {
  apiVersion: 'v1';
  kind: string;
  data: T;
  liveTradingEnabled: false;
};

export type AutonomousOverview = {
  bots: number;
  strategies: number;
  generations: number;
  paperTrades: number;
  champions: number;
  liveEligible: number;
  globalKillSwitch: boolean;
  safeModes: readonly SafeTradingMode[];
  liveActivationAvailable: false;
  testnetExecutionAvailable: boolean;
};

export type ArenaStatus = {
  states: Record<string, number>;
  modes: Record<string, number>;
  decisionsLast5m: number;
  throughputPerMinute: number;
  latestDecisionAt: string | null;
  executionMode: 'SIMULATION_ONLY';
};

export type TradingUniverseAsset = {
  id: string; symbol: string; baseAsset: string; displayName: string; enabled: boolean; sortOrder: number;
  marketCap: string | null; volume24h: string | null; marketRank: number | null; volumeChange24h: string | null;
  intelligenceSource: string | null; intelligenceUpdatedAt: string | null; exchangeAvailable: boolean | null;
};
export type TradingUniverse = {
  assets: TradingUniverseAsset[];
  intelligence: { providers: string[]; globalContext: Record<string, unknown>; refreshedAt: string };
  exchange: { accountId: string | null; name: string | null; environment: string | null; accountType: string | null; catalogStatus: 'FRESH' | 'UNAVAILABLE' };
};
export type TradingUniverseCandidate = {
  symbol: string; baseAsset: string; quoteAsset: string; maxLeverage: number; minNotional: string; listed: boolean; enabled: boolean;
};
export type TradingUniverseSearch = {
  account: { id: string; name: string; environment: string; accountType: string };
  results: TradingUniverseCandidate[];
};

export type AutonomousBot = {
  id: string;
  name: string;
  type: 'AUTONOMOUS';
  mode: SafeTradingMode;
  state: string;
  desiredState: string;
  lifecycleStatus: AutonomousLifecycle;
  factoryCreationMethod: string | null;
  strategyVersionId: string | null;
  generationId: string | null;
  parentBotId: string | null;
  riskProfileId: string | null;
  exchangeAccountId: string;
  startingPaperBalance: string;
  symbols: unknown;
  timeframe: string | null;
  configuration: unknown;
  stateReason: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  heartbeatAt: string | null;
  lastDecisionAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  strategyVersion: { version: number; strategy: { id: string; name: string; family: string } } | null;
  paperPosition: PaperPosition | null;
  promotionEvidence: {
    botId: string; lifecycleStatus: AutonomousLifecycle; evidenceAt: string; evidenceVersion: string; score: number | null;
    totalTrades: number; paperDurationDays: number; profitFactor: number | null;
    maxDrawdown: number; regimeCoverage: number; openPaperTrades: number;
  } | null;
  _count: { paperFills: number; paperTrades: number };
};

export type PaperPosition = {
  tradingBotId: string; symbol: string; netQuantity: string; avgEntryPrice: string; realizedPnl: string;
  unrealizedPnl: string; totalFees: string; lastMarkPrice: string; netPnl?: string;
  openedAt: string | null; lastFilledAt: string | null; updatedAt: string;
};
export type PaperFill = {
  id: string; decisionId: string; side: 'BUY' | 'SELL'; quantity: string; markPrice: string; fillPrice: string;
  notional: string; fee: string; realizedPnl: string; slippageBps: string; feeBps: string; occurredAt: string;
};
export type PaperTrade = {
  id: string; symbol: string; side: 'BUY' | 'SELL'; status: 'OPEN' | 'CLOSED' | 'LIQUIDATED';
  entryPrice: string; exitPrice: string | null; markPrice: string; quantity: string; leverage: number;
  notional: string; initialMargin: string; fees: string; realizedPnl: string; unrealizedPnl: string;
  netPnl: string; pnlPct: string; stopLoss: string | null; takeProfit: string | null;
  closeReason: string | null; openedAt: string; closedAt: string | null;
};
export type PaperPerformance = {
  position: PaperPosition | null;
  fills: PaperFill[];
  trades?: PaperTrade[];
  closedSummary?: { tradeCount: number; wins: number; losses: number; netPnl: string; fees: string };
};

export type TestnetPosition = {
  positionKey: string; symbol: string; side: 'LONG' | 'SHORT'; quantity: string; entryPrice: string; markPrice: string;
  liquidationPrice?: string; unrealizedPnl: string; leverage: string; marginMode: 'ISOLATED' | 'CROSS';
  notional: string; margin: string; roi: number;
};
export type TestnetFill = {
  tradeId: string; exchangeOrderId: string; botId: string; symbol: string; side: 'BUY' | 'SELL'; price: string;
  quantity: string; quoteQuantity: string; realizedPnl: string; commission: string; commissionAsset: string;
  netRealizedPnl: number; maker: boolean; occurredAt: string; orderType: string; reduceOnly: boolean;
};
export type TestnetBotOperation = {
  botId: string; name: string; symbol: string; state: string; desiredState: string; allocationUsdt: number;
  configuredLeverage: number | null; position: TestnetPosition | null; stopLoss: string | null; takeProfit: string | null;
  realizedPnl: string; commission: string; netRealizedPnl: string; totalFills: number; entryFills: number; closedFills: number;
  wins: number; losses: number; fills?: TestnetFill[];
};

export type LeaderboardRow = {
  metricId: string;
  tradingBotId: string;
  botName: string;
  strategyVersionId: string | null;
  score: number;
  currentEquity: number;
  realizedPnl: number;
  unrealizedPnl: number;
  netPnl: number;
  totalTrades: number;
  maxDrawdown: number;
  breakdown: unknown;
  snapshotAt: string;
  rank: number;
};

export type TradeSummary = {
  groupKey: string;
  tradeCount: number;
  wins: number;
  losses: number;
  totalPnl: string;
  averagePnl: string;
  grossProfit: string;
  grossLoss: string;
  profitFactor: number | null;
};

export type ChampionCandidate = {
  id: string;
  tradingBotId: string;
  status: string;
  score: string | number | null;
  evidence: unknown;
  evaluatedAt: string;
  promotedAt: string | null;
  createdAt: string;
  tradingBot: { name: string; lifecycleStatus: AutonomousLifecycle; strategyVersionId: string | null };
};

export type MarketRegime = 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'BREAKOUT' | 'HIGH_VOLATILITY' | 'LOW_VOLATILITY' | 'CHAOTIC' | 'UNKNOWN';

export type LiveEligibilityStatus = {
  id: string;
  name: string;
  mode: SafeTradingMode;
  lifecycleStatus: 'CHAMPION' | 'LIVE_ELIGIBLE';
  state: string;
  updatedAt: string;
  evidence: unknown;
  latestCandidate: { id: string; status: string; score: number | null; evidence: unknown; evaluatedAt: string } | null;
  liveActivated: false;
  manualApprovalRequired: boolean;
};

export type Generation = {
  id: string; number: number; status: string; populationTarget: number; metadata: unknown;
  counts: { bots: number; mutations: number; crossovers: number };
  readiness: {
    ready: boolean; populationReady: boolean; survivorEvidenceReady: boolean;
    paperBots: number; populationTarget: number; eligibleBots: number; requiredSurvivors: number;
    botsMeetingTradeMinimum: number; botsWithScore: number; minimumTrades: number;
    minimumObservedTrades: number; maximumObservedTrades: number;
    blocker: 'POPULATION_BELOW_TARGET' | 'SURVIVOR_EVIDENCE_INSUFFICIENT' | null;
  };
  startedAt: string | null; completedAt: string | null; createdAt: string; updatedAt: string;
};
export type EvolutionRun = {
  id: string; sourceGenerationId: string; targetGenerationId: string | null; status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  config: unknown; evidence: unknown; selection: unknown; errorMessage: string | null; startedAt: string; completedAt: string | null; createdAt: string;
  sourceGeneration: { number: number; status: string }; targetGeneration: { number: number; status: string } | null;
};
export type BotMutation = {
  id: string; parentBotId: string; childBotId: string; generationId: string; reason: string; diff: unknown; createdAt: string;
  parentBot: { name: string; lifecycleStatus: AutonomousLifecycle }; childBot: { name: string; lifecycleStatus: AutonomousLifecycle; mode: SafeTradingMode }; generation: { number: number; status: string };
};
export type BotCrossover = {
  id: string; parentABotId: string; parentBBotId: string; childBotId: string; generationId: string; inheritedFields: unknown; generatedFields: unknown; createdAt: string;
  parentA: { name: string }; parentB: { name: string }; child: { name: string; lifecycleStatus: AutonomousLifecycle; mode: SafeTradingMode }; generation: { number: number; status: string };
};
export type TradeMemory = {
  id: string; tradingBotId: string; strategyVersionId: string | null; symbol: string; side: 'BUY' | 'SELL'; status: 'CLOSED' | 'LIQUIDATED';
  entryPrice: string; exitPrice: string | null; quantity: string; leverage: number; fees: string; funding: string; slippageCost: string; realizedPnl: string;
  stopLoss: string | null; takeProfit: string | null; maxFavorableExcursion: string; maxAdverseExcursion: string; holdingSeconds: number | null;
  marketContext: unknown; closeReason: string | null; aiConfidence: string | null; decisionSummary: string | null; openedAt: string; closedAt: string | null;
  tradingBot: { id: string; name: string };
  strategyVersion: { id: string; version: number; strategy: { id: string; name: string; family: string } } | null;
  marketRegimeSnapshot: { id: string; regime: MarketRegime; confidence: string | number; timeframe: string; features: unknown; observedAt: string } | null;
};
export type TradeMemoryQuery = { botId?: string; strategyVersionId?: string; symbol?: string; regime?: MarketRegime; side?: 'BUY' | 'SELL'; outcome?: 'ALL' | 'BEST' | 'FAILURE'; limit?: number };
export type TradeMemoryStats = { tradeCount: number; wins: number; losses: number; netPnl: string; fees: string; funding: string; slippage: string };
export type BotCapitalResult = { bot: AutonomousBot; allocationUsdt: number; maximumAllocationUsdt: number; sharedTestnetQuota: boolean };
export type TradingRiskProfile = {
  id: string; exchangeAccountId: string; enabled: boolean; accountKillSwitch: boolean; killSwitchReason: string | null;
  globalKillSwitch: boolean; globalKillSwitchReason: string | null; globalKillSwitchActivatedAt: string | null;
  maxOrderNotional: string; maxInitialMargin: string; maxAccountOpenNotional: string; maxOpenPositions: number; paperMaxOpenPositions: number; maxSymbolPositions: number; maxLeverage: number;
  minAvailableBalance: string; maxOrdersPerMinute: number; maxDailyOrders: number; maxDailyLoss: string | null;
  maxRiskPerTradePct: string; maxDailyLossPct: string; maxWeeklyLossPct: string; maxDrawdownPct: string; maxSymbolOpenNotional: string;
  minRiskRewardRatio: string; stopLossRequired: true; marginModePolicy: 'ISOLATED_ONLY' | 'ALLOW_CROSS'; cooldownSeconds: number; maxConsecutiveLosses: number;
  allowedSymbols: string[] | null; blockedSymbols: string[] | null; updatedAt: string;
};
export type TradingRiskEvent = { id: string; tradingOrderId: string | null; source: string; decision: string; code: string; message: string; metrics: unknown; occurredAt: string };
export type ShadowTrade = {
  id: string; decisionId: string; tradingBotId: string; action: 'WOULD_OPEN' | 'WOULD_CLOSE' | 'WOULD_MOVE_STOP'; side: 'BUY' | 'SELL' | null;
  quantity: string | null; markPrice: string; simulatedFillPrice: string | null; notional: string | null; fee: string; realizedPnl: string;
  netQuantity: string; avgEntryPrice: string; cumulativePnl: string; totalFees: string; unrealizedPnl: string; slippageBps: string | null; feeBps: string | null; stopPrice: string | null;
  occurredAt: string; paperIncluded: false; submittedToExchange: false; tradingBot: { name: string; symbol: string; lifecycleStatus: AutonomousLifecycle };
};
export type ShadowPerformance = {
  botId: string; botName: string; symbol: string; lifecycleStatus: AutonomousLifecycle; riskAdjustedScore: number | null;
  totalActions: number; wouldOpen: number; wouldClose: number; wouldMoveStop: number; wins: number; losses: number; winRate: number | null;
  realizedPnl: number; totalFees: number; netPnl: number; profitFactor: number | null; maxDrawdown: number; startedAt: string | null; lastActionAt: string | null; shadowDurationDays: number;
  paperIncluded: false; orderSubmitted: false; liveActivated: false;
};
export type PortfolioAllocation = { id: string; exchangeAccountId: string; mode: SafeTradingMode; capital: string; allocatedCapital: string; reservePct: string; botAllocations: unknown; symbolAllocations: unknown; riskSnapshot: unknown; config: unknown; deterministic: boolean; orderSubmitted: false; liveActivated: false; createdAt: string };

export type TeacherEvaluation = {
  id: string;
  observation: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  metricEvidence: unknown;
  recommendedAction: unknown;
  analyzer: string;
  createdAt: string;
  tradingBot?: { name?: string | null; symbol?: string | null; symbols?: unknown } | null;
  strategy?: { name?: string | null; family?: string | null } | null;
};

export type ResearchHypothesis = {
  id: string;
  hypothesis: string;
  evidence: unknown;
  targetStrategyFamily: string;
  suggestedChange: unknown;
  confidence: number;
  status: 'DRAFT' | 'REVIEWED' | 'ACCEPTED' | 'REJECTED';
  provider: string;
  createdAt: string;
};

export type AuditActivity = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
};

export type AutonomousHealth = {
  status: 'HEALTHY' | 'DEGRADED' | 'EMERGENCY_STOPPED';
  checkedAt: string;
  windowMinutes: number;
  correlationId: string;
  metrics: {
    activeBots: number;
    arena: { decisionsLast5m: number; throughputPerMinute: number };
    marketData: { latestObservedAt: string | null; lagMs: number | null; source: 'REGIME_SNAPSHOT' | 'AUTONOMOUS_DECISION' | 'NONE' };
    strategyExecution: { averagePersistenceLatencyMs: number | null };
    paperOrders: { total: number; last24h: number };
    riskRejectsLast24h: number;
    exchangeErrorsLast24h: number;
    aiProviderErrorsLast24h: number;
    generations: Record<string, number>;
    teacherRunsLast24h: number;
    researcherRunsLast24h: number;
    memory: { decisionsTotal: number; decisionsLast24h: number; paperTradesTotal: number; growthLast24h: number };
    pnlCalculationErrors: number;
    emergencyStop: boolean;
  };
};

export type MarketContext = {
  schemaVersion: '1.0.0';
  symbol: string;
  timeframe: string;
  timestamp: string;
  market: { trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' | null; trendStrength: number | null; volatility: 'LOW' | 'MEDIUM' | 'HIGH' | null };
  sources: Record<string, { status: 'FRESH' | 'STALE' | 'UNKNOWN'; observedAt: string | null; ageMs: number | null }>;
};

type ResponseEnvelope<T> = { data: T };

async function getData<T>(path: string, params?: Record<string, unknown>) {
  return (await api.get<ResponseEnvelope<T>>(path, { params })).data.data;
}

async function getAutonomousData<T>(path: string, params?: Record<string, unknown>) {
  const envelope = await getData<AutonomousEnvelope<T>>(path, params);
  if (envelope.apiVersion !== 'v1' || envelope.liveTradingEnabled !== false) {
    throw new Error('Autonomous API güvenlik sözleşmesi doğrulanamadı.');
  }
  return envelope;
}

export const aiTradingApi = {
  overview: () => getAutonomousData<AutonomousOverview>('/admin/trading/autonomous/overview'),
  arenaStatus: () => getAutonomousData<ArenaStatus>('/admin/trading/autonomous/arena-status'),
  tradingUniverse: () => getData<TradingUniverse>('/admin/trading/autonomous/trading-universe'),
  searchTradingUniverse: (q: string, limit = 20) => getData<TradingUniverseSearch>('/admin/trading/autonomous/trading-universe/search', { q, limit }),
  addTradingUniverseAsset: (symbol: string) =>
    api.post<ResponseEnvelope<TradingUniverseAsset>>('/admin/trading/autonomous/trading-universe', { symbol }).then((response) => response.data.data),
  setTradingUniverseAsset: (symbol: string, enabled: boolean) =>
    api.patch<ResponseEnvelope<TradingUniverseAsset>>(`/admin/trading/autonomous/trading-universe/${encodeURIComponent(symbol)}`, { enabled }).then((response) => response.data.data),
  bots: () => getData<AutonomousBot[]>('/admin/trading/bot-factory/bots'),
  paperPerformance: (botId: string) => getData<PaperPerformance>(`/admin/trading/bot-factory/bots/${encodeURIComponent(botId)}/paper-performance`),
  leaderboard: (limit = 100) => getData<LeaderboardRow[]>('/admin/trading/leaderboard', { limit }),
  regimeLeaderboard: (regime: MarketRegime, limit = 100) => getData<Array<LeaderboardRow & { regime: MarketRegime }>>(`/admin/trading/regimes/${regime}/leaderboard`, { limit }),
  champions: () => getData<ChampionCandidate[]>('/admin/trading/champions'),
  liveEligibility: () => getAutonomousData<LiveEligibilityStatus[]>('/admin/trading/autonomous/live-eligibility'),
  testnetOperations: () => getAutonomousData<TestnetBotOperation[]>('/admin/trading/autonomous/testnet-operations'),
  testnetBotOperation: (botId: string) => getAutonomousData<TestnetBotOperation>(`/admin/trading/autonomous/testnet-operations/${encodeURIComponent(botId)}`),
  promotionReview: (botId: string, decision: 'APPROVE' | 'REJECT', note: string) =>
    api.post<ResponseEnvelope<AutonomousEnvelope<unknown>>>(`/admin/trading/autonomous/bots/${encodeURIComponent(botId)}/promotion-review`, { decision, note }).then((response) => {
      const envelope = response.data.data;
      if (envelope.apiVersion !== 'v1' || envelope.liveTradingEnabled !== false) throw new Error('Promotion review güvenlik sözleşmesi doğrulanamadı.');
      return envelope;
    }),
  activateTestnet: (botId: string, note: string) =>
    api.post<ResponseEnvelope<AutonomousEnvelope<unknown>>>(`/admin/trading/autonomous/bots/${encodeURIComponent(botId)}/activate-testnet`, { confirmation: 'ENABLE BINANCE TESTNET', note }).then((response) => {
      const envelope = response.data.data;
      if (envelope.apiVersion !== 'v1' || envelope.liveTradingEnabled !== false) throw new Error('TESTNET activation güvenlik sözleşmesi doğrulanamadı.');
      return envelope;
    }),
  generations: (limit = 100) => getAutonomousData<Generation[]>('/admin/trading/autonomous/generations', { limit }),
  evolutionRuns: (limit = 100) => getData<EvolutionRun[]>('/admin/trading/evolution/runs', { limit }),
  mutations: (limit = 100) => getData<BotMutation[]>('/admin/trading/mutations', { limit }),
  crossovers: (limit = 100) => getData<BotCrossover[]>('/admin/trading/crossovers', { limit }),
  triggerPaperGeneration: (populationTarget: number, note: string) =>
    api.post<ResponseEnvelope<AutonomousEnvelope<Generation>>>('/admin/trading/autonomous/generations', { populationTarget, note }).then((response) => response.data.data),
  tradeSummary: (groupBy: 'BOT' | 'STRATEGY' | 'REGIME' | 'SYMBOL', limit = 100) =>
    getData<TradeSummary[]>('/admin/trading/trade-memory/summary', { groupBy, limit }),
  tradeMemory: (params: TradeMemoryQuery = {}) => getData<TradeMemory[]>('/admin/trading/trade-memory', params),
  tradeMemoryStats: (params: Omit<TradeMemoryQuery, 'limit'> = {}) => getData<TradeMemoryStats>('/admin/trading/trade-memory/stats', params),
  changeBotCapital: (botId: string, action: 'SET' | 'ADD', amountUsdt: number, note?: string) =>
    api.patch<ResponseEnvelope<AutonomousEnvelope<BotCapitalResult>>>(`/admin/trading/autonomous/bots/${encodeURIComponent(botId)}/capital`, { action, amountUsdt, ...(note ? { note } : {}) })
      .then((response) => {
        const envelope = response.data.data;
        if (envelope.apiVersion !== 'v1' || envelope.liveTradingEnabled !== false) throw new Error('Bot sermaye güvenlik sözleşmesi doğrulanamadı.');
        return envelope.data;
      }),
  teacherEvaluations: (limit = 10) => getData<TeacherEvaluation[]>('/admin/trading/teacher/evaluations', { limit }),
  researchHypotheses: (limit = 10) => getData<ResearchHypothesis[]>('/admin/trading/research/hypotheses', { limit }),
  audit: (limit = 20) => getData<AuditActivity[]>('/admin/trading/system-health/audit', { limit }),
  health: () => getData<AutonomousHealth>('/admin/trading/system-health'),
  marketContext: (symbol = 'BTCUSDT', timeframe = '15m') =>
    getData<MarketContext>('/admin/trading/market-intelligence/context', { symbol, timeframe }),
  riskProfile: (exchangeAccountId: string) => getData<TradingRiskProfile>(`/admin/trading/exchange-accounts/${encodeURIComponent(exchangeAccountId)}/risk-profile`),
  riskEvents: (exchangeAccountId: string) => getData<TradingRiskEvent[]>(`/admin/trading/exchange-accounts/${encodeURIComponent(exchangeAccountId)}/risk-events`),
  shadowTrades: (limit = 100) => getData<ShadowTrade[]>('/admin/trading/shadow-trades', { limit }),
  shadowPerformance: () => getData<ShadowPerformance[]>('/admin/trading/shadow-trades/performance'),
  portfolioAllocations: (limit = 50) => getData<PortfolioAllocation[]>('/admin/trading/portfolio-allocations', { limit }),
};

export function recordNumber(value: unknown, keys: string[]): number | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    const number = typeof candidate === 'number' ? candidate : typeof candidate === 'string' ? Number(candidate) : Number.NaN;
    if (Number.isFinite(number)) return number;
  }
  return null;
}

export function botSymbols(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
