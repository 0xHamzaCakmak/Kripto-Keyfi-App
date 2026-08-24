import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { automaticCapitalScaleTarget, botAllocationUsdt, fleetLeverage, PAPER_TRAINING_INTERVAL_SECONDS, PAPER_TRAINING_MAX_OPEN_POSITIONS, PAPER_TRAINING_MIN_INITIAL_MARGIN_USDT, PAPER_TRAINING_MAX_RISK_PER_TRADE_PCT, PAPER_TRAINING_STOP_LOSS_BPS, PAPER_TRAINING_TAKE_PROFIT_BPS, paperTrainingConfiguration, rotationPending, schedulerLeaseActive, staleAutonomousProtection, TESTNET_ROTATION_SETTLE_MS, universeCandidate } from '../src/modules/ai-trading/universe.worker.js';
import { CORE_TRADING_UNIVERSE } from '../src/modules/ai-trading/trading-universe.service.js';
import { tradingUniverseAssetParamsSchema, updateTradingUniverseAssetSchema } from '../src/modules/ai-trading/trading-universe.schema.js';

describe('autonomous Futures universe', () => {
  it('rotates a cohort deterministically across the full symbol list', () => {
    const symbols = Array.from({ length: 120 }, (_, index) => `COIN${index}USDT`);
    const first = Array.from({ length: 100 }, (_, index) => universeCandidate(symbols, 0, index, 100));
    const second = Array.from({ length: 100 }, (_, index) => universeCandidate(symbols, 1, index, 100));
    expect(new Set(first).size).toBe(100);
    expect(second).not.toEqual(first);
    expect(new Set([...first, ...second]).size).toBe(120);
  });

  it('uses the exact 20-coin Core Universe and spreads 100 bots independently across it', () => {
    const symbols = CORE_TRADING_UNIVERSE.map(([, , baseAsset]) => `${baseAsset}USDT`);
    expect(symbols).toHaveLength(20); expect(new Set(symbols).size).toBe(20);
    expect(symbols).toEqual(['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'TRXUSDT', 'DOGEUSDT', 'ADAUSDT', 'BCHUSDT', 'LINKUSDT', 'AVAXUSDT', 'LTCUSDT', 'DOTUSDT', 'TONUSDT', 'SUIUSDT', 'UNIUSDT', 'AAVEUSDT', 'NEARUSDT', 'ETCUSDT', 'XLMUSDT']);
    const assignments = Array.from({ length: 100 }, (_, index) => universeCandidate(symbols, 0, index, 100));
    expect(symbols.every((symbol) => assignments.filter((item) => item === symbol).length === 5)).toBe(true);
    expect(tradingUniverseAssetParamsSchema.parse({ symbol: 'btcusdt' }).symbol).toBe('BTCUSDT');
    expect(updateTradingUniverseAssetSchema.parse({ enabled: false })).toEqual({ enabled: false });
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

  it('applies aggressive limits only to PAPER training configuration', () => {
    const result = paperTrainingConfiguration({ signalThresholdBps: 45, stopLossBps: 50, takeProfitBps: 100 }, 12);
    expect(PAPER_TRAINING_MAX_OPEN_POSITIONS).toBe(100);
    expect(PAPER_TRAINING_INTERVAL_SECONDS).toBe(5);
    expect(result).toMatchObject({ paperTrainingMode: true, signalThresholdBps: 10,
      stopLossBps: 50, takeProfitBps: PAPER_TRAINING_TAKE_PROFIT_BPS, riskRewardRatio: 1.5,
      adaptiveStopMaxBps: 50, pyramidingEnabled: false, independentPaperTrades: true,
      minimumInitialMarginUsdt: PAPER_TRAINING_MIN_INITIAL_MARGIN_USDT,
      paperMaxRiskPerTradePct: PAPER_TRAINING_MAX_RISK_PER_TRADE_PCT, paperAlwaysInMarket: true });
    const capped = paperTrainingConfiguration({ stopLossBps: 2500, takeProfitBps: 500 }, 12);
    expect(capped).toMatchObject({ stopLossBps: PAPER_TRAINING_STOP_LOSS_BPS, takeProfitBps: 500 });
  });

  it('does not rotate a bot while a scheduler cycle owns its lease', () => {
    const now = new Date('2026-08-24T10:00:00Z');
    expect(schedulerLeaseActive('engine:w1', new Date('2026-08-24T10:01:00Z'), now)).toBe(true);
    expect(schedulerLeaseActive('engine:w1', new Date('2026-08-24T09:59:00Z'), now)).toBe(false);
    expect(schedulerLeaseActive(null, null, now)).toBe(false);
  });

  it('never overwrites the admin-owned risk profile during universe rotation', () => {
    const source = readFileSync(new URL('../src/modules/ai-trading/universe.worker.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/tradingRiskProfile\.update/);
    expect(source).toContain('ADMIN_MANAGED_NOT_MUTATED_BY_UNIVERSE_WORKER');
  });

  it('rechecks a PAPER ledger is flat at the atomic symbol update', () => {
    const source = readFileSync(new URL('../src/modules/ai-trading/universe.worker.ts', import.meta.url), 'utf8');
    expect(source).toContain("paperPosition: { is: { netQuantity: 0 } }");
    expect(source).toContain("paperPosition: { is: null }");
  });
});
