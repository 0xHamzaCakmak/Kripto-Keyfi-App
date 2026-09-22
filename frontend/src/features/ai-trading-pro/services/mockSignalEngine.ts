import { CoinNodeState, SignalEvent, ActivePosition, BotOverviewStats } from '../types';

export const INITIAL_COIN_NODES: CoinNodeState[] = [
  {
    symbol: 'BTC/USDT',
    name: 'Bitcoin',
    decision: 'LONG',
    confidence: 78,
    price: 69123.4,
    change24h: 3.42,
    lastUpdated: Date.now(),
    pulseTrigger: 0,
    signalStrength: 88,
    activePosition: {
      direction: 'LONG',
      roe: 5.21,
      pnl: 187.52,
      entryPrice: 67432.1,
      currentPrice: 69123.4,
    },
  },
  {
    symbol: 'ETH/USDT',
    name: 'Ethereum',
    decision: 'HOLD',
    confidence: 45,
    price: 3352.8,
    change24h: 1.85,
    lastUpdated: Date.now(),
    pulseTrigger: 0,
    signalStrength: 52,
    activePosition: {
      direction: 'LONG',
      roe: 3.29,
      pnl: 112.47,
      entryPrice: 3245.6,
      currentPrice: 3352.8,
    },
  },
  {
    symbol: 'BNB/USDT',
    name: 'BNB',
    decision: 'SHORT',
    confidence: 69,
    price: 575.12,
    change24h: -1.24,
    lastUpdated: Date.now(),
    pulseTrigger: 0,
    signalStrength: 74,
    activePosition: {
      direction: 'SHORT',
      roe: 2.23,
      pnl: 41.32,
      entryPrice: 588.23,
      currentPrice: 575.12,
    },
  },
  {
    symbol: 'SOL/USDT',
    name: 'Solana',
    decision: 'LONG',
    confidence: 72,
    price: 161.45,
    change24h: 4.68,
    lastUpdated: Date.now(),
    pulseTrigger: 0,
    signalStrength: 82,
    activePosition: {
      direction: 'LONG',
      roe: 4.68,
      pnl: 89.21,
      entryPrice: 154.23,
      currentPrice: 161.45,
    },
  },
  {
    symbol: 'XRP/USDT',
    name: 'Ripple',
    decision: 'HOLD',
    confidence: 42,
    price: 0.5842,
    change24h: 0.42,
    lastUpdated: Date.now(),
    pulseTrigger: 0,
    signalStrength: 46,
  },
  {
    symbol: 'AVAX/USDT',
    name: 'Avalanche',
    decision: 'SHORT',
    confidence: 65,
    price: 36.92,
    change24h: -2.35,
    lastUpdated: Date.now(),
    pulseTrigger: 0,
    signalStrength: 70,
    activePosition: {
      direction: 'SHORT',
      roe: 3.98,
      pnl: 64.72,
      entryPrice: 38.45,
      currentPrice: 36.92,
    },
  },
  {
    symbol: 'DOGE/USDT',
    name: 'Dogecoin',
    decision: 'LONG',
    confidence: 58,
    price: 0.1425,
    change24h: 5.12,
    lastUpdated: Date.now(),
    pulseTrigger: 0,
    signalStrength: 64,
  },
  {
    symbol: 'ADA/USDT',
    name: 'Cardano',
    decision: 'HOLD',
    confidence: 40,
    price: 0.4812,
    change24h: -0.85,
    lastUpdated: Date.now(),
    pulseTrigger: 0,
    signalStrength: 42,
  },
];

export const INITIAL_POSITIONS: ActivePosition[] = [
  {
    id: 'pos-1',
    symbol: 'BTC/USDT',
    direction: 'LONG',
    entryPrice: 67432.1,
    currentPrice: 69123.4,
    roe: 5.21,
    pnl: 187.52,
    takeProfit: 71000,
    stopLoss: 65500,
  },
  {
    id: 'pos-2',
    symbol: 'ETH/USDT',
    direction: 'LONG',
    entryPrice: 3245.6,
    currentPrice: 3352.8,
    roe: 3.29,
    pnl: 112.47,
    takeProfit: 3450,
    stopLoss: 3100,
  },
  {
    id: 'pos-3',
    symbol: 'SOL/USDT',
    direction: 'LONG',
    entryPrice: 154.23,
    currentPrice: 161.45,
    roe: 4.68,
    pnl: 89.21,
    takeProfit: 167.0,
    stopLoss: 145.0,
  },
  {
    id: 'pos-4',
    symbol: 'AVAX/USDT',
    direction: 'SHORT',
    entryPrice: 38.45,
    currentPrice: 36.92,
    roe: 3.98,
    pnl: 64.72,
    takeProfit: 34.5,
    stopLoss: 40.5,
  },
  {
    id: 'pos-5',
    symbol: 'BNB/USDT',
    direction: 'SHORT',
    entryPrice: 588.23,
    currentPrice: 575.12,
    roe: 2.23,
    pnl: 41.32,
    takeProfit: 560.0,
    stopLoss: 610.0,
  },
];

export const INITIAL_FEED_EVENTS: SignalEvent[] = [
  { id: 'sig-1', timestamp: '12:47:03', timeMs: Date.now() - 1000, symbol: 'BTC/USDT', decision: 'LONG', confidence: 78, changePercent: 0.78, price: 69123.4 },
  { id: 'sig-2', timestamp: '12:47:02', timeMs: Date.now() - 2000, symbol: 'ETH/USDT', decision: 'HOLD', confidence: 45, changePercent: 0.45, price: 3352.8 },
  { id: 'sig-3', timestamp: '12:47:01', timeMs: Date.now() - 3000, symbol: 'BNB/USDT', decision: 'SHORT', confidence: 69, changePercent: -0.69, price: 575.12 },
  { id: 'sig-4', timestamp: '12:47:00', timeMs: Date.now() - 4000, symbol: 'SOL/USDT', decision: 'LONG', confidence: 72, changePercent: 0.72, price: 161.45 },
  { id: 'sig-5', timestamp: '12:46:59', timeMs: Date.now() - 5000, symbol: 'XRP/USDT', decision: 'HOLD', confidence: 42, changePercent: 0.42, price: 0.5842 },
  { id: 'sig-6', timestamp: '12:46:58', timeMs: Date.now() - 6000, symbol: 'AVAX/USDT', decision: 'SHORT', confidence: 65, changePercent: -0.65, price: 36.92 },
  { id: 'sig-7', timestamp: '12:46:57', timeMs: Date.now() - 7000, symbol: 'DOGE/USDT', decision: 'LONG', confidence: 58, changePercent: 0.58, price: 0.1425 },
  { id: 'sig-8', timestamp: '12:46:56', timeMs: Date.now() - 8000, symbol: 'ADA/USDT', decision: 'HOLD', confidence: 40, changePercent: 0.40, price: 0.4812 },
  { id: 'sig-9', timestamp: '12:46:55', timeMs: Date.now() - 9000, symbol: 'MATIC/USDT', decision: 'SHORT', confidence: 55, changePercent: -0.55, price: 0.721 },
  { id: 'sig-10', timestamp: '12:46:54', timeMs: Date.now() - 10000, symbol: 'DOT/USDT', decision: 'LONG', confidence: 60, changePercent: 0.60, price: 7.34 },
];

export const BOT_OVERVIEW_STATS: BotOverviewStats = {
  decisionsPerMinute: 49,
  activePositionsCount: 15,
  marginUsed: 1248.56,
  totalBalance: 10532.82,
  availableBalance: 8845.21,
  pnl24h: 256.34,
  pnl24hPercent: 2.49,
  isPaperTrading: true,
  botStatus: 'ACTIVE',
  uptime: '2g 14s 32d',
  lastSignalTime: '12:47:03',
  lastUpdateTime: '12:47:05',
  winRate: 68.6,
  totalTrades: 105,
  avgProfit: 2.43,
  avgLoss: -1.87,
  profitFactor: 2.31,
  totalBots: 20,
  activeBots: 18,
  stoppedBots: 2,
  maxConcurrentPositions: 100,
  currentPositions: 15,
  avgResponseTimeMs: 180,
  maxRiskPerTrade: 2.0,
  maxDailyLoss: 10.0,
  currentRisk: 1.23,
  riskScore: 'Orta',
  systemHealth: 'İyi',
};

type SignalListener = (event: SignalEvent) => void;

class SignalEventEmitter {
  private listeners: SignalListener[] = [];
  private intervalId: number | null = null;
  private isRunning: boolean = true;
  private speedMs: number = 1300; // ~46 decisions / min

  public subscribe(listener: SignalListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public emit(event: SignalEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in signal listener', err);
      }
    });
  }

  public start() {
    if (this.intervalId !== null) return;
    this.isRunning = true;

    const generateDecision = () => {
      if (!this.isRunning) return;

      const symbols = [
        'BTC/USDT',
        'ETH/USDT',
        'BNB/USDT',
        'SOL/USDT',
        'XRP/USDT',
        'AVAX/USDT',
        'DOGE/USDT',
        'ADA/USDT',
      ];
      const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];

      const decisions: ('LONG' | 'SHORT' | 'HOLD')[] = ['LONG', 'SHORT', 'HOLD'];
      const weights = [0.45, 0.35, 0.2]; // bias
      const r = Math.random();
      let chosenDecision: 'LONG' | 'SHORT' | 'HOLD' = 'LONG';
      if (r < weights[0]) chosenDecision = 'LONG';
      else if (r < weights[0] + weights[1]) chosenDecision = 'SHORT';
      else chosenDecision = 'HOLD';

      const minConf = chosenDecision === 'HOLD' ? 38 : 55;
      const maxConf = chosenDecision === 'HOLD' ? 52 : 89;
      const confidence = Math.floor(Math.random() * (maxConf - minConf + 1)) + minConf;

      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];

      const change = chosenDecision === 'LONG' ? confidence / 100 : chosenDecision === 'SHORT' ? -confidence / 100 : 0.42;

      const signal: SignalEvent = {
        id: 'sig-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        timestamp: timeStr,
        timeMs: Date.now(),
        symbol: randomSymbol,
        decision: chosenDecision,
        confidence,
        changePercent: parseFloat(change.toFixed(2)),
        price: 0,
      };

      this.emit(signal);
    };

    this.intervalId = window.setInterval(generateDecision, this.speedMs);
  }

  public stop() {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
  }

  public toggle() {
    if (this.isRunning) {
      this.stop();
    } else {
      this.start();
    }
    return this.isRunning;
  }

  public setSpeed(ms: number) {
    this.speedMs = ms;
    if (this.isRunning && this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.start();
    }
  }

  public getIsRunning() {
    return this.isRunning;
  }
}

export const signalEmitter = new SignalEventEmitter();
