import { YoutubeChannelStatus } from '@prisma/client';
import { prisma } from '../../database/prisma.js';

export type YoutubeScoreWeights = {
  reach: number;
  engagement: number;
  viewPower: number;
  consistency: number;
  growth: number;
};

export type YoutubeScoreInput = {
  channelId: number;
  subscriberCount: number | null;
  avgViewsRecent: number | null;
  avgLikesRecent: number | null;
  avgCommentsRecent: number | null;
  uploadsLast90Days: number | null;
  subscriberGrowthPercent: number | null;
};

export type YoutubeScoreResult = {
  channelId: number;
  totalScore: number | null;
  reachScore: number | null;
  engagementScore: number | null;
  viewPowerScore: number | null;
  consistencyScore: number | null;
  growthScore: number | null;
};

const roundScore = (value: number) => Math.round(value * 100) / 100;

export function normalizeYoutubeMetric(values: Array<number | null>) {
  const available = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (available.length === 0) return values.map(() => null);
  const min = Math.min(...available);
  const max = Math.max(...available);
  return values.map((value) => {
    if (value === null || !Number.isFinite(value)) return null;
    if (max === min) return 50;
    return roundScore(((value - min) / (max - min)) * 100);
  });
}

export function buildYoutubeChannelScores(inputs: YoutubeScoreInput[], weights: YoutubeScoreWeights): YoutubeScoreResult[] {
  if (inputs.length < 5) {
    return inputs.map(({ channelId }) => ({
      channelId,
      totalScore: null,
      reachScore: null,
      engagementScore: null,
      viewPowerScore: null,
      consistencyScore: null,
      growthScore: null,
    }));
  }

  const rawReach = inputs.map((input) => input.subscriberCount);
  const rawEngagement = inputs.map((input) => {
    if (!input.avgViewsRecent || input.avgLikesRecent === null || input.avgCommentsRecent === null) return null;
    return (input.avgLikesRecent + input.avgCommentsRecent) / input.avgViewsRecent;
  });
  const rawViewPower = inputs.map((input) => {
    if (!input.subscriberCount || input.avgViewsRecent === null) return null;
    return input.avgViewsRecent / input.subscriberCount;
  });
  const rawConsistency = inputs.map((input) => input.uploadsLast90Days);
  const rawGrowth = inputs.map((input) => input.subscriberGrowthPercent);

  const reachScores = normalizeYoutubeMetric(rawReach);
  const engagementScores = normalizeYoutubeMetric(rawEngagement);
  const viewPowerScores = normalizeYoutubeMetric(rawViewPower);
  const consistencyScores = normalizeYoutubeMetric(rawConsistency);
  const growthScores = normalizeYoutubeMetric(rawGrowth);

  return inputs.map((input, index) => {
    const reachScore = reachScores[index] ?? null;
    const engagementScore = engagementScores[index] ?? null;
    const viewPowerScore = viewPowerScores[index] ?? null;
    const consistencyScore = consistencyScores[index] ?? null;
    const growthScore = growthScores[index] ?? null;
    const components = [
      [reachScore, weights.reach],
      [engagementScore, weights.engagement],
      [viewPowerScore, weights.viewPower],
      [consistencyScore, weights.consistency],
      [growthScore, weights.growth],
    ] as const;
    const available = components.filter((component): component is readonly [number, number] => component[0] !== null);
    const availableWeight = available.reduce((sum, [, weight]) => sum + weight, 0);
    const totalScore = availableWeight > 0
      ? roundScore(available.reduce((sum, [score, weight]) => sum + score * weight, 0) / availableWeight)
      : null;
    return {
      channelId: input.channelId,
      totalScore,
      reachScore,
      engagementScore,
      viewPowerScore,
      consistencyScore,
      growthScore,
    };
  });
}

export async function calculateYoutubeChannelScores(calculatedAt = new Date()) {
  const [weightRow, channels] = await Promise.all([
    prisma.youtubeScoreWeight.findFirst({ orderBy: { id: 'asc' } }),
    prisma.youtubeChannel.findMany({
      where: { status: YoutubeChannelStatus.ACTIVE },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        metricSnapshots: {
          where: { snapshotDate: { gte: new Date(calculatedAt.getTime() - 30 * 24 * 60 * 60_000) } },
          orderBy: { snapshotDate: 'asc' },
        },
      },
    }),
  ]);
  if (!weightRow) throw new Error('YouTube score weights are not configured');

  const inputs: YoutubeScoreInput[] = channels.map((channel) => {
    const latest = channel.metricSnapshots.at(-1);
    const oldest = channel.metricSnapshots.length > 1 ? channel.metricSnapshots[0] : null;
    const subscriberGrowthPercent = latest?.subscriberCount !== null && latest?.subscriberCount !== undefined
      && oldest?.subscriberCount && oldest.snapshotDate.getTime() < latest.snapshotDate.getTime()
      ? ((latest.subscriberCount - oldest.subscriberCount) / oldest.subscriberCount) * 100
      : null;
    return {
      channelId: channel.id,
      subscriberCount: latest?.subscriberCount ?? null,
      avgViewsRecent: latest?.avgViewsRecent ?? null,
      avgLikesRecent: latest?.avgLikesRecent ?? null,
      avgCommentsRecent: latest?.avgCommentsRecent ?? null,
      uploadsLast90Days: latest?.uploadsLast90Days ?? null,
      subscriberGrowthPercent,
    };
  });
  const scores = buildYoutubeChannelScores(inputs, {
    reach: Number(weightRow.reachWeight),
    engagement: Number(weightRow.engagementWeight),
    viewPower: Number(weightRow.viewPowerWeight),
    consistency: Number(weightRow.consistencyWeight),
    growth: Number(weightRow.growthWeight),
  });

  await prisma.$transaction(scores.map((score) => prisma.youtubeChannelScore.upsert({
    where: { channelId: score.channelId },
    create: { ...score, calculatedAt },
    update: { ...score, calculatedAt },
  })));
  return { eligible: channels.length >= 5, activeChannels: channels.length, calculated: scores.length, scores };
}
