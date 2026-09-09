import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  constraints: vi.fn(),
  decisions: { findMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
  signals: { findMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
  outbox: { findMany: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
}));
vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../src/utils/logger.js', () => ({ logger: { info: vi.fn(), error: vi.fn() } }));
vi.mock('../src/database/prisma.js', () => ({ prisma: {
  $queryRaw: mocks.constraints,
  tradingBotDecision: mocks.decisions, tradingBotSignal: mocks.signals, tradingOutboxEvent: mocks.outbox,
} }));
import { deleteExpiredAutonomousDecisions, previewTradingRetention, retentionFilters } from '../src/modules/ai-trading/decision-retention.service.js';
const now = new Date('2026-09-09T12:00:00Z');
const cutoff = new Date('2026-09-08T12:00:00Z');
describe('trading retention', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.constraints.mockResolvedValue([{ DELETE_RULE: 'SET NULL' }, { DELETE_RULE: 'SET NULL' }]);
    for (const mock of [mocks.decisions, mocks.signals, mocks.outbox]) {
      mock.findMany.mockResolvedValue([]); mock.deleteMany.mockResolvedValue({ count: 1 }); mock.count.mockResolvedValue(7);
    }
  });
  it('expires only old autonomous data, including orphaned signals, without deleting performance evidence', async () => {
    mocks.signals.findMany.mockResolvedValueOnce([{ id: 11n }]);
    mocks.decisions.findMany.mockResolvedValueOnce([{ id: 12n }]);
    const result = await deleteExpiredAutonomousDecisions(now);
    expect(mocks.signals.deleteMany).toHaveBeenCalledWith({ where: {
      tradingBot: { type: 'AUTONOMOUS' }, createdAt: { lt: cutoff }, id: { in: [11n] },
    } });
    expect(mocks.decisions.deleteMany).toHaveBeenCalledWith({ where: {
      type: 'AUTONOMOUS', occurredAt: { lt: cutoff }, createdAt: { lt: cutoff }, id: { in: [12n] },
    } });
    // No paper/shadow/order model exists in the mock: any access would fail this test.
    expect(result).toMatchObject({ deletedDecisions: 1, deletedSignals: 1 });
  });
  it('restricts outbox deletion to disposable event types and rechecks age when deleting', async () => {
    mocks.outbox.findMany.mockResolvedValueOnce([{ id: 20n }]);
    await deleteExpiredAutonomousDecisions(now);
    expect(mocks.outbox.deleteMany).toHaveBeenCalledWith({ where: {
      eventType: 'BOT_PAPER_DECISION', createdAt: { lt: cutoff }, id: { in: [20n] },
    } });
    expect(mocks.outbox.findMany.mock.calls.map(([arg]) => arg.where.eventType)).toEqual([
      'BOT_PAPER_DECISION', 'BOT_PAPER_DECISION', 'BOT_SHADOW_DECISION', 'SNAPSHOT_RECONCILED', 'BOT_STATE_CHANGED',
    ]);
  });
  it('previews the same filters without mutations', async () => {
    expect(await previewTradingRetention(now)).toEqual({ cutoff, decisions: 7, signals: 7, outbox: 7 });
    expect(mocks.decisions.count).toHaveBeenCalledWith({ where: retentionFilters(now).decisions });
    for (const mock of [mocks.decisions, mocks.signals, mocks.outbox]) expect(mock.deleteMany).not.toHaveBeenCalled();
  });
  it('continues across batches and propagates a failed delete for scheduler logging/retry', async () => {
    mocks.decisions.findMany.mockResolvedValueOnce([{ id: 1n }]).mockResolvedValueOnce([{ id: 2n }]);
    mocks.decisions.deleteMany.mockResolvedValueOnce({ count: 1 }).mockRejectedValueOnce(new Error('database unavailable'));
    await expect(deleteExpiredAutonomousDecisions(now)).rejects.toThrow('database unavailable');
    expect(mocks.decisions.deleteMany).toHaveBeenCalledTimes(2);
    expect(mocks.outbox.deleteMany).not.toHaveBeenCalled();
  });
  it('refuses all deletion if the protective migration has not been applied', async () => {
    mocks.constraints.mockResolvedValue([{ DELETE_RULE: 'CASCADE' }, { DELETE_RULE: 'CASCADE' }]);
    await expect(deleteExpiredAutonomousDecisions(now)).rejects.toThrow('migration');
    for (const mock of [mocks.decisions, mocks.signals, mocks.outbox]) expect(mock.deleteMany).not.toHaveBeenCalled();
  });
  it('stops a competing-worker batch when no rows remain', async () => {
    mocks.decisions.findMany.mockResolvedValue([{ id: 1n }]);
    mocks.decisions.deleteMany.mockResolvedValue({ count: 0 });
    expect((await deleteExpiredAutonomousDecisions(now)).deletedDecisions).toBe(0);
    expect(mocks.decisions.findMany).toHaveBeenCalledTimes(1);
  });
});
