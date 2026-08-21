import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { shadowTradesQuerySchema } from '../src/modules/ai-trading/shadow-trading.schema.js';
import { summarizeShadowPerformance } from '../src/modules/ai-trading/shadow-trading.service.js';

const at = (day: number) => new Date(`2026-08-${String(day).padStart(2, '0')}T00:00:00.000Z`);

describe('shadow trading', () => {
  it('summarizes shadow actions separately from paper performance', () => {
    const result = summarizeShadowPerformance([
      { action: 'WOULD_OPEN', fee: 1, realizedPnl: 0, cumulativePnl: 0, totalFees: 1, occurredAt: at(1) },
      { action: 'WOULD_MOVE_STOP', fee: 0, realizedPnl: 0, cumulativePnl: 0, totalFees: 1, occurredAt: at(2) },
      { action: 'WOULD_CLOSE', fee: 1, realizedPnl: 20, cumulativePnl: 20, totalFees: 2, occurredAt: at(3) },
    ], 1000);
    expect(result).toMatchObject({ totalActions: 3, wouldOpen: 1, wouldClose: 1, wouldMoveStop: 1, wins: 1, netPnl: 18 });
    expect(result.shadowDurationDays).toBe(2);
  });

  it('calculates drawdown and profit factor from simulated closes', () => {
    const result = summarizeShadowPerformance([
      { action: 'WOULD_CLOSE', fee: 0, realizedPnl: 20, cumulativePnl: 20, totalFees: 0, occurredAt: at(1) },
      { action: 'WOULD_CLOSE', fee: 0, realizedPnl: -10, cumulativePnl: 10, totalFees: 0, occurredAt: at(2) },
    ], 100);
    expect(result.profitFactor).toBe(2);
    expect(result.maxDrawdown).toBeCloseTo(10 / 120);
  });

  it('validates bounded admin queries', () => {
    expect(shadowTradesQuerySchema.safeParse({ action: 'WOULD_OPEN', limit: '100' }).success).toBe(true);
    expect(shadowTradesQuerySchema.safeParse({ action: 'OPENED' }).success).toBe(false);
    expect(shadowTradesQuerySchema.safeParse({ from: at(3).toISOString(), to: at(1).toISOString() }).success).toBe(false);
  });

  it('uses a separate additive ledger and no exchange writer path', () => {
    const migration = readFileSync(new URL('../prisma/migrations/20260821090000_add_shadow_trades/migration.sql', import.meta.url), 'utf8');
    const storage = readFileSync(new URL('../../services/trading-engine/internal/storage/mysql/bots.go', import.meta.url), 'utf8');
    const risk = readFileSync(new URL('../../services/trading-engine/internal/storage/mysql/autonomous_risk.go', import.meta.url), 'utf8');
    const runner = readFileSync(new URL('../../services/trading-engine/cmd/trading-engine/main.go', import.meta.url), 'utf8');
    expect(migration).toContain('CREATE TABLE `shadow_trades`');
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/i);
    expect(storage).toContain('instance.Mode == "SHADOW" && riskApproved');
    expect(storage).toContain('submittedToExchange": false');
    expect(storage).not.toMatch(/persistPaperCycle\([^)]*SHADOW/);
    expect(risk).toContain("b.mode = 'SHADOW'");
    expect(risk).toContain('FROM shadow_trades');
    expect(runner).toContain('exchange.DemoEndpoints(), exchange.PublicMarketEndpoints()');
  });
});
