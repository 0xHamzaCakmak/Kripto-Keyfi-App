import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ account: vi.fn(), bots: vi.fn(), bot: vi.fn() }));
vi.mock('../src/database/prisma.js', () => ({ prisma: { exchangeAccount: { findFirst: mocks.account }, tradingBot: { findMany: mocks.bots, findFirst: mocks.bot } } }));
vi.mock('../src/modules/ai-trading/autonomous-admin.service.js', () => ({ autonomousDTO: (kind: string, data: unknown) => ({ kind, data }) }));
vi.mock('../src/modules/trading/exchange-account.service.js', () => ({ adapterFor: vi.fn(), exchangeCall: vi.fn() }));
vi.mock('../src/modules/trading/trading-engine.client.js', () => ({ getTradingEngineSnapshot: vi.fn() }));
import { listTestnetBotOperations, getTestnetBotOperation } from '../src/modules/ai-trading/testnet-operations.service.js';

describe('TESTNET operations account scope', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.account.mockImplementation(async ({ where }) => ({ id: where.id })); mocks.bots.mockResolvedValue([]); });
  it('isolates caches and exchange queries by user and selected account', async () => {
    await listTestnetBotOperations('scope-user', 'account-a');
    await listTestnetBotOperations('scope-user', 'account-b');
    await listTestnetBotOperations('scope-user', 'account-a');
    expect(mocks.account).toHaveBeenCalledTimes(2);
    for (const id of ['account-a', 'account-b']) expect(mocks.account).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'scope-user', id, isActive: true, environment: 'TESTNET' }) }));
    expect(mocks.bots.mock.calls.map(([query]) => query.where.exchangeAccountId)).toEqual(['account-a', 'account-b']);
  });
  it('does not fall back to another account when the requested account is unavailable', async () => {
    mocks.account.mockResolvedValue(null);
    expect((await listTestnetBotOperations('missing-user', 'missing-account')).data).toEqual([]);
    expect(mocks.bots).not.toHaveBeenCalled();
  });
  it('resolves bot detail using the owned bot account rather than the first account', async () => {
    mocks.bot.mockResolvedValue({ exchangeAccountId: 'detail-account' });
    await expect(getTestnetBotOperation('detail-user', 'bot-id')).rejects.toThrow('TESTNET bot operasyon kaydı');
    expect(mocks.bot).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'bot-id', userId: 'detail-user', mode: 'DEMO' } }));
    expect(mocks.account).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'detail-account', userId: 'detail-user' }) }));
  });
});
