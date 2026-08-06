export type NewsLocalizationInput = {
  title: string;
  excerpt: string | null;
  sourceName: string;
  language: string;
  category: string | null;
  publishedAt: Date;
  existingTags: string[];
};

export type NewsLocalizationOutput = {
  titleTr: string;
  summaryTr: string;
  whyItMatters: string;
  marketImpact: string;
  watchOuts: string;
  confidence: number;
  needsReview: boolean;
  tags: string[];
  relatedCoins: string[];
  provider: string;
  model: string;
};

export interface NewsLocalizationProvider {
  readonly name: string;
  readonly configured: boolean;
  localize(input: NewsLocalizationInput): Promise<NewsLocalizationOutput>;
}
