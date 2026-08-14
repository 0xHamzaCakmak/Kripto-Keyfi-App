export const KOL_SCORE_METHODOLOGY_VERSION = '1.0.0';

export const KOL_SCORE_WEIGHTS = {
  trust: 0.2,
  audienceQuality: 0.15,
  engagementQuality: 0.1,
  marketKnowledge: 0.1,
  predictionAccuracy: 0.15,
  campaignPerformance: 0.2,
  transparencyRisk: 0.1,
} as const;

type ScoreInput = {
  trust: number;
  audienceQuality: number;
  engagementQuality: number;
  marketKnowledge: number;
  predictionAccuracy: number;
  campaignPerformance: number;
  transparency: number;
  risk: number;
  sampleSize: number;
  verifiedDataRatio: number;
  freshnessDays: number;
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function calculatePredictionAccuracy(results: Array<'CORRECT' | 'PARTIALLY_CORRECT' | 'INCORRECT' | 'EXPIRED' | 'INVALID' | 'PENDING'>) {
  const eligible = results.filter((result) => ['CORRECT', 'PARTIALLY_CORRECT', 'INCORRECT'].includes(result));
  if (!eligible.length) return { score: 0, evaluated: 0 };
  const points = eligible.reduce((sum, result) => sum + (result === 'CORRECT' ? 1 : result === 'PARTIALLY_CORRECT' ? 0.5 : 0), 0);
  return { score: Math.round((points / eligible.length) * 10_000) / 100, evaluated: eligible.length };
}

export function calculateKOLScore(input: ScoreInput) {
  const transparencyRisk = (clamp(input.transparency) + (100 - clamp(input.risk))) / 2;
  const raw =
    clamp(input.trust) * KOL_SCORE_WEIGHTS.trust +
    clamp(input.audienceQuality) * KOL_SCORE_WEIGHTS.audienceQuality +
    clamp(input.engagementQuality) * KOL_SCORE_WEIGHTS.engagementQuality +
    clamp(input.marketKnowledge) * KOL_SCORE_WEIGHTS.marketKnowledge +
    clamp(input.predictionAccuracy) * KOL_SCORE_WEIGHTS.predictionAccuracy +
    clamp(input.campaignPerformance) * KOL_SCORE_WEIGHTS.campaignPerformance +
    transparencyRisk * KOL_SCORE_WEIGHTS.transparencyRisk;

  const sampleConfidence = 1 - Math.exp(-Math.max(0, input.sampleSize) / 25);
  const verifiedConfidence = clamp(input.verifiedDataRatio, 0, 1);
  const freshnessConfidence = Math.exp(-Math.max(0, input.freshnessDays) / 365);
  const confidenceScore = sampleConfidence * 0.45 + verifiedConfidence * 0.4 + freshnessConfidence * 0.15;
  const confidence: 'HIGH' | 'MEDIUM' | 'LOW' = confidenceScore >= 0.72 ? 'HIGH' : confidenceScore >= 0.42 ? 'MEDIUM' : 'LOW';

  return {
    overall: Math.round(raw * 100) / 100,
    confidence,
    confidenceScore: Math.round(confidenceScore * 10_000) / 100,
    methodologyVersion: KOL_SCORE_METHODOLOGY_VERSION,
  };
}
