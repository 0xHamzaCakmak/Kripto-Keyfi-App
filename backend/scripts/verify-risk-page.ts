import { prisma } from '../src/database/prisma.js';
import { getRiskProfile } from '../src/modules/trading/risk.service.js';

try {
  const account = await prisma.exchangeAccount.findFirst({ where: { isActive: true }, select: { id: true, userId: true } });
  if (!account) throw new Error('Aktif hesap bulunamadı.');
  const risk = await getRiskProfile(account.userId, account.id);
  console.log(JSON.stringify({ loaded: Boolean(risk.id), entryPaused: typeof risk.entryPaused === 'boolean', accountId: risk.exchangeAccountId === account.id }));
} finally { await prisma.$disconnect(); }
