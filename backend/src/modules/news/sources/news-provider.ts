import type { NewsSource } from '@prisma/client';

export type NormalizedNewsItem = {
  providerNewsId?: string;
  originalUrl: string;
  canonicalUrl?: string;
  title: string;
  excerpt?: string;
  coverImageUrl?: string;
  coverImageAlt?: string;
  category?: string;
  authorName?: string;
  language?: string;
  publishedAt: Date;
  sourceUpdatedAt?: Date;
  tags?: string[];
  coins?: { symbol: string; name?: string }[];
  storyKey?: string;
};

export interface NewsProvider {
  fetch(source: NewsSource): Promise<NormalizedNewsItem[]>;
}
