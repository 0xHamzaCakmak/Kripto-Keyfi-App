import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import { verifyPassword } from '../../security/password.js';
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '../../security/tokens.js';
import { ApiError } from '../../utils/api-error.js';
import type { AuthResult, PublicUser, RequestMetadata } from './auth.types.js';
import type { LoginInput } from './auth.schema.js';

const publicUserSelect = {
  id: true, email: true, name: true, role: true, status: true, mustChangePassword: true,
  lastLoginAt: true, createdAt: true,
} as const;

const sessionExpiry = () => new Date(Date.now() + env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

const tokenPair = async (user: { id: string; role: 'ADMIN' | 'USER' }, sessionId: string) => {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken({ sub: user.id, role: user.role, sid: sessionId }),
    signRefreshToken({ sub: user.id, sid: sessionId }),
  ]);
  return { accessToken, refreshToken };
};

export async function login(input: LoginInput, metadata: RequestMetadata): Promise<AuthResult & { refreshToken: string }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await verifyPassword(user.passwordHash, input.password))) {
    throw new ApiError(401, 'Email or password is incorrect', 'INVALID_CREDENTIALS');
  }
  if (user.status !== 'ACTIVE') throw new ApiError(403, 'This account is not active', 'ACCOUNT_INACTIVE');

  const sessionId = randomUUID();
  const tokens = await tokenPair(user, sessionId);
  const now = new Date();
  const [, updatedUser] = await prisma.$transaction([
    prisma.refreshSession.create({
      data: {
        id: sessionId, userId: user.id, tokenHash: hashToken(tokens.refreshToken), expiresAt: sessionExpiry(),
        ipAddress: metadata.ipAddress, userAgent: metadata.userAgent,
      },
    }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now }, select: publicUserSelect }),
  ]);
  return { ...tokens, user: updatedUser };
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
  return { ...nextTokens, user: current.user };
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
  return user;
}

