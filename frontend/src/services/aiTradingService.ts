import { api } from './apiClient';

export type SafeTradingMode = 'PAPER' | 'SHADOW';
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
};

export type ArenaStatus = {
  states: Record<string, number>;
  modes: Record<string, number>;
  decisionsLast5m: number;
  throughputPerMinute: number;
  latestDecisionAt: string | null;
  executionMode: 'SIMULATION_ONLY';
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
  createdAt: string;
  updatedAt: string;
  version: number;
  strategyVersion: { version: number; strategy: { id: string; name: string; family: string } } | null;
};

export type LeaderboardRow = {
  metricId: string;
  tradingBotId: string;
  botName: string;
  strategyVersionId: string | null;
  score: number;
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
  latestCandidate: { id: string; status: string; score: number | null; evidence: unknown; evaluatedAt: string } | null;
  liveActivated: false;
  manualApprovalRequired: boolean;
};

export type TeacherEvaluation = {
  id: string;
  observation: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number;
  metricEvidence: unknown;
  recommendedAction: unknown;
  analyzer: string;
  createdAt: string;
  tradingBot?: { name: string } | null;
  strategy?: { name: string; family: string } | null;
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
    marketData: { latestObservedAt: string | null; lagMs: number | null };
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
  bots: () => getData<AutonomousBot[]>('/admin/trading/bot-factory/bots'),
  leaderboard: (limit = 100) => getData<LeaderboardRow[]>('/admin/trading/leaderboard', { limit }),
  regimeLeaderboard: (regime: MarketRegime, limit = 100) => getData<Array<LeaderboardRow & { regime: MarketRegime }>>(`/admin/trading/regimes/${regime}/leaderboard`, { limit }),
  champions: () => getData<ChampionCandidate[]>('/admin/trading/champions'),
  liveEligibility: () => getAutonomousData<LiveEligibilityStatus[]>('/admin/trading/autonomous/live-eligibility'),
  promotionReview: (botId: string, decision: 'APPROVE' | 'REJECT', note: string) =>
    api.post<ResponseEnvelope<AutonomousEnvelope<unknown>>>(`/admin/trading/autonomous/bots/${encodeURIComponent(botId)}/promotion-review`, { decision, note }).then((response) => {
      const envelope = response.data.data;
      if (envelope.apiVersion !== 'v1' || envelope.liveTradingEnabled !== false) throw new Error('Promotion review güvenlik sözleşmesi doğrulanamadı.');
      return envelope;
    }),
  tradeSummary: (groupBy: 'BOT' | 'STRATEGY' | 'REGIME' | 'SYMBOL', limit = 100) =>
    getData<TradeSummary[]>('/admin/trading/trade-memory/summary', { groupBy, limit }),
  teacherEvaluations: (limit = 10) => getData<TeacherEvaluation[]>('/admin/trading/teacher/evaluations', { limit }),
  researchHypotheses: (limit = 10) => getData<ResearchHypothesis[]>('/admin/trading/research/hypotheses', { limit }),
  audit: (limit = 20) => getData<AuditActivity[]>('/admin/trading/system-health/audit', { limit }),
  health: () => getData<AutonomousHealth>('/admin/trading/system-health'),
  marketContext: (symbol = 'BTCUSDT', timeframe = '15m') =>
    getData<MarketContext>('/admin/trading/market-intelligence/context', { symbol, timeframe }),
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
