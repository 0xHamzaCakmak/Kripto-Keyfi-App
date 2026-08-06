import { describe, expect, it } from 'vitest';
import { canAutoPublishLocalizedNews, FOREIGN_REVIEW_THRESHOLD } from '../src/modules/news/news-editorial-policy.js';

const trustedSource = {
  autoPublish: true,
  isActive: true,
  isTrusted: true,
  commercialUseAllowed: true,
  excerptAllowed: true,
  lastTermsCheckedAt: new Date(),
};

describe('news editorial policy', () => {
  it('keeps the first foreign articles in editorial review', () => {
    expect(canAutoPublishLocalizedNews({ source: trustedSource, language: 'en', needsReview: false, approvedForeignReviews: FOREIGN_REVIEW_THRESHOLD - 1 })).toBe(false);
  });

  it('auto-publishes quality-approved news only after source requirements are met', () => {
    expect(canAutoPublishLocalizedNews({ source: trustedSource, language: 'en', needsReview: false, approvedForeignReviews: FOREIGN_REVIEW_THRESHOLD })).toBe(true);
    expect(canAutoPublishLocalizedNews({ source: trustedSource, language: 'tr', needsReview: false, approvedForeignReviews: 0 })).toBe(true);
    expect(canAutoPublishLocalizedNews({ source: trustedSource, language: 'tr', needsReview: true, approvedForeignReviews: 0 })).toBe(false);
    expect(canAutoPublishLocalizedNews({ source: { ...trustedSource, isTrusted: false }, language: 'tr', needsReview: false, approvedForeignReviews: 0 })).toBe(false);
  });

  it('uses the review threshold configured for each source', () => {
    const source = { ...trustedSource, minimumManualReviews: 5 };
    expect(canAutoPublishLocalizedNews({ source, language: 'en', needsReview: false, approvedForeignReviews: 4 })).toBe(false);
    expect(canAutoPublishLocalizedNews({ source, language: 'en', needsReview: false, approvedForeignReviews: 5 })).toBe(true);
  });
});
