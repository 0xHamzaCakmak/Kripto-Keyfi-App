import { randomUUID } from 'node:crypto';
import { AuthProvider, Prisma, UserRole, UserStatus } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { hashPassword, verifyPassword } from '../../security/password.js';
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../../security/tokens.js';
import { ApiError } from '../../utils/api-error.js';
import type { AuthResult, PublicUser, RequestMetadata } from './auth.types.js';
import type { GoogleInput, LoginInput, RegisterInput } from './auth.schema.js';
import { verifyGoogleCredential } from './google-identity.js';
import { publicUserSelect, serializePublicUser, type SelectedPublicUser } from '../users/user.presenter.js';

const sessionExpiry = () => new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

const tokenPair = async (user: { id: string; role: 'ADMIN' | 'USER' }, sessionId: string) => {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ sub: user.id, role: user.role, sid: sessionId }),
    signRefreshToken({ sub: user.id, sid: sessionId }),
  ]);
  return { accessToken, refreshToken };
};

export async function login(input: LoginInput, metadata: RequestMetadata): Promise<AuthResult & { refreshToken: string }> {
  const user = await prisma.user.findUnique({ where: { email: input.email }, select: publicUserSelect });
  if (!user?.passwordHash || !(await verifyPassword(user.passwordHash, input.password))) {
    throw new ApiError(401, 'Email or password is incorrect', 'INVALID_CREDENTIALS');
  }
  if (user.status !== 'ACTIVE') throw new ApiError(403, 'This account is not active', 'ACCOUNT_INACTIVE');

  return createSession(user, metadata);
}

export async function register(input: RegisterInput, metadata: RequestMetadata): Promise<AuthResult & { refreshToken: string }> {
  const passwordHash = await hashPassword(input.password);
  const acceptedAt = new Date();
  let user: SelectedPublicUser;
  try {
    user = await prisma.user.create({ data: {
      email: input.email, username: input.username, name: input.fullName, passwordHash,
      role: UserRole.USER, status: UserStatus.ACTIVE, emailVerifiedAt: null,
      termsAcceptedAt: acceptedAt, privacyAcceptedAt: acceptedAt,
    }, select: publicUserSelect });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const fields = Array.isArray(error.meta?.target) ? error.meta.target.join(',') : String(error.meta?.target ?? '');
      if (fields.includes('username')) throw new ApiError(409, 'Bu kullanıcı adı kullanılıyor.', 'USERNAME_EXISTS');
      throw new ApiError(409, 'Bu e-posta adresiyle daha önce hesap oluşturulmuş.', 'EMAIL_EXISTS');
    }
    throw error;
  }
  return createSession(user, metadata);
}

export async function google(input: GoogleInput, metadata: RequestMetadata): Promise<AuthResult & { refreshToken: string }> {
  const identity = await verifyGoogleCredential(input.credential);
  const linked = await prisma.userIdentity.findUnique({
    where: { provider_providerSubject: { provider: AuthProvider.GOOGLE, providerSubject: identity.subject } },
    include: { user: { select: publicUserSelect } },
  });
  if (linked) {
    if (linked.user.status !== UserStatus.ACTIVE) throw new ApiError(403, 'Bu hesap aktif değil.', 'ACCOUNT_INACTIVE');
    return createSession(linked.user, metadata);
  }

  const existing = await prisma.user.findUnique({ where: { email: identity.email }, select: publicUserSelect });
  let user: SelectedPublicUser;
  if (existing) {
    if (existing.status !== UserStatus.ACTIVE) throw new ApiError(403, 'Bu hesap aktif değil.', 'ACCOUNT_INACTIVE');
    const authoritativeEmail = identity.email.endsWith('@gmail.com') || Boolean(identity.hostedDomain);
    if (!authoritativeEmail) throw new ApiError(409, 'Bu e-posta için mevcut hesaptan giriş yaparak Google bağlantısını onaylamalısınız.', 'GOOGLE_ACCOUNT_LINK_REQUIRED');
    await prisma.userIdentity.create({ data: { userId: existing.id, provider: AuthProvider.GOOGLE, providerSubject: identity.subject, emailAtLink: identity.email } });
    user = await prisma.user.update({ where: { id: existing.id }, data: {
      emailVerifiedAt: existing.emailVerifiedAt ?? new Date(), avatarUrl: existing.avatarUrl ?? identity.picture,
    }, select: publicUserSelect });
  } else {
    if (!input.termsAccepted || !input.privacyAccepted) {
      throw new ApiError(409, 'Google ile ilk kayıt için kullanım şartları ve gizlilik metni kabul edilmelidir.', 'GOOGLE_REGISTRATION_CONSENT_REQUIRED');
    }
    const acceptedAt = new Date();
    const username = await availableUsername(identity.name ?? identity.email.split('@')[0] ?? 'user');
    user = await prisma.$transaction(async (transaction) => transaction.user.create({ data: {
      email: identity.email, username, name: identity.name, avatarUrl: identity.picture, passwordHash: null,
      emailVerifiedAt: acceptedAt, termsAcceptedAt: acceptedAt, privacyAcceptedAt: acceptedAt,
      role: UserRole.USER, status: UserStatus.ACTIVE,
      identities: { create: { provider: AuthProvider.GOOGLE, providerSubject: identity.subject, emailAtLink: identity.email } },
    }, select: publicUserSelect }));
  }
  return createSession(user, metadata);
}

export async function refresh(rawToken: string, metadata: RequestMetadata): Promise<AuthResult & { refreshToken: string }> {
  let claims: Awaited<ReturnType<typeof verifyRefreshToken>>;
  try {
    claims = await verifyRefreshToken(rawToken);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  const current = await prisma.refreshSession.findUnique({
    where: { id: claims.sid }, include: { user: { select: publicUserSelect } },
  });
  if (
    !current || current.userId !== claims.sub || current.tokenHash !== hashToken(rawToken) ||
    current.revokedAt || current.expiresAt <= new Date() || current.user.status !== 'ACTIVE'
  ) throw new ApiError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');

  const nextSessionId = randomUUID();
  const nextTokens = await tokenPair(current.user, nextSessionId);
  const now = new Date();
  await prisma.$transaction(async (transaction) => {
    const revoked = await transaction.refreshSession.updateMany({
      where: { id: current.id, revokedAt: null }, data: { revokedAt: now },
    });
    if (revoked.count !== 1) throw new ApiError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
    await transaction.refreshSession.create({
      data: {
        id: nextSessionId, userId: current.userId, tokenHash: hashToken(nextTokens.refreshToken),
        expiresAt: sessionExpiry(), ipAddress: metadata.ipAddress, userAgent: metadata.userAgent,
      },
    });
  });
  return { ...nextTokens, user: serializePublicUser(current.user) };
}

export async function logout(rawToken?: string): Promise<void> {
  if (!rawToken) return;
  try {
    const claims = await verifyRefreshToken(rawToken);
    await prisma.refreshSession.updateMany({
      where: { id: claims.sid, userId: claims.sub, tokenHash: hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // Logout is intentionally idempotent, including malformed or expired cookies.
  }
}

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
  if (!user || user.status !== 'ACTIVE') throw new ApiError(401, 'Authentication required', 'UNAUTHORIZED');
  return serializePublicUser(user);
}

async function createSession(user: SelectedPublicUser, metadata: RequestMetadata): Promise<AuthResult & { refreshToken: string }> {
  const sessionId = randomUUID();
  const tokens = await tokenPair(user, sessionId);
  const [, updatedUser] = await prisma.$transaction([
    prisma.refreshSession.create({ data: {
      id: sessionId, userId: user.id, tokenHash: hashToken(tokens.refreshToken), expiresAt: sessionExpiry(),
      ipAddress: metadata.ipAddress, userAgent: metadata.userAgent,
    } }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() }, select: publicUserSelect }),
  ]);
  return { ...tokens, user: serializePublicUser(updatedUser) };
}

async function availableUsername(source: string) {
  const normalized = source.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || 'user';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = attempt === 0 ? normalized : `${normalized}_${attempt + 1}`;
    if (!(await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } }))) return candidate;
  }
  return `user_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
}
