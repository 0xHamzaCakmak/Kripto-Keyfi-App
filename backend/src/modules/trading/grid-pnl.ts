import { Prisma } from '@prisma/client';
import type { GridOrderSnapshot } from './grid-demo-exchange.js';
import type { PnlEntry } from './bot-pnl.service.js';
export function gridPnlEntries(botId: string, symbol: string, direction: 'LONG' | 'SHORT', entry: GridOrderSnapshot, exits: GridOrderSnapshot[]): PnlEntry[] {
  if (entry.fillsComplete === false || new Prisma.Decimal(entry.executed).lte(0)) return [];
  const available = new Prisma.Decimal(entry.executed).sub(entry.baseFee);
  if (available.lte(0)) return [];
  return exits.flatMap(exit => (exit.executions ?? []).map(e => {
    const quantity = new Prisma.Decimal(e.quantity);
    const cost = new Prisma.Decimal(entry.quote).mul(quantity).div(entry.executed);
    const gross = e.realizedPnl !== undefined ? new Prisma.Decimal(e.realizedPnl) : direction === 'LONG' ? new Prisma.Decimal(e.quote).sub(cost) : cost.sub(e.quote);
    const fee = new Prisma.Decimal(entry.fee).mul(quantity).div(available).add(e.fee);
    return { sourceId: `grid:${symbol}:${e.id}`, botId, occurredAt: new Date(e.time), net: gross.sub(fee).toFixed(), feesComplete: entry.feesComplete && e.feesComplete };
  }));
}
