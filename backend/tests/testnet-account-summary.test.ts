import { describe, expect, it } from 'vitest';
import { fixedTestnetPerformance, TESTNET_STARTING_BALANCE_USD } from '../src/modules/ai-trading/testnet-operations.service.js';

describe('TESTNET account summary', () => {
  it('measures profit from the fixed 10,000 USD stablecoin baseline', () => {
    expect(TESTNET_STARTING_BALANCE_USD).toBe(10_000);
    expect(fixedTestnetPerformance(9_900, 150)).toEqual({
      startingBalance: 10_000,
      walletPnl: -100,
      openPnl: 150,
      netPnl: 50,
      pnlPercent: 0.005,
    });
  });
});
