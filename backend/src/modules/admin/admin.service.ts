import { countUsers } from '../users/user.service.js';
import { prisma } from '../../database/prisma.js';

export async function getDashboard() {
  const [userCount, connectedExchangeCount] = await Promise.all([
    countUsers(),
    prisma.exchangeAccount.count({ where: { isActive: true, connectionStatus: 'CONNECTED' } }),
  ]);
  return {
    userCount,
    activeBotCount: 0,
    connectedExchangeCount,
    systemStatus: 'OPERATIONAL' as const,
  };
}
