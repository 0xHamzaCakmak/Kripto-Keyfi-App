import type { NewsLocalizationInput, NewsLocalizationOutput } from './news-localization-provider.js';

const words = (value: string) => value.toLocaleLowerCase('tr-TR').match(/[\p{L}\p{N}]+/gu) ?? [];
export const hasEncodingArtifacts = (value: string) => /\uFFFD|(?:Ã.|Â.|â(?:€|™|œ|ž)|Ä.|Å.)/.test(value);

function ngrams(value: string, size = 4) {
  const tokens = words(value);
  const result = new Set<string>();
  for (let index = 0; index <= tokens.length - size; index += 1) result.add(tokens.slice(index, index + size).join(' '));
  return result;
}

function overlap(left: string, right: string) {
  const a = ngrams(left);
  const b = ngrams(right);
  if (!a.size || !b.size) return 0;
  let common = 0;
  for (const item of a) if (b.has(item)) common += 1;
  return common / Math.min(a.size, b.size);
}

export type NewsLocalizationQuality = {
  output: NewsLocalizationOutput;
  wordCount: number;
  flags: string[];
};

export function evaluateNewsLocalization(input: NewsLocalizationInput, output: NewsLocalizationOutput): NewsLocalizationQuality {
  const flags: string[] = [];
  const sourceWords = words(input.excerpt ?? '').length;
  const summaryWords = words(output.summaryTr).length;
  const editorialWords = words(`${output.whyItMatters} ${output.marketImpact} ${output.watchOuts}`).length;

  if (sourceWords < 40) flags.push('SHORT_SOURCE_INPUT');
  if (summaryWords < 18) flags.push('SUMMARY_TOO_SHORT');
  if (summaryWords > 120) flags.push('SUMMARY_TOO_LONG');
  if (editorialWords < 90) flags.push('EDITORIAL_TOO_SHORT');
  if (/(?:https?:\/\/|www\.)/i.test(`${output.summaryTr} ${output.whyItMatters} ${output.marketImpact} ${output.watchOuts}`)) flags.push('UNEXPECTED_URL');
  if (/(?:```|^#{1,6}\s|\*\*)/m.test(`${output.summaryTr}\n${output.whyItMatters}`)) flags.push('MARKDOWN_OUTPUT');
  if (hasEncodingArtifacts(`${output.titleTr} ${output.summaryTr} ${output.whyItMatters} ${output.marketImpact} ${output.watchOuts}`)) flags.push('ENCODING_ARTIFACT');
  if (input.language.toLocaleLowerCase('tr-TR').startsWith('tr') && overlap(input.excerpt ?? '', output.summaryTr) > 0.78) flags.push('HIGH_SOURCE_OVERLAP');

  const needsReview = output.needsReview || flags.length > 0;
  return {
    output: {
      ...output,
      needsReview,
      confidence: needsReview ? Math.min(output.confidence, 0.65) : output.confidence,
    },
    wordCount: summaryWords + editorialWords,
    flags,
  };
}
