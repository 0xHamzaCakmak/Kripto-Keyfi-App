import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { autonomousAuditQuerySchema } from '../src/modules/ai-trading/autonomous-observability.schema.js';
import { assessAutonomousHealth, resolveAutonomousMarketDataEvidence, type AutonomousHealthMetrics } from '../src/modules/ai-trading/autonomous-observability.service.js';

function metrics(overrides: Partial<AutonomousHealthMetrics> = {}): AutonomousHealthMetrics {
  return {
    activeBots: 2, arena: { decisionsLast5m: 10, throughputPerMinute: 2 },
    marketData: { latestObservedAt: new Date(), lagMs: 1_000, source: 'REGIME_SNAPSHOT' }, strategyExecution: { averagePersistenceLatencyMs: 4 },
    paperOrders: { total: 100, last24h: 5 }, riskRejectsLast24h: 0, exchangeErrorsLast24h: 0,
    aiProviderErrorsLast24h: 0, generations: { RUNNING: 1 }, teacherRunsLast24h: 1, researcherRunsLast24h: 1,
    memory: { decisionsTotal: 500, decisionsLast24h: 20, paperTradesTotal: 100, growthLast24h: 25 },
    pnlCalculationErrors: 0, emergencyStop: false, ...overrides,
  };
}

describe('autonomous observability', () => {
  it('reports healthy, degraded and emergency-stop states deterministically', () => {
    expect(assessAutonomousHealth(metrics())).toBe('HEALTHY');
    expect(assessAutonomousHealth(metrics({ marketData: { latestObservedAt: null, lagMs: null, source: 'NONE' } }))).toBe('DEGRADED');
    expect(assessAutonomousHealth(metrics({ exchangeErrorsLast24h: 1 }))).toBe('DEGRADED');
    expect(assessAutonomousHealth(metrics({ emergencyStop: true }))).toBe('EMERGENCY_STOPPED');
  });

  it('uses a fresh autonomous decision when the regime snapshot pipeline has no evidence', () => {
    const now = new Date('2026-08-23T08:00:00.000Z');
    const decisionAt = new Date('2026-08-23T07:59:58.000Z');
    const evidence = resolveAutonomousMarketDataEvidence(now, null, decisionAt);
    expect(evidence).toEqual({ latestObservedAt: decisionAt, lagMs: 2_000, source: 'AUTONOMOUS_DECISION' });
    expect(assessAutonomousHealth(metrics({ marketData: evidence }))).toBe('HEALTHY');
  });

  it('bounds autonomous audit queries', () => {
    expect(autonomousAuditQuerySchema.parse({}).limit).toBe(50);
    expect(autonomousAuditQuerySchema.safeParse({ limit: 201 }).success).toBe(false);
  });

  it('exposes admin-only health and audit routes with correlation support', () => {
    const routes = readFileSync(new URL('../src/modules/trading/trading.routes.ts', import.meta.url), 'utf8');
    const app = readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');
    expect(routes).toContain("tradingRouter.get('/system-health'");
    expect(routes).toContain("tradingRouter.get('/system-health/audit'");
    expect(routes.indexOf('tradingRouter.use(authenticate, authorize(UserRole.ADMIN))')).toBeLessThan(routes.indexOf("tradingRouter.get('/system-health'"));
    expect(app).toContain("res.setHeader('X-Request-ID', requestId)");
    expect(app).toContain("'req.body.*.apiSecret'");
  });
});
