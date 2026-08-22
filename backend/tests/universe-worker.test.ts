import { describe, expect, it } from 'vitest';
import { automaticCapitalScaleTarget, botAllocationUsdt, fleetLeverage, rotationPending, staleAutonomousProtection, TESTNET_ROTATION_SETTLE_MS, universeCandidate } from '../src/modules/ai-trading/universe.worker.js';

describe('autonomous Futures universe', () => {
  it('rotates a cohort deterministically across the full symbol list', () => {
    const symbols = Array.from({ length: 120 }, (_, index) => `COIN${index}USDT`);
    const first = Array.from({ length: 100 }, (_, index) => universeCandidate(symbols, 0, index, 100));
    const second = Array.from({ length: 100 }, (_, index) => universeCandidate(symbols, 1, index, 100));
    expect(new Set(first).size).toBe(100);
    expect(second).not.toEqual(first);
    expect(new Set([...first, ...second]).size).toBe(120);
  });

  it('spreads fleet leverage from 5x through 20x', () => {
    const values = Array.from({ length: 15 }, (_, index) => fleetLeverage(index, 15));
    expect(values[0]).toBe(5);
    expect(values.at(-1)).toBe(20);
    expect(values.every((value) => value >= 5 && value <= 20)).toBe(true);
  });

  it('cleans only bot-owned protection on symbols without positions', () => {
    const base = { exchangeOrderId: '1', clientOrderId: 'ka12345678x', symbol: 'OLDUSDT', side: 'SELL' as const, status: 'OPEN', quantity: '1', executedQuantity: '0', reduceOnly: true };
    expect(staleAutonomousProtection({ ...base, type: 'STOP_MARKET' }, new Set(['BTCUSDT']))).toBe(true);
    expect(staleAutonomousProtection({ ...base, symbol: 'BTCUSDT', type: 'STOP_MARKET' }, new Set(['BTCUSDT']))).toBe(false);
    expect(staleAutonomousProtection({ ...base, clientOrderId: 'manual', type: 'STOP_MARKET' }, new Set())).toBe(false);
    expect(staleAutonomousProtection({ ...base, type: 'MARKET' }, new Set())).toBe(false);
  });

  it('recognizes the two-phase TESTNET rotation marker', () => {
    expect(rotationPending({ universeRotationPending: true })).toBe(true);
    expect(rotationPending({ universeRotationPending: false })).toBe(false);
    expect(rotationPending(null)).toBe(false);
    expect(TESTNET_ROTATION_SETTLE_MS).toBe(15_000);
  });

  it('preserves manual capital and scales only profitable bots with enough evidence', () => {
    expect(botAllocationUsdt({ allocationUsdt: 175 })).toBe(175);
    expect(botAllocationUsdt({ allocationUsdt: 500 })).toBe(100);
    expect(automaticCapitalScaleTarget(100, 100, 200, 101)).toBe(200);
    expect(automaticCapitalScaleTarget(100, 100, 199, 150)).toBe(100);
    expect(automaticCapitalScaleTarget(100, 100, 500, 99)).toBe(100);
  });
});
