import { prisma } from '../../database/prisma.js';

export type TradingModuleOverview = {
  moduleStatus: 'PHASE_FOUR_REALTIME_READY';
  engineStatus: 'PRIVATE_STREAM_READY';
  liveTradingEnabled: false;
  globalKillSwitch: false;
  connectedExchangeCount: number;
  activeBotCount: number;
  openPositionCount: null;
  openOrderCount: null;
  environments: readonly ['BINANCE_TESTNET', 'BYBIT_DEMO'];
  completedFoundationItems: readonly string[];
  nextPhaseItems: readonly string[];
};

export async function getTradingOverview(userId: string): Promise<TradingModuleOverview> {
  const connectedExchangeCount = await prisma.exchangeAccount.count({ where: { userId, isActive: true, connectionStatus: 'CONNECTED' } });
  return {
    moduleStatus: 'PHASE_FOUR_REALTIME_READY',
    engineStatus: 'PRIVATE_STREAM_READY',
    liveTradingEnabled: false,
    globalKillSwitch: false,
    connectedExchangeCount,
    activeBotCount: 0,
    openPositionCount: null,
    openOrderCount: null,
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
    ],
    nextPhaseItems: [
      'Reconcile uncertain and stale orders',
      'Recover exchange state after engine restart',
      'Add Bybit private account WebSocket',
      'Add risk engine and global kill switch',
    ],
  };
}
