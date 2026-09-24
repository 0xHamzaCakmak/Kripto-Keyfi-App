import { expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ universe: vi.fn(), botGroup: vi.fn(), decisionGroup: vi.fn(), decisionList: vi.fn(), signalList: vi.fn() }));
vi.mock('../src/database/prisma.js', () => ({ prisma: {
  tradingUniverseAsset: { findMany: m.universe },
  tradingBot: { groupBy: m.botGroup, findFirst: vi.fn().mockResolvedValue(null) },
  tradingBotDecision: { groupBy: m.decisionGroup, findMany: m.decisionList, count: vi.fn().mockResolvedValue(100), findFirst: vi.fn().mockResolvedValue(null) },
  tradingBotSignal: { findMany: m.signalList },
} }));
import { getArenaStatus } from '../src/modules/ai-trading/autonomous-admin.service.js';
it('reads the newest record independently for every configured recorded pair', async () => {
  const symbols = Array.from({ length: 20 }, (_, i) => ({ symbol: `COIN${i}USDT` }));
  m.universe.mockResolvedValue(symbols);
  m.botGroup.mockResolvedValue([]);
  m.decisionGroup.mockResolvedValue(symbols);
  m.decisionList.mockImplementation(async ({ where }) => [{ id: 1n, tradingBotId: 'bot', symbol: where.symbol, kind: 'HOLD', summary: 'real', occurredAt: new Date(), tradingBot: { name: 'Bot' }, signals: [] }]);
  m.signalList.mockResolvedValue([]);
  const [first, second] = await Promise.all([getArenaStatus('user', 'account'), getArenaStatus('user', 'account')]);
  const { data } = first;
  expect(second).toBe(first);
  expect(await getArenaStatus('user', 'account')).toBe(first);
  expect(m.universe).toHaveBeenCalledTimes(1);
  expect(data.recentDecisions).toHaveLength(20);
  expect(new Set(data.recentDecisions.map(row => row.symbol)).size).toBe(20);
  expect(data.botSymbols).toHaveLength(20);
  for (const [query] of m.decisionList.mock.calls) {
    expect(query.where).toMatchObject({ userId: 'user', exchangeAccountId: 'account', mode: 'DEMO' });
    expect(query.take).toBe(1);
    expect(query.orderBy).toEqual([{ occurredAt: 'desc' }, { id: 'desc' }]);
  }
  expect(data.decisionCoverage).toEqual({ configured: 20, observed: 20 });
});

it('keeps account caches separate and does not cache failed reads', async () => {
  m.universe.mockRejectedValueOnce(new Error('database busy'));
  await expect(getArenaStatus('other-user', 'other-account')).rejects.toThrow('database busy');
  m.universe.mockResolvedValue([]);
  m.decisionGroup.mockResolvedValue([]);
  const result = await getArenaStatus('other-user', 'other-account');
  expect(result.data.botSymbols).toEqual([]);
  expect(m.universe).toHaveBeenLastCalledWith(expect.objectContaining({ where: { userId: 'other-user', enabled: true } }));
});
