import { z } from 'zod';

export const kolListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  country: z.string().trim().max(80).optional(),
  language: z.string().trim().max(16).optional(),
  platform: z.enum(['X', 'YOUTUBE', 'TELEGRAM', 'DISCORD', 'OTHER']).optional(),
  verified: z.enum(['true', 'false']).optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  sort: z.enum(['score', 'trust', 'accuracy', 'campaign', 'audience', 'followers', 'newest']).default('score'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

export const slugParamsSchema = z.object({ slug: z.string().trim().min(1).max(100) });
export const idParamsSchema = z.object({ id: z.string().cuid() });

export const createCampaignSchema = z.object({
  companyId: z.string().cuid(), name: z.string().trim().min(2).max(180), project: z.string().trim().min(2).max(180),
  description: z.string().trim().max(5000).optional(), goal: z.string().trim().min(2).max(80),
  budget: z.number().positive(), currency: z.string().trim().min(3).max(12).default('USD'),
  countryTargets: z.array(z.string().trim().min(2).max(80)).min(1), languageTargets: z.array(z.string().trim().min(2).max(16)).min(1),
  audienceTargets: z.array(z.string().trim().min(2).max(100)).default([]), categories: z.array(z.string().trim().min(2).max(80)).min(1),
  startDate: z.coerce.date(), endDate: z.coerce.date(), kpi: z.string().trim().min(2).max(80), conversionTarget: z.number().int().positive().optional(),
}).refine((value) => value.endDate >= value.startDate, { message: 'End date must be after start date', path: ['endDate'] });

export const assignKOLSchema = z.object({
  kolId: z.string().cuid(), agreedPrice: z.number().nonnegative(), currency: z.string().trim().min(3).max(12).default('USD'),
  deliverable: z.string().trim().min(2).max(120), destinationUrl: z.string().url().max(900), notes: z.string().trim().max(2000).optional(),
});

export const campaignEventSchema = z.object({
  trackingCode: z.string().trim().min(8).max(80), eventType: z.enum(['IMPRESSION', 'CLICK', 'REGISTRATION', 'EMAIL_VERIFIED', 'KYC', 'DEPOSIT', 'TRADE', 'WALLET_CONNECT', 'PURCHASE', 'SUBSCRIPTION', 'CUSTOM_CONVERSION']),
  idempotencyKey: z.string().trim().min(12).max(191), attributionIdHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
  value: z.number().nonnegative().optional(), currency: z.string().trim().min(3).max(12).optional(), occurredAt: z.coerce.date().default(() => new Date()),
  source: z.string().trim().min(2).max(80).default('tracking'), metadata: z.record(z.unknown()).optional(),
});

export const adminKOLSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).max(100), displayName: z.string().trim().min(2).max(160), username: z.string().trim().min(2).max(100),
  avatarUrl: z.string().url().max(700).optional(), country: z.string().trim().min(2).max(80), language: z.string().trim().min(2).max(16),
  bio: z.string().trim().max(5000).optional(), categories: z.array(z.string().trim().min(2).max(80)).min(1), isVerified: z.boolean().default(false), isPublished: z.boolean().default(false),
});

export const adminKOLUpdateSchema = adminKOLSchema.partial().refine((value) => Object.keys(value).length > 0, 'At least one field is required');
const scoreValue = z.number().min(0).max(100);

export const socialAccountSchema = z.object({
  platform: z.enum(['X', 'YOUTUBE', 'TELEGRAM', 'DISCORD', 'OTHER']), handle: z.string().trim().min(1).max(160),
  profileUrl: z.string().url().max(700).optional(), followerCount: z.coerce.bigint().nonnegative(), engagementRate: z.number().min(0).max(100).optional(),
  accountAgeDays: z.number().int().nonnegative().optional(), sourceType: z.enum(['VERIFIED_CAMPAIGN', 'PLATFORM_API', 'ADMIN_MANUAL', 'INFLUENCER_REPORTED', 'COMPANY_REPORTED', 'ESTIMATED', 'THIRD_PARTY']),
  verified: z.boolean().default(false), confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('LOW'), sourceReference: z.string().url().max(700).optional(), measuredAt: z.coerce.date(),
});

export const scoreInputSchema = z.object({
  trust: scoreValue, audienceQuality: scoreValue, engagementQuality: scoreValue, marketKnowledge: scoreValue,
  predictionAccuracy: scoreValue, campaignPerformance: scoreValue, transparency: scoreValue, risk: scoreValue,
  sampleSize: z.number().int().nonnegative(), verifiedDataRatio: z.number().min(0).max(1), freshnessDays: z.number().int().nonnegative().default(0),
});

export const predictionSchema = z.object({
  assetSymbol: z.string().trim().min(1).max(30).transform((value) => value.toUpperCase()), platform: z.enum(['X', 'YOUTUBE', 'TELEGRAM', 'DISCORD', 'OTHER']),
  sourceUrl: z.string().url().max(700), sourceContent: z.string().trim().min(3).max(20_000), sourceContentHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(), sourceSnapshotRef: z.string().url().max(700).optional(),
  publishedAt: z.coerce.date(), direction: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']), referencePrice: z.number().positive(), targetPrice: z.number().positive().optional(),
  invalidationPrice: z.number().positive().optional(), timeHorizonDays: z.number().int().min(1).max(3650), confidence: z.number().min(0).max(100).optional(),
});

export const predictionEvaluationSchema = z.object({
  result: z.enum(['CORRECT', 'PARTIALLY_CORRECT', 'INCORRECT', 'EXPIRED', 'INVALID']), evaluationDate: z.coerce.date(), evaluationNotes: z.string().trim().min(3).max(5000),
});

export const riskEventSchema = z.object({
  type: z.enum(['SCAM_PROMOTION', 'RUG_PROMOTION', 'MISLEADING_CLAIM', 'UNDISCLOSED_AD', 'DELETED_PROMOTION', 'FAKE_ENGAGEMENT', 'SUSPICIOUS_GROWTH', 'COMMUNITY_COMPLAINT', 'CONFLICT_OF_INTEREST', 'OTHER']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']), title: z.string().trim().min(3).max(220), description: z.string().trim().min(3).max(10_000),
  evidenceUrl: z.string().url().max(700).optional(), verified: z.boolean().default(false), visibility: z.enum(['INTERNAL', 'PUBLIC']).default('INTERNAL'), occurredAt: z.coerce.date(), adminNotes: z.string().trim().max(5000).optional(),
});

export const audienceMetricSchema = z.object({
  platform: z.enum(['X', 'YOUTUBE', 'TELEGRAM', 'DISCORD', 'OTHER']), totalFollowers: z.coerce.bigint().nonnegative(), estimatedRealAudience: z.coerce.bigint().nonnegative().optional(),
  estimatedBotPercentage: z.number().min(0).max(100).optional(), engagementRate: z.number().min(0).max(100).optional(), averageViews: z.coerce.bigint().nonnegative().optional(),
  averageComments: z.number().int().nonnegative().optional(), averageShares: z.number().int().nonnegative().optional(), averageLikes: z.number().int().nonnegative().optional(), suspiciousGrowth: z.boolean().default(false),
  distribution: z.record(z.unknown()).optional(), sourceType: z.enum(['VERIFIED_CAMPAIGN', 'PLATFORM_API', 'ADMIN_MANUAL', 'INFLUENCER_REPORTED', 'COMPANY_REPORTED', 'ESTIMATED', 'THIRD_PARTY']),
  verified: z.boolean().default(false), confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('LOW'), sourceReference: z.string().url().max(700).optional(), measuredAt: z.coerce.date(),
});

export const companySchema = z.object({ name: z.string().trim().min(2).max(180), website: z.string().url().max(500).optional(), sector: z.string().trim().max(100).optional(), country: z.string().trim().min(2).max(80) });
export const campaignStatusSchema = z.object({ status: z.enum(['DRAFT', 'PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED']) });
export const predictionIdParamsSchema = z.object({ id: z.string().cuid(), predictionId: z.string().cuid() });
