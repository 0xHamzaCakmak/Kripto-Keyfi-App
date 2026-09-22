import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ownedAccount } from './exchange-account.service.js';

export type PnlEntry = { sourceId: string; botId: string; occurredAt: Date; net: string; feesComplete: boolean; symbol?: string; leverage?: number; tradeNotional?: string; source?: string };
export type PnlDetail = PnlEntry & { symbol: string | null; leverage: number | null; tradeNotional: string | null; source: string | null };
type Period = { resetAt: Date | null };
export const BOT_PNL_ACCOUNTING_START = new Date('2026-07-01T00:00:00+03:00');
export const dayKey = (date: Date) => new Date(date.getTime() + 3 * 3600000).toISOString().slice(0, 10);
export function summarizePnl(start: string, end: string, entries: PnlEntry[]) {
  const days: Array<{ date: string; count: number; profit: string; loss: string; net: string | null }> = [];
  let total = new Prisma.Decimal(0), complete = true;
  const grouped = new Map<string, PnlEntry[]>();
  for (const row of entries) { const key = dayKey(row.occurredAt); grouped.set(key, [...(grouped.get(key) ?? []), row]); }
  for (let time = Date.parse(`${start}T00:00:00Z`); time <= Date.parse(`${end}T00:00:00Z`); time += 86400000) {
    const date = new Date(time).toISOString().slice(0, 10), rows = grouped.get(date) ?? [];
    let profit = new Prisma.Decimal(0), loss = new Prisma.Decimal(0);
    for (const row of rows) { const n = new Prisma.Decimal(row.net); if (n.gt(0)) profit = profit.add(n); else loss = loss.add(n); }
    const known = rows.every(row => row.feesComplete), net = profit.add(loss);
    complete &&= known; total = total.add(net);
    days.push({ date, count: rows.length, profit: profit.toFixed(), loss: loss.toFixed(), net: known ? net.toFixed() : null });
  }
  return { days, totalNet: complete ? total.toFixed() : null };
}

async function lockPeriod(tx: Prisma.TransactionClient, userId: string, accountId: string) {
  await tx.exchangeAccount.update({ where: { id: accountId, userId }, data: { updatedAt: new Date() } });
  await tx.$executeRaw`INSERT IGNORE INTO bot_pnl_periods (exchangeAccountId,userId) VALUES (${accountId},${userId})`;
  const rows = await tx.$queryRaw<Period[]>`SELECT resetAt FROM bot_pnl_periods WHERE exchangeAccountId=${accountId} AND userId=${userId}`;
  return rows[0]?.resetAt ?? null;
}
export async function recordBotPnl(userId: string, accountId: string, entries: PnlEntry[]) {
  if (!entries.length) return;
  await prisma.$transaction(async tx => {
    const resetAt = await lockPeriod(tx, userId, accountId);
    for (const row of entries) {
      if (row.occurredAt < BOT_PNL_ACCOUNTING_START || (resetAt && row.occurredAt <= resetAt)) continue;
      await tx.$executeRaw`INSERT INTO bot_pnl_entries (exchangeAccountId,sourceId,userId,botId,occurredAt,net,feesComplete,symbol,leverage,tradeNotional,source)
        VALUES (${accountId},${row.sourceId},${userId},${row.botId},${row.occurredAt},${row.net},${row.feesComplete},${row.symbol ?? null},${row.leverage ?? null},${row.tradeNotional ?? null},${row.source ?? null})
        ON DUPLICATE KEY UPDATE net=VALUES(net), feesComplete=VALUES(feesComplete), symbol=COALESCE(VALUES(symbol),symbol), leverage=COALESCE(VALUES(leverage),leverage), tradeNotional=COALESCE(VALUES(tradeNotional),tradeNotional), source=COALESCE(VALUES(source),source)`;
    }
  }, { timeout: 30000 });
}
export async function getPnlDayDetails(userId: string, accountId: string, date: string) {
  await ownedAccount(userId, accountId);
  const from = new Date(`${date}T00:00:00+03:00`), to = new Date(from.getTime() + 86400000);
  const rows = await prisma.$queryRaw<Array<PnlDetail>>`SELECT sourceId,botId,occurredAt,CAST(net AS CHAR) AS net,feesComplete,symbol,leverage,CAST(tradeNotional AS CHAR) AS tradeNotional,source FROM bot_pnl_entries WHERE userId=${userId} AND exchangeAccountId=${accountId} AND occurredAt>=${from} AND occurredAt<${to} ORDER BY occurredAt DESC,sourceId DESC`;
  const visible = rows.filter(row => row.occurredAt >= BOT_PNL_ACCOUNTING_START);
  const profit = visible.filter(row => new Prisma.Decimal(row.net).gt(0));
  const loss = visible.filter(row => new Prisma.Decimal(row.net).lt(0));
  const sum = (items: PnlDetail[], field: 'net' | 'tradeNotional') => items.reduce((total, row) => total.add(row[field] ?? 0), new Prisma.Decimal(0)).toFixed();
  return { exchangeAccountId: accountId, date, profits: profit, losses: loss, summary: { totalTrades: visible.length, totalNotional: sum(visible, 'tradeNotional'), totalProfit: sum(profit, 'net'), totalLoss: sum(loss, 'net'), totalNet: sum(visible, 'net') } };
}
export async function getBotPnl(userId: string, accountId: string, start: string, end: string) {
  await ownedAccount(userId, accountId);
  const [periods, entries] = await Promise.all([
    prisma.$queryRaw<Period[]>`SELECT resetAt FROM bot_pnl_periods WHERE exchangeAccountId=${accountId} AND userId=${userId}`,
    prisma.$queryRaw<Array<PnlEntry>>`SELECT sourceId,botId,occurredAt,CAST(net AS CHAR) AS net,feesComplete FROM bot_pnl_entries WHERE userId=${userId} AND exchangeAccountId=${accountId} AND occurredAt>=${new Date(Math.max(BOT_PNL_ACCOUNTING_START.getTime(), new Date(`${start}T00:00:00+03:00`).getTime()))} AND occurredAt<${new Date(new Date(`${end}T00:00:00+03:00`).getTime() + 86400000)}`,
  ]);
  return { exchangeAccountId: accountId, start, end, timezone: 'Europe/Istanbul', accountingStartsAt: '2026-07-01', resetAt: periods[0]?.resetAt?.toISOString() ?? null, ...summarizePnl(start, end, entries) };
}
export async function resetBotPnl(userId: string, accountId: string) {
  await ownedAccount(userId, accountId);
  return prisma.$transaction(async tx => {
    await lockPeriod(tx, userId, accountId);
    const resetAt = new Date();
    await tx.$executeRaw`DELETE FROM bot_pnl_entries WHERE userId=${userId} AND exchangeAccountId=${accountId}`;
    await tx.$executeRaw`UPDATE bot_pnl_periods SET resetAt=${resetAt} WHERE userId=${userId} AND exchangeAccountId=${accountId}`;
    await tx.tradingAuditLog.create({ data: { userId, exchangeAccountId: accountId, action: 'BOT_PNL_RESET', entityType: 'BOT_PNL_PERIOD', entityId: accountId, metadata: { resetAt: resetAt.toISOString() } } });
    return { resetAt: resetAt.toISOString(), exchangeAccountId: accountId };
  });
}
