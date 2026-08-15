import { z } from 'zod';
import { env } from '../../../config/env.js';
import { ApiError } from '../../../utils/api-error.js';

const reservedXPaths = new Set([
  'compose', 'explore', 'home', 'i', 'intent', 'messages', 'notifications', 'search', 'settings', 'share',
]);

const xUserResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    name: z.string(),
    username: z.string(),
    description: z.string().optional().default(''),
    location: z.string().optional().default(''),
    profile_image_url: z.string().url().optional(),
    profile_banner_url: z.string().url().optional(),
    created_at: z.string().datetime().optional(),
    verified: z.boolean().optional().default(false),
    protected: z.boolean().optional().default(false),
    public_metrics: z.object({
      followers_count: z.number().int().nonnegative(),
      following_count: z.number().int().nonnegative(),
      tweet_count: z.number().int().nonnegative(),
      listed_count: z.number().int().nonnegative(),
    }).optional(),
  }),
});

export type XProfilePreview = {
  platform: 'X';
  platformUserId: string;
  profileUrl: string;
  username: string;
  displayName: string;
  bio: string;
  location: string;
  avatarUrl?: string;
  bannerUrl?: string;
  verified: boolean;
  protected: boolean;
  createdAt?: string;
  followersCount: number;
  followingCount: number;
  contentCount: number;
  listedCount: number;
  fetchedAt: string;
};

export function parseXProfileUrl(value: string): { username: string; profileUrl: string } {
  const candidate = value.trim();
  const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  if (host !== 'x.com' && host !== 'twitter.com') {
    throw new ApiError(422, 'Yalnızca x.com veya twitter.com profil bağlantısı kullanılabilir.', 'INVALID_X_PROFILE_URL');
  }

  const username = url.pathname.split('/').filter(Boolean)[0] ?? '';
  if (!/^[A-Za-z0-9_]{1,15}$/.test(username) || reservedXPaths.has(username.toLowerCase())) {
    throw new ApiError(422, 'Geçerli bir X profil bağlantısı girin.', 'INVALID_X_PROFILE_URL');
  }

  return { username, profileUrl: `https://x.com/${username}` };
}

export async function fetchXProfile(
  profileUrl: string,
  config: { bearerToken?: string; baseUrl?: string } = {},
): Promise<XProfilePreview> {
  const { username, profileUrl: canonicalUrl } = parseXProfileUrl(profileUrl);
  const bearerToken = config.bearerToken ?? env.X_API_BEARER_TOKEN;
  const baseUrl = config.baseUrl ?? env.X_API_BASE_URL;
  if (!bearerToken) {
    throw new ApiError(503, 'X API bağlantısı henüz yapılandırılmadı.', 'X_API_NOT_CONFIGURED');
  }

  const url = new URL(`${baseUrl}/users/by/username/${encodeURIComponent(username)}`);
  url.searchParams.set('user.fields', 'created_at,description,location,name,profile_banner_url,profile_image_url,protected,public_metrics,url,username,verified');

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${bearerToken}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApiError(502, 'X API bağlantısı kurulamadı.', 'X_API_UNAVAILABLE');
  }

  if (response.status === 404) throw new ApiError(404, 'X kullanıcısı bulunamadı.', 'X_PROFILE_NOT_FOUND');
  if (response.status === 401 || response.status === 403) throw new ApiError(503, 'X API erişim anahtarı geçersiz veya yetkisiz.', 'X_API_UNAUTHORIZED');
  if (response.status === 402) throw new ApiError(402, 'X API kredisi bulunmuyor. Developer Console üzerinden kullanım kredisi ekleyin.', 'X_API_CREDITS_REQUIRED');
  if (response.status === 429) throw new ApiError(429, 'X API istek limiti doldu. Lütfen daha sonra tekrar deneyin.', 'X_API_RATE_LIMITED');
  if (!response.ok) throw new ApiError(502, `X API profil sorgusu başarısız oldu (${response.status}).`, 'X_API_ERROR');

  const parsed = xUserResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new ApiError(502, 'X API beklenmeyen bir profil yanıtı döndürdü.', 'X_API_INVALID_RESPONSE');

  const profile = parsed.data.data;
  const metrics = profile.public_metrics;
  return {
    platform: 'X',
    platformUserId: profile.id,
    profileUrl: canonicalUrl,
    username: profile.username,
    displayName: profile.name,
    bio: profile.description,
    location: profile.location,
    ...(profile.profile_image_url ? { avatarUrl: profile.profile_image_url } : {}),
    ...(profile.profile_banner_url ? { bannerUrl: profile.profile_banner_url } : {}),
    verified: profile.verified,
    protected: profile.protected,
    ...(profile.created_at ? { createdAt: profile.created_at } : {}),
    followersCount: metrics?.followers_count ?? 0,
    followingCount: metrics?.following_count ?? 0,
    contentCount: metrics?.tweet_count ?? 0,
    listedCount: metrics?.listed_count ?? 0,
    fetchedAt: new Date().toISOString(),
  };
}
