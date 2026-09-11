import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ execute: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock('../src/database/prisma.js', () => ({ prisma: { $executeRaw: mocks.execute } }));
vi.mock('../src/utils/logger.js', () => ({ logger: { info: mocks.info, error: mocks.error } }));
import { runDailyMaintenance, scheduleDailyMaintenance } from '../src/utils/daily-maintenance.js';

describe('persistent daily maintenance', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  afterEach(() => { vi.useRealTimers(); });

  it('runs only for the worker that atomically claims the next 24 hours', async () => {
    let claimed = false;
    mocks.execute.mockImplementation(async (sql: TemplateStringsArray) => {
      const text = sql.join('?');
      if (text.includes('AND nextRunAt <= UTC_TIMESTAMP(3)')) {
        expect(text).toContain('INTERVAL 1 DAY');
        if (claimed) return 0;
        claimed = true;
      }
      return 1;
    });
    const task = vi.fn().mockResolvedValue({ deleted: 123 });
    expect((await Promise.all([runDailyMaintenance('trading retention', task), runDailyMaintenance('trading retention', task)])).sort()).toEqual([false, true]);
    // A new invocation after a process restart still uses the persisted claim.
    expect(await runDailyMaintenance('trading retention', task)).toBe(false);
    expect(task).toHaveBeenCalledTimes(1);
    expect(mocks.info).toHaveBeenCalledWith({ job: 'trading retention', result: { deleted: 123 } }, 'daily trading retention completed');
  });

  it('never starts deletion when the schedule table is unavailable', async () => {
    mocks.execute.mockRejectedValue(new Error('missing migration'));
    const task = vi.fn();
    await expect(runDailyMaintenance('news retention', task)).rejects.toThrow('missing migration');
    expect(task).not.toHaveBeenCalled();
  });

  it('records failure without releasing the daily claim for repeated deletion', async () => {
    mocks.execute.mockResolvedValue(1);
    await expect(runDailyMaintenance('news retention', async () => { throw new Error('DB down'); })).rejects.toThrow('DB down');
    const lastQuery = mocks.execute.mock.calls.at(-1)![0].join('?');
    expect(lastQuery).toContain("status = 'FAILED'");
    expect(lastQuery).not.toContain('nextRunAt');
  });

  it('does not overlap a slow job and stops polling on shutdown', async () => {
    vi.useFakeTimers();
    mocks.execute.mockResolvedValue(1);
    let resolveTask!: () => void;
    const task = vi.fn(() => new Promise<void>((resolve) => { resolveTask = resolve; }));
    const stop = scheduleDailyMaintenance('trading retention', task);
    await vi.advanceTimersByTimeAsync(180_000);
    expect(task).toHaveBeenCalledTimes(1);
    stop();
    resolveTask();
    await vi.advanceTimersByTimeAsync(180_000);
    expect(task).toHaveBeenCalledTimes(1);
  });
});
