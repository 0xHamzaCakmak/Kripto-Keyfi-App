import { prisma } from '../../database/prisma.js';

export type TradingModuleOverview = {
  moduleStatus: 'PHASE_THREE_READY';
  engineStatus: 'MANUAL_REST_READY';
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
    moduleStatus: 'PHASE_THREE_READY',
    engineStatus: 'MANUAL_REST_READY',
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
    ],
    nextPhaseItems: [
      'Add market and account WebSocket streams',
      'Add reconnect and heartbeat handling',
      'Stream live updates to the admin frontend',
      'Reconcile uncertain and stale orders',
    ],
  };
}
