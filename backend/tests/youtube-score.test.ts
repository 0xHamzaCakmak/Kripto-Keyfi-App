import { describe, expect, it } from 'vitest';
import { buildYoutubeChannelScores, normalizeYoutubeMetric } from '../src/modules/videos/youtube-score.service.js';

const weights = { reach: 20, engagement: 30, viewPower: 25, consistency: 15, growth: 10 };

describe('YouTube score engine', () => {
  it('normalizes metrics into the 0-100 range and treats tied values neutrally', () => {
    expect(normalizeYoutubeMetric([10, 20, 30, null])).toEqual([0, 50, 100, null]);
    expect(normalizeYoutubeMetric([7, 7, 7])).toEqual([50, 50, 50]);
  });

  it('requires at least five active channels for comparable scores', () => {
    const result = buildYoutubeChannelScores(Array.from({ length: 4 }, (_, index) => ({
      channelId: index + 1,
      subscriberCount: 1_000,
      avgViewsRecent: 100,
      avgLikesRecent: 10,
      avgCommentsRecent: 2,
      uploadsLast90Days: 10,
      subscriberGrowthPercent: null,
    })), weights);
    expect(result.every((score) => score.totalScore === null)).toBe(true);
  });

  it('excludes unavailable growth history from the weighted denominator', () => {
    const result = buildYoutubeChannelScores(Array.from({ length: 5 }, (_, index) => ({
      channelId: index + 1,
      subscriberCount: (index + 1) * 1_000,
      avgViewsRecent: (index + 1) * 100,
      avgLikesRecent: 10,
      avgCommentsRecent: 2,
      uploadsLast90Days: index * 5,
      subscriberGrowthPercent: null,
    })), weights);
    expect(result.every((score) => score.growthScore === null)).toBe(true);
    expect(result.every((score) => score.totalScore !== null && score.totalScore >= 0 && score.totalScore <= 100)).toBe(true);
  });
});
