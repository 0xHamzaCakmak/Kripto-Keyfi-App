import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { AI_DECISION_SCHEMA_VERSION, aiDecisionSchemaV1 } from '../src/modules/ai-trading/ai-decision.schema.js';
import { runAIDecisionFlow, StaticAIDecisionProvider } from '../src/modules/ai-trading/ai-decision.service.js';

const request = { symbol: 'BTCUSDT', timeframe: '1h', marketContext: { regime: 'TRENDING_UP' }, strategyCandidates: ['breakout'] };
const directionalDecision = {
  schemaVersion: AI_DECISION_SCHEMA_VERSION, symbol: 'BTCUSDT', decision: 'LONG', confidence: 0.78,
  strategy: 'breakout', marketRegime: 'TRENDING_UP', entryZone: [118200, '118400'],
  invalidation: 117650, targets: [119100, 120000], reasonSummary: ['Trend and volume confirm the setup.'],
};

describe('AI decision interface', () => {
  it('normalizes a provider-independent structured decision', () => {
    const parsed = aiDecisionSchemaV1.parse(directionalDecision);
    expect(parsed.entryZone).toEqual(['118200', '118400']);
    expect(parsed.targets).toEqual(['119100', '120000']);
  });

  it('rejects free text, hidden reasoning fields and incomplete directional decisions', () => {
    expect(aiDecisionSchemaV1.safeParse('go long').success).toBe(false);
    expect(aiDecisionSchemaV1.safeParse({ ...directionalDecision, chainOfThought: 'hidden reasoning' }).success).toBe(false);
    expect(aiDecisionSchemaV1.safeParse({ ...directionalDecision, invalidation: null }).success).toBe(false);
  });

  it('never reaches risk or execution when provider output is invalid', async () => {
    const riskGate = { evaluate: vi.fn() };
    const execution = { execute: vi.fn() };
    const result = await runAIDecisionFlow(request, { provider: new StaticAIDecisionProvider({ decision: 'LONG' }), riskGate, execution });
    expect(result.status).toBe('INVALID');
    expect(riskGate.evaluate).not.toHaveBeenCalled();
    expect(execution.execute).not.toHaveBeenCalled();
  });

  it('requires immutable risk approval before execution', async () => {
    const execution = { execute: vi.fn().mockResolvedValue({ staged: true }) };
    const rejected = await runAIDecisionFlow(request, {
      provider: new StaticAIDecisionProvider(directionalDecision),
      riskGate: { evaluate: vi.fn().mockResolvedValue({ status: 'REJECTED', code: 'RISK_LIMIT' }) }, execution,
    });
    expect(rejected.status).toBe('RISK_REJECTED');
    expect(execution.execute).not.toHaveBeenCalled();

    const approved = await runAIDecisionFlow(request, {
      provider: new StaticAIDecisionProvider(directionalDecision),
      riskGate: { evaluate: vi.fn().mockResolvedValue({ status: 'APPROVED', code: 'RISK_APPROVED', approvalId: 'approval-1' }) }, execution,
    });
    expect(approved.status).toBe('EXECUTED');
    expect(execution.execute).toHaveBeenCalledWith(expect.objectContaining({ approvalId: 'approval-1' }));
  });

  it('does not send WAIT/HOLD/NO_TRADE decisions to risk or execution', async () => {
    for (const decision of ['WAIT', 'HOLD', 'NO_TRADE'] as const) {
      const riskGate = { evaluate: vi.fn() };
      const execution = { execute: vi.fn() };
      const result = await runAIDecisionFlow(request, {
        provider: new StaticAIDecisionProvider({ ...directionalDecision, decision, entryZone: null, invalidation: null, targets: [] }),
        riskGate, execution,
      });
      expect(result.status).toBe('NO_EXECUTION');
      expect(riskGate.evaluate).not.toHaveBeenCalled();
      expect(execution.execute).not.toHaveBeenCalled();
    }
  });

  it('contains no exchange or order writer dependency', () => {
    const service = readFileSync(new URL('../src/modules/ai-trading/ai-decision.service.ts', import.meta.url), 'utf8');
    expect(service).not.toMatch(/exchange-adapter|placeOrder|submitOrder|tradingEngine|manual-trading/);
  });
});
