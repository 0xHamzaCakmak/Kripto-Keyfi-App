import { StrategyFamily } from '@prisma/client';
import { z } from 'zod';
import {
  RuleTemplateResearchProvider, type ProposedHypothesis, type ResearchDataset, type ResearchHypothesisProvider,
} from './researcher.service.js';
import {
  RuleBasedTeacherProvider, type TeacherAnalysisProvider, type TeacherEvidence, type TeacherRecommendation,
} from './teacher.service.js';

export type StructuredAIRequest = {
  task: 'TEACHER_PERFORMANCE_REVIEW' | 'RESEARCH_HYPOTHESIS';
  instructions: string;
  input: Readonly<Record<string, unknown>>;
  outputContract: Readonly<Record<string, unknown>>;
};

export interface StructuredAIProvider {
  readonly id: string;
  generate(request: StructuredAIRequest): Promise<unknown>;
}

const actionSchema = z.object({
  type: z.enum([
    'COLLECT_MORE_EVIDENCE', 'REDUCE_POSITION_FACTOR', 'INCREASE_CONFIDENCE_THRESHOLD',
    'INCREASE_COOLDOWN', 'PRESERVE_REGIME_STRENGTH', 'ADD_REGIME_FILTER_CANDIDATE', 'KEEP_MONITORING',
  ]),
  rationale: z.string().trim().min(5).max(500),
  applyAutomatically: z.literal(false),
}).strict();

const teacherOutputSchema = z.array(z.object({
  observation: z.string().trim().min(5).max(500),
  severity: z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH']),
  confidence: z.number().finite().min(0).max(1),
  metricEvidence: z.record(z.unknown()),
  recommendedAction: actionSchema,
}).strict()).max(8);

const candidateParametersSchema = z.record(z.union([
  z.string().max(200), z.number().finite(), z.boolean(), z.array(z.union([z.string().max(100), z.number().finite(), z.boolean()])).max(20),
]));
const researchOutputSchema = z.array(z.object({
  hypothesis: z.string().trim().min(10).max(1_500),
  evidence: z.record(z.unknown()),
  targetStrategyFamily: z.nativeEnum(StrategyFamily),
  suggestedChange: z.object({
    type: z.enum([
      'CONFIDENCE_THRESHOLD_FILTER', 'COOLDOWN_FILTER', 'FUNDING_CONTEXT_FILTER',
      'REGIME_ENTRY_FILTER', 'TEACHER_ACTION_CANDIDATE', 'ENTRY_FILTER_CANDIDATE', 'EXIT_FILTER_CANDIDATE',
    ]),
    parameters: candidateParametersSchema,
    createCandidateOnly: z.literal(true),
  }).strict(),
  confidence: z.number().finite().min(0).max(1),
}).strict()).max(8);

const teacherContract = {
  type: 'array', maxItems: 8, additionalProperties: false,
  required: ['observation', 'severity', 'confidence', 'metricEvidence', 'recommendedAction'],
  constraints: { reasonSummaryOnly: true, applyAutomatically: false, codeChanges: false, liveRiskChanges: false },
} as const;
const researcherContract = {
  type: 'array', maxItems: 8, additionalProperties: false,
  required: ['hypothesis', 'evidence', 'targetStrategyFamily', 'suggestedChange', 'confidence'],
  constraints: { createCandidateOnly: true, codeChanges: false, liveRiskChanges: false, liveActivation: false },
} as const;

export class LLMTeacherAdapter implements TeacherAnalysisProvider {
  readonly name: string;
  constructor(
    private readonly provider: StructuredAIProvider,
    private readonly fallback: TeacherAnalysisProvider = new RuleBasedTeacherProvider(),
    private readonly timeoutMs = 1_500,
  ) {
    this.name = adapterName(provider.id, 'TEACHER');
  }

  async evaluate(evidence: TeacherEvidence): Promise<TeacherRecommendation[]> {
    try {
      const raw = await bounded(this.provider.generate({
        task: 'TEACHER_PERFORMANCE_REVIEW',
        instructions: 'Evaluate only supplied performance evidence. Return concise recommendations. Never propose code edits, automatic application, live activation, or risk-limit changes.',
        input: evidence, outputContract: teacherContract,
      }), this.timeoutMs);
      const parsed = teacherOutputSchema.parse(raw);
      return parsed.map((item) => ({
        ...item, targetType: evidence.targetType,
        ...(evidence.tradingBotId ? { tradingBotId: evidence.tradingBotId } : {}),
        ...(evidence.strategyId ? { strategyId: evidence.strategyId } : {}),
        metricEvidence: { ...item.metricEvidence, analysisAdapter: { provider: this.provider.id, fallbackUsed: false } },
      }));
    } catch {
      const recommendations = await this.fallback.evaluate(evidence);
      return recommendations.map((item) => ({ ...item, metricEvidence: {
        ...item.metricEvidence, analysisAdapter: { provider: this.provider.id, fallback: this.fallback.name, fallbackUsed: true },
      } }));
    }
  }
}

export class LLMResearcherAdapter implements ResearchHypothesisProvider {
  readonly name: string;
  constructor(
    private readonly provider: StructuredAIProvider,
    private readonly fallback: ResearchHypothesisProvider = new RuleTemplateResearchProvider(),
    private readonly timeoutMs = 1_500,
  ) {
    this.name = adapterName(provider.id, 'RESEARCH');
  }

  async propose(dataset: ResearchDataset, minimumTrades: number): Promise<ProposedHypothesis[]> {
    if (dataset.totalTrades < minimumTrades) return [];
    try {
      const raw = await bounded(this.provider.generate({
        task: 'RESEARCH_HYPOTHESIS',
        instructions: 'Generate testable candidate-only hypotheses from supplied evidence. Never output code, live activation, direct execution, or live risk-setting changes.',
        input: { ...dataset, minimumTrades }, outputContract: researcherContract,
      }), this.timeoutMs);
      const parsed = researchOutputSchema.parse(raw);
      if (parsed.some((item) => item.targetStrategyFamily !== dataset.strategyFamily)) throw new Error('strategy family mismatch');
      return parsed.map((item) => ({ ...item, evidence: {
        ...item.evidence, analysisAdapter: { provider: this.provider.id, fallbackUsed: false },
      } }));
    } catch {
      const proposals = await this.fallback.propose(dataset, minimumTrades);
      return proposals.map((item) => ({ ...item, evidence: {
        ...item.evidence, analysisAdapter: { provider: this.provider.id, fallback: this.fallback.name, fallbackUsed: true },
      } }));
    }
  }
}

function bounded<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) throw new Error('AI adapter timeout must be between 1 and 10000ms');
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('AI provider timeout')), timeoutMs);
    operation.then((value) => { clearTimeout(timer); resolve(value); }, (error: unknown) => { clearTimeout(timer); reject(error); });
  });
}

function adapterName(providerId: string, role: string) {
  return `LLM_${role}_${providerId}_FALLBACK`.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
}
