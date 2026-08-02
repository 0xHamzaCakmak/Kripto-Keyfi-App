import { prisma } from '../../database/prisma.js';
import { env } from '../../config/env.js';

export type TradingModuleOverview = {
  moduleStatus: 'TRADING_ADMIN_READY';
  engineStatus: 'READY' | 'UNAVAILABLE';
  liveTradingEnabled: false;
  globalKillSwitch: boolean;
  connectedExchangeCount: number;
  activeBotCount: number;
  openPositionCount: null;
  openOrderCount: number;
  environments: readonly ['BINANCE_TESTNET', 'BYBIT_DEMO'];
  completedFoundationItems: readonly string[];
  nextPhaseItems: readonly string[];
};

export async function getTradingOverview(userId: string): Promise<TradingModuleOverview> {
  const [connectedExchangeCount, activeBotCount, globalControl, openOrderCount, engineStatus] = await Promise.all([
    prisma.exchangeAccount.count({ where: { userId, isActive: true, connectionStatus: 'CONNECTED' } }),
    prisma.tradingBot.count({ where: { userId, state: { in: ['STARTING', 'RUNNING', 'RECONCILING'] } } }),
    prisma.tradingRiskControl.findUnique({ where: { id: 'global' }, select: { globalKillSwitch: true } }),
    prisma.tradingOrder.count({ where: { userId, status: { in: ['PENDING', 'SUBMITTING', 'OPEN', 'PARTIALLY_FILLED', 'CANCELING'] } } }),
    readEngineStatus(),
  ]);
  return {
    moduleStatus: 'TRADING_ADMIN_READY',
    engineStatus,
    liveTradingEnabled: false,
    globalKillSwitch: globalControl?.globalKillSwitch ?? true,
    connectedExchangeCount,
    activeBotCount,
    openPositionCount: null,
    openOrderCount,
    environments: ['BINANCE_TESTNET', 'BYBIT_DEMO'],
    completedFoundationItems: [
      'Admin-only backend authorization',
      'Admin navigation and responsive sidebar',
      'Trading module status endpoint',
      'Live trading safety lock',
      'AES-256-GCM credential vault',
      'Owned multi-exchange account storage',
      'Binance Futures testnet adapter',
      'Bybit V5 demo adapter',
      'Dynamic symbol, leverage and margin rules',
      'Two-step manual order confirmation',
      'Idempotent testnet order submission',
      'Open orders, positions and reduce-only close',
      'Secret-free trading audit trail',
      'Durable trading event outbox',
      'Binance private account WebSocket',
      'Reconnect, heartbeat and listen-key renewal',
      'Authenticated SSE frontend updates',
      'Live submitting, canceling and closing states',
      'SCALPING and GRID shadow/paper scheduler',
      'Paper fill, position and PnL ledger',
      'Admin risk management and system status',
      'Versioned AI observer shadow comparison',
      'Persistent futures grid plan preview and details',
    ],
    nextPhaseItems: [
      'Add Bybit private account WebSocket',
      'Add AI signal outcome quality ledger',
      'Add spot inventory grid and multi-level crossing fills',
      'Run limited Binance Demo bot acceptance',
    ],
  };
}

async function readEngineStatus(): Promise<'READY' | 'UNAVAILABLE'> {
  try {
    const response = await fetch(`${env.TRADING_ENGINE_URL}/health/ready`, { signal: AbortSignal.timeout(1500) });
    return response.ok ? 'READY' : 'UNAVAILABLE';
  } catch {
    return 'UNAVAILABLE';
  }
}
