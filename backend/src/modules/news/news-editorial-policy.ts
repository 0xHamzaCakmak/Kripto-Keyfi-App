import type { NewsSource } from '@prisma/client';

export const FOREIGN_REVIEW_THRESHOLD = 20;

type SourcePolicy = Pick<NewsSource, 'autoPublish' | 'isActive' | 'isTrusted' | 'commercialUseAllowed' | 'excerptAllowed' | 'lastTermsCheckedAt'> & { minimumManualReviews?: number };

export function isTurkishNewsLanguage(language: string) {
  return language.toLocaleLowerCase('tr-TR').startsWith('tr');
}

export function isSourceEligibleForAutoPublish(source: SourcePolicy) {
  return source.autoPublish
    && source.isActive
    && source.isTrusted
    && source.commercialUseAllowed
    && source.excerptAllowed
    && Boolean(source.lastTermsCheckedAt);
}

export function canAutoPublishLocalizedNews(input: {
  source: SourcePolicy | null;
  language: string;
  needsReview: boolean;
  approvedForeignReviews: number;
}) {
  if (!input.source || input.needsReview || !isSourceEligibleForAutoPublish(input.source)) return false;
  return isTurkishNewsLanguage(input.language) || input.approvedForeignReviews >= (input.source.minimumManualReviews ?? FOREIGN_REVIEW_THRESHOLD);
}
