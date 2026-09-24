import { expect, it } from 'vitest';
import { arenaHistoryQuery } from '../src/modules/ai-trading/arena-query-budget.js';

it('limits simultaneous history reads and releases capacity after failures', async () => {
  let running = 0;
  let peak = 0;
  const results = await Promise.allSettled(Array.from({ length: 40 }, (_, i) => arenaHistoryQuery(async () => {
    running++;
    peak = Math.max(peak, running);
    await new Promise(resolve => setTimeout(resolve, 1));
    running--;
    if (i === 0) throw new Error('Database unavailable');
    return i;
  })));
  expect(peak).toBe(2);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(39);
  expect(await arenaHistoryQuery(async () => 'recovered')).toBe('recovered');
});
