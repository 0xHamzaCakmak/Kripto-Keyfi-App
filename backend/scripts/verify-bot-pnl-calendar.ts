import { prisma } from '../src/database/prisma.js';
import { dayKey, getBotPnl, getPnlDayDetails } from '../src/modules/trading/bot-pnl.service.js';
import { pnlQuery } from '../src/modules/trading/bot-pnl.routes.js';
import { syncPlatformPnlHistory } from '../src/modules/trading/platform-pnl-sync.js';

// Read exchange history and materialize report entries only; never reset or submit orders.
try {
  const account = await prisma.exchangeAccount.findFirst({ where: { isActive: true, environment: { in: ['TESTNET', 'DEMO'] } }, select: { id: true, userId: true } });
  if (!account) throw new Error('No demo account available');
  const today = dayKey(new Date()), start = `${today.slice(0, 7)}-01`;
  const range = pnlQuery.parse({ exchangeAccountId: account.id, start: process.argv[2] ?? start, end: process.argv[3] ?? today });
  const report = await getBotPnl(account.userId, account.id, range.start, range.end);
  if (process.argv.includes('--sync')) {
    console.log(JSON.stringify({ sync: await syncPlatformPnlHistory(account.userId, account.id, range.start, range.end) }));
    const updated = await getBotPnl(account.userId, account.id, range.start, range.end);
    console.log(JSON.stringify({ importedRecords: updated.days.reduce((n, day) => n + day.count, 0), totalNet: updated.totalNet, days: updated.days.filter(day => day.count) }));
    const detail = await getPnlDayDetails(account.userId, account.id, range.end);
    console.log(JSON.stringify({ detailDate: range.end, profitRows: detail.profits.length, lossRows: detail.losses.length, ...detail.summary }));
  }
  console.log(JSON.stringify({ days: report.days.length, records: report.days.reduce((n, day) => n + day.count, 0), totalVerified: report.totalNet !== null, accountingStartsAt: report.accountingStartsAt }));
} finally { await prisma.$disconnect(); }
