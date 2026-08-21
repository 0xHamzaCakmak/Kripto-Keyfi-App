import { aiDecisionSchemaV1, type AIDecision } from './ai-decision.schema.js';

export type AIDecisionRequest = {
  symbol: string;
  timeframe: string;
  marketContext: Readonly<Record<string, unknown>>;
  strategyCandidates: readonly string[];
};

export interface AIDecisionProvider {
  readonly providerId: string;
  decide(request: AIDecisionRequest): Promise<unknown>;
}

export type AIDecisionRiskResult = {
  status: 'APPROVED' | 'REJECTED' | 'BLOCKED';
  code: string;
  approvalId?: string;
};

export interface AIDecisionRiskGate {
  evaluate(decision: AIDecision, request: AIDecisionRequest): Promise<AIDecisionRiskResult>;
}

const riskApprovedDecision: unique symbol = Symbol('riskApprovedDecision');
export type RiskApprovedAIDecision = Readonly<{
  decision: AIDecision;
  approvalId: string;
  [riskApprovedDecision]: true;
}>;

export interface AIDecisionExecutionPort<Result = unknown> {
  execute(approved: RiskApprovedAIDecision): Promise<Result>;
}

export type AIDecisionFlowResult<Result> =
  | { status: 'INVALID'; providerId: string; issues: string[] }
  | { status: 'NO_EXECUTION'; providerId: string; decision: AIDecision }
  | { status: 'RISK_REJECTED'; providerId: string; decision: AIDecision; risk: AIDecisionRiskResult }
  | { status: 'EXECUTED'; providerId: string; decision: AIDecision; risk: AIDecisionRiskResult; result: Result };

const NON_EXECUTING_DECISIONS = new Set<AIDecision['decision']>(['WAIT', 'HOLD', 'NO_TRADE']);

export async function runAIDecisionFlow<Result>(
  request: AIDecisionRequest,
  dependencies: { provider: AIDecisionProvider; riskGate: AIDecisionRiskGate; execution: AIDecisionExecutionPort<Result> },
): Promise<AIDecisionFlowResult<Result>> {
  const raw = await dependencies.provider.decide(request);
  const parsed = aiDecisionSchemaV1.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 'INVALID', providerId: dependencies.provider.providerId,
      issues: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'decision'}: ${issue.message}`),
    };
  }
  const decision = parsed.data;
  if (decision.symbol !== request.symbol.trim().toUpperCase()) {
    return { status: 'INVALID', providerId: dependencies.provider.providerId, issues: ['symbol: provider decision does not match request'] };
  }
  if (NON_EXECUTING_DECISIONS.has(decision.decision)) {
    return { status: 'NO_EXECUTION', providerId: dependencies.provider.providerId, decision };
  }
  const risk = await dependencies.riskGate.evaluate(decision, request);
  if (risk.status !== 'APPROVED' || !risk.approvalId) {
    return { status: 'RISK_REJECTED', providerId: dependencies.provider.providerId, decision, risk };
  }
  const approved = { decision, approvalId: risk.approvalId, [riskApprovedDecision]: true } as RiskApprovedAIDecision;
  const result = await dependencies.execution.execute(approved);
  return { status: 'EXECUTED', providerId: dependencies.provider.providerId, decision, risk, result };
}

export class StaticAIDecisionProvider implements AIDecisionProvider {
  readonly providerId = 'static';
  constructor(private readonly output: unknown) {}
  async decide(): Promise<unknown> { return this.output; }
}
