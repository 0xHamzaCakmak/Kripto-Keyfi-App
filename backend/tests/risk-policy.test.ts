import { describe, expect, it } from 'vitest';
import { effectiveAutonomousPositionLimits } from '../src/modules/trading/risk.service.js';

describe('effective autonomous position limits', () => {
  it('honors the admin value for PAPER and keeps TESTNET/LIVE capped', () => {
    expect(effectiveAutonomousPositionLimits(5, 100)).toEqual({ paper: 100, futuresTestnet: 5, live: 5 });
    expect(effectiveAutonomousPositionLimits(40, 80)).toEqual({ paper: 80, futuresTestnet: 20, live: 15 });
    expect(effectiveAutonomousPositionLimits(10, 25)).toEqual({ paper: 25, futuresTestnet: 10, live: 10 });
  });
});
