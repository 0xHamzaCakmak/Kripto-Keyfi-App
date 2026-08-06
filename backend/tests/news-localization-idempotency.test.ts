import { describe, expect, it } from 'vitest';
import { shouldSkipNewsLocalization } from '../src/modules/news/news-localization-idempotency.js';

const base = {
  force: false,
  manualEditedAt: null,
  aiEnabled: true,
  existingInputHash: null,
  inputHash: 'new-input-hash',
  titleTr: null,
  summaryTr: null,
  hasAiSummary: false,
};

describe('news localization idempotency', () => {
  it('does not send the same article input to AI twice', () => {
    expect(shouldSkipNewsLocalization({ ...base, existingInputHash: base.inputHash })).toBe(true);
  });

  it('protects manual edits and already completed localization', () => {
    expect(shouldSkipNewsLocalization({ ...base, manualEditedAt: new Date() })).toBe(true);
    expect(shouldSkipNewsLocalization({ ...base, titleTr: 'Türkçe başlık', summaryTr: 'Türkçe özet', hasAiSummary: true })).toBe(true);
  });

  it('allows an explicit administrator retry', () => {
    expect(shouldSkipNewsLocalization({ ...base, force: true, existingInputHash: base.inputHash })).toBe(false);
  });
});
