import { prisma } from '../../database/prisma.js';

export type TradingModuleOverview = {
  moduleStatus: 'PHASE_TWO_READY';
  engineStatus: 'NOT_CONFIGURED';
  liveTradingEnabled: false;
  globalKillSwitch: true;
  connectedExchangeCount: number;
  activeBotCount: number;
  openPositionCount: number;
  openOrderCount: number;
  environments: readonly ['BINANCE_TESTNET', 'BYBIT_DEMO'];
  completedFoundationItems: readonly string[];
  nextPhaseItems: readonly string[];
};

export async function getTradingOverview(userId: string): Promise<TradingModuleOverview> {
  const connectedExchangeCount = await prisma.exchangeAccount.count({ where: { userId, isActive: true, connectionStatus: 'CONNECTED' } });
  return {
    moduleStatus: 'PHASE_TWO_READY',
    engineStatus: 'NOT_CONFIGURED',
    liveTradingEnabled: false,
    globalKillSwitch: true,
    connectedExchangeCount,
    activeBotCount: 0,
    openPositionCount: 0,
    openOrderCount: 0,
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
    ],
    nextPhaseItems: [
      'Validate test credentials from the admin panel',
      'Verify real testnet balance synchronization',
      'Add symbol and leverage metadata synchronization',
      'Prepare manual order preview',
    ],
  };
}
