import { beforeEach, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
const m = vi.hoisted(() => ({ account: vi.fn(), list: vi.fn() }));
vi.mock('../src/modules/trading/exchange-account.service.js', () => ({ ownedAccount: m.account }));
vi.mock('../src/database/prisma.js', () => ({ prisma: { tradingBot: { findMany: m.list } } }));
import { getProChampions } from '../src/modules/ai-trading/pro-champions.service.js';
const decimal = (value: number) => new Prisma.Decimal(value);
const metric = (score = 80) => ({ score: decimal(score), totalTrades: 10, wins: 6, netPnl: decimal(25), startingBalance: decimal(100), maxDrawdown: decimal(0.05), snapshotAt: new Date('2026-09-14T08:00:00Z'), metrics: { profitFactor: 1.5, sharpe: 0.8 } });
const bot = (id: string, metrics: unknown[] = []) => ({ id, name: id, symbol: 'BTCUSDT', state: 'STOPPED', lifecycleStatus: 'ACTIVE', generation: { number: 1 }, strategyVersion: { strategy: { name: 'Momentum' } }, metrics });
beforeEach(() => { vi.resetAllMocks(); m.account.mockResolvedValue({ id: 'account' }); });
it('returns all account bots including unmeasured bots without a top-five limit', async () => {
  m.list.mockResolvedValue(Array.from({ length: 20 }, (_, i) => bot(`bot-${i}`)));
  const result = await getProChampions('user', 'account');
  expect(result.rows).toHaveLength(20);
  expect(result.rows.every(row => row.rank === null && row.score === null && row.roi === null)).toBe(true);
  expect(m.account).toHaveBeenCalledWith('user', 'account');
  expect(m.list).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user', exchangeAccountId: 'account', type: 'AUTONOMOUS', mode: 'DEMO', lifecycleStatus: { not: 'ARCHIVED' } } }));
  expect(m.list.mock.calls[0]?.[0].take).toBeUndefined();
});
it('ranks scores with shared ranks and converts stored returns to percentages', async () => {
  m.list.mockResolvedValue([bot('none'), bot('low', [metric(20)]), bot('best-b', [metric()]), bot('best-a', [metric()])]);
  const { rows } = await getProChampions('user', 'account');
  expect(rows.map(row => row.rank)).toEqual([1, 1, 3, null]);
  expect(rows[0]).toMatchObject({ roi: 25, winRate: 60, maxDrawdown: 5, profitFactor: 1.5, sharpe: 0.8, netPnl: 25 });
});
it('does not treat an empty metric as evidence or invent missing ratios', async () => {
  m.list.mockResolvedValue([bot('empty', [{ ...metric(), totalTrades: 0 }]), bot('partial', [{ ...metric(), startingBalance: decimal(0), metrics: {} }])]);
  const { rows } = await getProChampions('user', 'account');
  expect(rows.find(row => row.id === 'empty')).toMatchObject({ score: null, rank: null, netPnl: null });
  expect(rows.find(row => row.id === 'partial')).toMatchObject({ roi: null, profitFactor: null, sharpe: null });
});
it('checks ownership before reading bot performance', async () => {
  m.account.mockRejectedValue(new Error('forbidden'));
  await expect(getProChampions('user', 'other-account')).rejects.toThrow('forbidden');
  expect(m.list).not.toHaveBeenCalled();
});
