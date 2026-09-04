export type SignalDecision = 'LONG' | 'SHORT' | 'HOLD';

export type MainTabType =
  | 'ai-trading'
  | 'positions'
  | 'my-bots'
  | 'bot-guide'
  | 'manual-trade'
  | 'exchange-accounts'
  | 'orders'
  | 'grid-bot'
  | 'pnl'
  | 'risk'
  | 'system';

export type AiTradingSubTabType =
  | 'overview'
  | 'arena'
  | 'champions'
  | 'memory'
  | 'performance'
  | 'risk'
  | 'live-prep';

export interface CoinInfo {
  symbol: string;
  name: string;
  iconColor: string;
  basePrice: number;
}

export interface CoinNodeState {
  symbol: string;
  name: string;
  decision: SignalDecision;
  confidence: number;
  price: number;
  change24h: number;
  lastUpdated: number;
  pulseTrigger: number;
  signalStrength: number; // 0 to 100
  activePosition?: {
    direction: 'LONG' | 'SHORT';
    roe: number;
    pnl: number;
    entryPrice: number;
    currentPrice: number;
  };
}

export interface SignalEvent {
  id: string;
  timestamp: string;
  timeMs: number;
  symbol: string;
  decision: SignalDecision;
  confidence: number;
  changePercent: number;
  price: number;
}

export interface ActivePosition {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  roe: number;
  pnl: number;
  takeProfit: number;
  stopLoss: number;
  leverage?: number;
  amount?: number;
  margin?: number;
  liquidationPrice?: number;
  openTime?: string;
}

export interface ArenaBotItem {
  id: string;
  index: number;
  name: string;
  accountLabel: string;
  coin: string;
  entryPrice: number | null;
  directionLeverage: string | null;
  currentPnl: number | null;
  tradesCount: number;
  score: number;
  totalPnl: number | null;
  openPnl: number | null;
  roi: number | null;
  profitFactor: number | null;
  status: 'RUNNING' | 'STOPPED' | 'PAUSED' | 'CHALLENGER';
  strategy: string;
  generation: string;
  regime: string;
  winRate?: number;
  lastSignal?: string;
  uptime?: string;
}

export interface ChampionBot {
  rank: number;
  name: string;
  strategy: string;
  coin: string;
  roi30d: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  score: number;
  badge: 'ELITE' | 'CHALLENGER' | 'MASTER';
}

export interface OrderItem {
  id: string;
  timestamp: string;
  symbol: string;
  type: 'LIMIT' | 'MARKET' | 'STOP_MARKET' | 'TAKE_PROFIT';
  side: 'BUY' | 'SELL';
  price: number;
  amount: number;
  filled: number;
  status: 'OPEN' | 'FILLED' | 'CANCELED' | 'TRIGGERED';
  reduceOnly: boolean;
}

export interface ExchangeAccount {
  id: string;
  name: string;
  exchange: 'Binance Testnet' | 'Binance Live' | 'Bybit' | 'OKX';
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  totalBalance: number;
  availableBalance: number;
  currency: string;
  latencyMs: number;
  apiKeyMasked: string;
  isTestnet: boolean;
}

export interface GridBotConfig {
  id: string;
  symbol: string;
  status: 'ACTIVE' | 'PAUSED';
  lowerPrice: number;
  upperPrice: number;
  gridCount: number;
  investment: number;
  profitPerGrid: number;
  totalProfit: number;
  gridType: 'ARITHMETIC' | 'GEOMETRIC';
  matchedOrders: number;
}

export interface CurrencyDistribution {
  name: string;
  amount: number;
  percentage: number;
  color: string;
}

export interface BotOverviewStats {
  decisionsPerMinute: number;
  activePositionsCount: number;
  marginUsed: number;
  totalBalance: number;
  availableBalance: number;
  pnl24h: number;
  pnl24hPercent: number;
  isPaperTrading: boolean;
  botStatus: 'ACTIVE' | 'PAUSED' | 'IDLE';
  uptime: string;
  lastSignalTime: string;
  lastUpdateTime: string;
  winRate: number;
  totalTrades: number;
  avgProfit: number;
  avgLoss: number;
  profitFactor: number;
  totalBots: number;
  activeBots: number;
  stoppedBots: number;
  maxConcurrentPositions: number;
  currentPositions: number;
  avgResponseTimeMs: number;
  maxRiskPerTrade: number;
  maxDailyLoss: number;
  currentRisk: number;
  riskScore: 'Düşük' | 'Orta' | 'Yüksek';
  systemHealth: 'Mükemmel' | 'İyi' | 'Kritik';
}

export interface RiskProfileConfig {
  accountId: string;
  accountName: string;
  globalKillSwitch: boolean;
  accountKillSwitch: boolean;
  botQuotaMargin: number; // Bot başına teminat kotası (USDT)
  minTradeMargin: number; // Asgari işlem teminatı (USDT)
  maxNotionalPerOrder: number; // Emir başına azami notional (USDT)
  maxInitialMarginPerOrder: number; // Emir başına azami başlangıç teminatı (USDT)
  accountMaxOpenNotional: number; // Hesap açık notional limiti (USDT)
  pairMaxOpenNotional: number; // Parite açık notional limiti (USDT)
  minLeverage: number; // Asgari kaldıraç (x)
  maxLeverage: number; // Azami kaldıraç (x)
  maxOpenPositionsFutures: number; // Futures Testnet / Live azami açık pozisyon
  maxOpenPositionsPaper: number; // PAPER / Training azami açık pozisyon
  maxOpenPositionsPerPair: number; // Parite başına azami açık pozisyon
  maxOrdersPerMinute: number; // Dakikalık emir limiti
  maxOrdersPerDay: number; // Günlük emir limiti
  minProtectedBalance: number; // Korunacak minimum bakiye (USDT)
  updatedAt: string;
}
