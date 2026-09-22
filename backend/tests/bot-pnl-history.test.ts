import { expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ snapshot: vi.fn().mockRejectedValue(new Error('offline')) }));
vi.mock('../src/database/prisma.js', () => ({ prisma: {
  exchangeAccount: { findFirst: vi.fn().mockResolvedValue({ id: 'a' }) },
  tradingBot: { findMany: vi.fn().mockResolvedValue([{ id: 'b', symbol: 'ETHUSDT', configuration: {}, startingPaperBalance: '1000' }]) },
  tradingBotDecision: { findMany: vi.fn().mockResolvedValue([]) },
  tradingOrder: { findMany: vi.fn().mockResolvedValue([]) },
  testnetExecutionFill: { findMany: vi.fn().mockResolvedValue([]) },
} }));
vi.mock('../src/modules/ai-trading/autonomous-admin.service.js', () => ({ autonomousDTO: (kind: string, data: unknown) => ({ kind, data }) }));
vi.mock('../src/modules/trading/exchange-account.service.js', () => ({ adapterFor: () => ({ getUserTrades: vi.fn().mockResolvedValue([]) }), exchangeCall: (fn: () => unknown) => fn() }));
vi.mock('../src/modules/trading/trading-engine.client.js', () => ({ getTradingEngineSnapshot: m.snapshot }));
import { syncTestnetBotPnlHistory } from '../src/modules/ai-trading/testnet-operations.service.js';
it('history-only sync does not require the position execution engine', async () => {
  expect(await syncTestnetBotPnlHistory('u', 'a')).toBe(true);
  expect(m.snapshot).not.toHaveBeenCalled();
});
