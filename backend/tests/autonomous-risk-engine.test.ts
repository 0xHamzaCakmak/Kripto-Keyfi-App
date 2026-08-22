import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('immutable autonomous risk engine integration', () => {
  it('uses an additive safe-default migration', () => {
    const migration = readFileSync(new URL('../prisma/migrations/20260821070000_add_autonomous_risk_limits/migration.sql', import.meta.url), 'utf8');
    expect(migration).toContain('maxRiskPerTradePct');
    expect(migration).toContain('stopLossRequired');
    expect(migration).toContain("DEFAULT 'ISOLATED_ONLY'");
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN)|DELETE\s+FROM|TRUNCATE/i);
  });

  it('gates autonomous paper fills inside the same transaction', () => {
    const storage = readFileSync(new URL('../../services/trading-engine/internal/storage/mysql/bots.go', import.meta.url), 'utf8');
    const evaluation = storage.indexOf('evaluateAutonomousPaperRisk');
    const fill = storage.indexOf('persistPaperCycle');
    expect(evaluation).toBeGreaterThan(-1);
    expect(fill).toBeGreaterThan(evaluation);
    expect(storage).toContain('instance.Type == "AUTONOMOUS"');
    expect(storage).toContain('persistPaperCycle(ctx, tx, instance, decision, decisionID, now, riskApproved)');
  });

  it('keeps AI learning modules unable to mutate risk policy or submit orders', () => {
    for (const file of ['teacher.service.ts', 'researcher.service.ts', 'evolution.service.ts', 'mutation.service.ts']) {
      const source = readFileSync(new URL(`../src/modules/ai-trading/${file}`, import.meta.url), 'utf8');
      expect(source).not.toMatch(/updateRiskProfile|tradingRiskProfile\.(?:update|upsert)|placeOrder|submitOrder/);
    }
  });

  it('does not modify the existing manual/live execution service', () => {
    const integration = readFileSync(new URL('../../services/trading-engine/internal/storage/mysql/autonomous_risk.go', import.meta.url), 'utf8');
    expect(integration).toContain('"submittedToExchange": false');
    expect(integration).not.toMatch(/PlaceOrder|ConfigurePosition/);
  });
});
