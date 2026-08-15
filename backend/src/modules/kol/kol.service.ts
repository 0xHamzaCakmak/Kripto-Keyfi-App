import { randomBytes, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { calculateCampaignAnalytics } from './campaign-analytics.service.js';
import { calculateKOLScore, calculatePredictionAccuracy, KOL_SCORE_METHODOLOGY_VERSION } from './kol-score.service.js';
import { fetchXProfile } from './providers/x-profile.provider.js';

const scoreSelect = { orderBy: { calculatedAt: 'desc' as const }, take: 1 };
const jsonSafe = <T>(value: T): T => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item)) as T;

export async function listKOLs(query: { q?: string; country?: string; language?: string; platform?: string; verified?: string; minScore?: number; sort: string; page: number; limit: number }) {
  const where: Prisma.KOLWhereInput = {
    isPublished: true,
    ...(query.q ? { OR: [{ displayName: { contains: query.q } }, { username: { contains: query.q } }, { slug: { contains: query.q } }] } : {}),
    ...(query.country ? { country: query.country } : {}), ...(query.language ? { language: query.language } : {}),
    ...(query.verified ? { isVerified: query.verified === 'true' } : {}),
    ...(query.platform ? { socialAccounts: { some: { platform: query.platform as never } } } : {}),
    ...(query.minScore !== undefined ? { scores: { some: { overall: { gte: query.minScore } } } } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.kOL.findMany({ where, include: { socialAccounts: true, scores: scoreSelect }, orderBy: query.sort === 'newest' ? { createdAt: 'desc' } : { updatedAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
    prisma.kOL.count({ where }),
  ]);
  const sorted = items.sort((a, b) => {
    const sa = a.scores[0]; const sb = b.scores[0];
    const key = query.sort === 'trust' ? 'trust' : query.sort === 'accuracy' ? 'predictionAccuracy' : query.sort === 'campaign' ? 'campaignPerformance' : query.sort === 'audience' ? 'audienceQuality' : 'overall';
    if (query.sort === 'followers') return Number(b.socialAccounts.reduce((n, x) => n + x.followerCount, 0n) - a.socialAccounts.reduce((n, x) => n + x.followerCount, 0n));
    return Number(sb?.[key] || 0) - Number(sa?.[key] || 0);
  });
  return jsonSafe({ items: sorted, pagination: { page: query.page, limit: query.limit, total, pages: Math.ceil(total / query.limit) } });
}

export async function getKOL(slug: string) {
  const kol = await prisma.kOL.findFirst({ where: { slug, isPublished: true }, include: { socialAccounts: true, scores: { orderBy: { calculatedAt: 'desc' }, take: 12 }, predictions: { orderBy: { publishedAt: 'desc' }, take: 100 }, riskEvents: { where: { visibility: 'PUBLIC', verified: true }, orderBy: { occurredAt: 'desc' } }, audienceMetrics: { orderBy: { measuredAt: 'desc' }, take: 20 } } });
  if (!kol) throw new ApiError(404, 'KOL not found', 'NOT_FOUND');
  return jsonSafe(kol);
}

async function assertCompanyAccess(userId: string, companyId: string) {
  const member = await prisma.companyMember.findUnique({ where: { companyId_userId: { companyId, userId } } });
  if (!member) throw new ApiError(403, 'Company access denied', 'FORBIDDEN');
  return member;
}

export async function listCompanyCampaigns(userId: string) {
  return jsonSafe(await prisma.campaign.findMany({ where: { company: { members: { some: { userId } } } }, include: { company: true, influencers: { include: { kol: true } }, events: true }, orderBy: { createdAt: 'desc' } }));
}

export async function createCampaign(userId: string, input: any) {
  await assertCompanyAccess(userId, input.companyId);
  return prisma.campaign.create({ data: input });
}

export async function createCompany(userId: string, input: any) {
  return prisma.company.create({ data: { ...input, members: { create: { userId, role: 'OWNER' } } }, include: { members: true } });
}

export async function listCompanies(userId: string) {
  return prisma.company.findMany({ where: { members: { some: { userId } } }, include: { _count: { select: { campaigns: true } } }, orderBy: { createdAt: 'desc' } });
}

export async function getCampaign(userId: string, campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { company: true, influencers: { include: { kol: { include: { scores: scoreSelect, socialAccounts: true } }, trackingLinks: true } } } });
  if (!campaign) throw new ApiError(404, 'Campaign not found', 'NOT_FOUND');
  await assertCompanyAccess(userId, campaign.companyId);
  return jsonSafe(campaign);
}

export async function updateCampaignStatus(userId: string, campaignId: string, status: any) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new ApiError(404, 'Campaign not found', 'NOT_FOUND');
  const member = await assertCompanyAccess(userId, campaign.companyId);
  if (!['OWNER', 'MANAGER'].includes(member.role)) throw new ApiError(403, 'Campaign management permission required', 'FORBIDDEN');
  return prisma.campaign.update({ where: { id: campaignId }, data: { status } });
}

export async function getCampaignMatches(userId: string, campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new ApiError(404, 'Campaign not found', 'NOT_FOUND');
  await assertCompanyAccess(userId, campaign.companyId);
  const kols = await prisma.kOL.findMany({ where: { isPublished: true }, include: { scores: scoreSelect, socialAccounts: true } });
  const countries = campaign.countryTargets as string[]; const languages = campaign.languageTargets as string[]; const categories = campaign.categories as string[];
  return jsonSafe(kols.map((kol) => {
    const kolCategories = kol.categories as string[]; const score = kol.scores[0];
    const country = countries.includes(kol.country) ? 100 : 30; const language = languages.includes(kol.language) ? 100 : 25;
    const category = categories.length ? (categories.filter((item) => kolCategories.includes(item)).length / categories.length) * 100 : 50;
    const platform = kol.socialAccounts.length ? 80 : 20; const trust = Number(score?.trust || 0); const risk = 100 - Number(score?.risk || 100);
    const matchScore = country * .2 + language * .15 + category * .3 + platform * .1 + trust * .15 + risk * .1;
    return { kol, matchScore: Math.round(matchScore * 100) / 100, factors: { country, language, category, platform, trust, risk } };
  }).sort((a, b) => b.matchScore - a.matchScore));
}

export async function assignKOL(userId: string, campaignId: string, input: any) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new ApiError(404, 'Campaign not found', 'NOT_FOUND');
  await assertCompanyAccess(userId, campaign.companyId);
  const code = `${campaignId.slice(-6)}-${randomBytes(8).toString('hex')}`;
  return prisma.campaignInfluencer.create({ data: { campaignId, kolId: input.kolId, agreedPrice: input.agreedPrice, currency: input.currency, deliverable: input.deliverable, notes: input.notes, trackingLinks: { create: { campaignId, code, destinationUrl: input.destinationUrl } } }, include: { kol: true, trackingLinks: true } });
}

export async function getCampaignAnalytics(userId: string, campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { influencers: { include: { kol: true, trackingLinks: { include: { events: true } } } }, events: true } });
  if (!campaign) throw new ApiError(404, 'Campaign not found', 'NOT_FOUND');
  await assertCompanyAccess(userId, campaign.companyId);
  const rows = campaign.influencers.map((item) => ({ influencer: item.kol, ...calculateCampaignAnalytics(Number(item.agreedPrice), item.trackingLinks.flatMap((link) => link.events).map((event) => ({ eventType: event.eventType, value: event.value ? Number(event.value) : null }))) }));
  return jsonSafe({ campaign, totals: calculateCampaignAnalytics(rows.reduce((sum, row) => sum + row.spend, 0), campaign.events.map((event) => ({ eventType: event.eventType, value: event.value ? Number(event.value) : null }))), influencers: rows });
}

export async function ingestEvent(input: any) {
  const link = await prisma.campaignTrackingLink.findUnique({ where: { code: input.trackingCode } });
  if (!link?.isActive) throw new ApiError(404, 'Tracking link not found', 'NOT_FOUND');
  return jsonSafe(await prisma.campaignEvent.upsert({ where: { idempotencyKey: input.idempotencyKey }, update: {}, create: { campaignId: link.campaignId, trackingLinkId: link.id, eventType: input.eventType, idempotencyKey: input.idempotencyKey, attributionIdHash: input.attributionIdHash, value: input.value, currency: input.currency, occurredAt: input.occurredAt, source: input.source, metadata: input.metadata } }));
}

export async function resolveTrackingRedirect(code: string) {
  const link = await prisma.campaignTrackingLink.findUnique({ where: { code } });
  if (!link?.isActive) throw new ApiError(404, 'Tracking link not found', 'NOT_FOUND');
  await prisma.campaignEvent.create({ data: { campaignId: link.campaignId, trackingLinkId: link.id, eventType: 'CLICK', idempotencyKey: `redirect-${randomUUID()}`, source: 'redirect', occurredAt: new Date() } });
  return link.destinationUrl;
}

export async function createKOL(actorId: string, input: any) {
  return prisma.$transaction(async (tx) => {
    const kol = await tx.kOL.create({ data: input });
    await tx.kOLAuditLog.create({ data: { actorId, action: 'KOL_CREATED', entityType: 'KOL', entityId: kol.id, afterData: input } });
    return kol;
  });
}

export async function lookupXProfile(profileUrl: string) {
  return fetchXProfile(profileUrl);
}

async function availableKOLSlug(username: string, platformUserId: string) {
  const base = username.toLowerCase().replace(/_/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 90) || `x-${platformUserId}`;
  const existing = await prisma.kOL.findUnique({ where: { slug: base }, select: { id: true } });
  if (!existing) return base;
  return `${base}-x-${platformUserId.slice(-6)}`.slice(0, 100);
}

export async function importXProfile(actorId: string, input: { profileUrl: string; categories: string[]; country: string; language: string }) {
  const profile = await fetchXProfile(input.profileUrl);
  const existingAccount = await prisma.kOLSocialAccount.findFirst({
    where: { platform: 'X', OR: [{ platformUserId: profile.platformUserId }, { handle: `@${profile.username}` }] },
    include: { kol: true },
  });
  if (existingAccount) throw new ApiError(409, `${existingAccount.kol.displayName} zaten KOL listesinde kayıtlı.`, 'KOL_ALREADY_IMPORTED');

  const slug = await availableKOLSlug(profile.username, profile.platformUserId);
  const measuredAt = new Date(profile.fetchedAt);
  const platformCreatedAt = profile.createdAt ? new Date(profile.createdAt) : null;
  const accountAgeDays = platformCreatedAt ? Math.max(0, Math.floor((measuredAt.getTime() - platformCreatedAt.getTime()) / 86_400_000)) : null;

  return prisma.$transaction(async (tx) => {
    const kol = await tx.kOL.create({
      data: {
        slug,
        displayName: profile.displayName,
        username: `@${profile.username}`,
        avatarUrl: profile.avatarUrl ?? null,
        country: input.country,
        language: input.language,
        bio: profile.bio || null,
        categories: input.categories,
        isVerified: false,
        isPublished: false,
        socialAccounts: {
          create: {
            platform: 'X',
            platformUserId: profile.platformUserId,
            handle: `@${profile.username}`,
            profileUrl: profile.profileUrl,
            followerCount: BigInt(profile.followersCount),
            followingCount: BigInt(profile.followingCount),
            contentCount: BigInt(profile.contentCount),
            listedCount: BigInt(profile.listedCount),
            platformVerified: profile.verified,
            platformCreatedAt,
            accountAgeDays,
            sourceType: 'PLATFORM_API',
            verified: true,
            verificationDate: measuredAt,
            confidence: 'HIGH',
            sourceReference: profile.profileUrl,
            measuredAt,
          },
        },
      },
      include: { socialAccounts: true, scores: scoreSelect },
    });
    await audit(tx, actorId, 'KOL_IMPORTED_FROM_X', 'KOL', kol.id, undefined, { profileUrl: profile.profileUrl, platformUserId: profile.platformUserId, categories: input.categories });
    return jsonSafe(kol);
  });
}

async function audit(tx: Prisma.TransactionClient, actorId: string, action: string, entityType: string, entityId: string, beforeData?: unknown, afterData?: unknown) {
  await tx.kOLAuditLog.create({ data: { actorId, action, entityType, entityId, beforeData: beforeData as Prisma.InputJsonValue, afterData: afterData as Prisma.InputJsonValue } });
}

export async function updateKOL(actorId: string, id: string, input: any) {
  return prisma.$transaction(async (tx) => { const before = await tx.kOL.findUnique({ where: { id } }); if (!before) throw new ApiError(404, 'KOL not found', 'NOT_FOUND'); const after = await tx.kOL.update({ where: { id }, data: input }); await audit(tx, actorId, 'KOL_UPDATED', 'KOL', id, before, after); return after; });
}

export async function addSocialAccount(actorId: string, kolId: string, input: any) {
  return prisma.$transaction(async (tx) => { const item = await tx.kOLSocialAccount.create({ data: { kolId, ...input, verificationDate: input.verified ? new Date() : null } }); await audit(tx, actorId, 'SOCIAL_ACCOUNT_ADDED', 'KOLSocialAccount', item.id, undefined, item); return jsonSafe(item); });
}

export async function addScore(actorId: string, kolId: string, input: any) {
  const calculated = calculateKOLScore(input);
  return prisma.$transaction(async (tx) => { const item = await tx.kOLScore.create({ data: { kolId, overall: calculated.overall, trust: input.trust, audienceQuality: input.audienceQuality, engagementQuality: input.engagementQuality, marketKnowledge: input.marketKnowledge, predictionAccuracy: input.predictionAccuracy, campaignPerformance: input.campaignPerformance, transparency: input.transparency, risk: input.risk, confidence: calculated.confidence, sampleSize: input.sampleSize, verifiedDataRatio: input.verifiedDataRatio, methodologyVersion: KOL_SCORE_METHODOLOGY_VERSION } }); await audit(tx, actorId, 'SCORE_CALCULATED', 'KOLScore', item.id, undefined, item); return item; });
}

export async function recalculateScore(actorId: string, kolId: string) {
  const latest = await prisma.kOLScore.findFirst({ where: { kolId }, orderBy: { calculatedAt: 'desc' } });
  if (!latest) throw new ApiError(422, 'A score input record is required before recalculation', 'SCORE_INPUT_REQUIRED');
  const predictions = await prisma.kOLPrediction.findMany({ where: { kolId }, select: { result: true } });
  const accuracy = calculatePredictionAccuracy(predictions.map((item) => item.result));
  return addScore(actorId, kolId, { trust: Number(latest.trust), audienceQuality: Number(latest.audienceQuality), engagementQuality: Number(latest.engagementQuality), marketKnowledge: Number(latest.marketKnowledge), predictionAccuracy: accuracy.evaluated ? accuracy.score : Number(latest.predictionAccuracy), campaignPerformance: Number(latest.campaignPerformance), transparency: Number(latest.transparency), risk: Number(latest.risk), sampleSize: Math.max(accuracy.evaluated, latest.sampleSize), verifiedDataRatio: Number(latest.verifiedDataRatio), freshnessDays: 0 });
}

export async function addPrediction(actorId: string, kolId: string, input: any) {
  return prisma.$transaction(async (tx) => { const item = await tx.kOLPrediction.create({ data: { kolId, ...input } }); await audit(tx, actorId, 'PREDICTION_CAPTURED', 'KOLPrediction', item.id, undefined, item); return item; });
}

export async function evaluatePrediction(actorId: string, kolId: string, predictionId: string, input: any) {
  return prisma.$transaction(async (tx) => { const before = await tx.kOLPrediction.findFirst({ where: { id: predictionId, kolId } }); if (!before) throw new ApiError(404, 'Prediction not found', 'NOT_FOUND'); const item = await tx.kOLPrediction.update({ where: { id: predictionId }, data: { ...input, evaluatedByUserId: actorId } }); await audit(tx, actorId, 'PREDICTION_EVALUATED', 'KOLPrediction', item.id, before, item); return item; });
}

export async function addRiskEvent(actorId: string, kolId: string, input: any) {
  const safeInput = input.visibility === 'PUBLIC' && !input.verified ? { ...input, visibility: 'INTERNAL' } : input;
  return prisma.$transaction(async (tx) => { const item = await tx.kOLRiskEvent.create({ data: { kolId, ...safeInput } }); await audit(tx, actorId, 'RISK_EVENT_CREATED', 'KOLRiskEvent', item.id, undefined, item); return item; });
}

export async function addAudienceMetric(actorId: string, kolId: string, input: any) {
  return prisma.$transaction(async (tx) => { const item = await tx.kOLAudienceMetric.create({ data: { kolId, ...input } }); await audit(tx, actorId, 'AUDIENCE_METRIC_ADDED', 'KOLAudienceMetric', item.id, undefined, item); return jsonSafe(item); });
}

export async function getKOLDashboard(userId: string) {
  const kol = await prisma.kOL.findUnique({ where: { userId }, include: { scores: { orderBy: { calculatedAt: 'desc' }, take: 12 }, socialAccounts: true, predictions: { orderBy: { publishedAt: 'desc' }, take: 50 }, campaignInfluencers: { include: { campaign: { include: { company: true } }, trackingLinks: { include: { events: true } } }, orderBy: { startDate: 'desc' } } } });
  if (!kol) throw new ApiError(404, 'No KOL profile is linked to this account', 'KOL_PROFILE_NOT_FOUND');
  return jsonSafe(kol);
}

export async function adminListKOLs() { return jsonSafe(await prisma.kOL.findMany({ include: { socialAccounts: true, scores: scoreSelect, predictions: { orderBy: { publishedAt: 'desc' }, take: 50 }, riskEvents: { orderBy: { occurredAt: 'desc' }, take: 50 }, audienceMetrics: { orderBy: { measuredAt: 'desc' }, take: 20 } }, orderBy: { updatedAt: 'desc' } })); }
export async function adminListCampaigns() { return jsonSafe(await prisma.campaign.findMany({ include: { company: true, influencers: { include: { kol: true } } }, orderBy: { updatedAt: 'desc' } })); }
export async function adminUpdateCampaignStatus(actorId: string, campaignId: string, status: any) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.campaign.findUnique({ where: { id: campaignId } });
    if (!before) throw new ApiError(404, 'Campaign not found', 'NOT_FOUND');
    const after = await tx.campaign.update({ where: { id: campaignId }, data: { status } });
    await audit(tx, actorId, 'CAMPAIGN_STATUS_CHANGED', 'Campaign', campaignId, before, after);
    return after;
  });
}
