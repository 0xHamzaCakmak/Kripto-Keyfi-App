import { describe, expect, it } from 'vitest';
import { calculateKOLScore, calculatePredictionAccuracy } from '../src/modules/kol/kol-score.service.js';
import { calculateCampaignAnalytics } from '../src/modules/kol/campaign-analytics.service.js';

describe('KOL score engine', () => {
  it('weights partially correct predictions as half a correct result', () => {
    expect(calculatePredictionAccuracy(['CORRECT', 'PARTIALLY_CORRECT', 'INCORRECT', 'PENDING'])).toEqual({ score: 50, evaluated: 3 });
  });

  it('keeps the score separate from evidence confidence', () => {
    const base = { trust: 90, audienceQuality: 90, engagementQuality: 90, marketKnowledge: 90, predictionAccuracy: 90, campaignPerformance: 90, transparency: 90, risk: 10, verifiedDataRatio: .9, freshnessDays: 5 };
    const small = calculateKOLScore({ ...base, sampleSize: 2 });
    const mature = calculateKOLScore({ ...base, sampleSize: 200 });
    expect(small.overall).toBe(mature.overall);
    expect(small.confidence).not.toBe('HIGH');
    expect(mature.confidence).toBe('HIGH');
  });
});

describe('campaign analytics', () => {
  it('calculates ROI and conversion metrics in one service', () => {
    const result = calculateCampaignAnalytics(100, [
      { eventType: 'CLICK' }, { eventType: 'CLICK' }, { eventType: 'REGISTRATION' }, { eventType: 'DEPOSIT', value: 250 },
    ]);
    expect(result.cpc).toBe(50);
    expect(result.costPerRegistration).toBe(100);
    expect(result.roi).toBe(150);
    expect(result.roas).toBe(2.5);
  });
});

