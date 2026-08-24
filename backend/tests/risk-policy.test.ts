import { describe, expect, it } from 'vitest';
import { effectiveAutonomousPositionLimits } from '../src/modules/trading/risk.service.js';

describe('effective autonomous position limits', () => {
  it('honors the admin value for PAPER and keeps TESTNET/LIVE capped', () => {
    expect(effectiveAutonomousPositionLimits(100)).toEqual({ paper: 100, futuresTestnet: 15, live: 15 });
    expect(effectiveAutonomousPositionLimits(40)).toEqual({ paper: 40, futuresTestnet: 15, live: 15 });
    expect(effectiveAutonomousPositionLimits(10)).toEqual({ paper: 10, futuresTestnet: 10, live: 10 });
  });
});
