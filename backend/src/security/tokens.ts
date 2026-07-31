import { createHash } from 'node:crypto';
import type { UserRole } from '@prisma/client';
import { jwtVerify, SignJWT } from 'jose';
import { env } from '../config/env.js';
import { ACCESS_TOKEN_AUDIENCE, REFRESH_TOKEN_AUDIENCE, TOKEN_ISSUER } from '../config/constants.js';

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export type AccessClaims = { sub: string; role: UserRole; sid: string };
export type RefreshClaims = { sub: string; sid: string };

export const signAccessToken = ({ sub, role, sid }: AccessClaims) => new SignJWT({ role, sid })
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .setSubject(sub)
  .setIssuer(TOKEN_ISSUER)
  .setAudience(ACCESS_TOKEN_AUDIENCE)
  .setIssuedAt()
  .setExpirationTime(`${env.ACCESS_TOKEN_MINUTES}m`)
  .sign(accessSecret);

export const signRefreshToken = ({ sub, sid }: RefreshClaims) => new SignJWT({ sid })
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .setSubject(sub)
  .setIssuer(TOKEN_ISSUER)
  .setAudience(REFRESH_TOKEN_AUDIENCE)
  .setIssuedAt()
  .setExpirationTime(`${env.REFRESH_TOKEN_DAYS}d`)
  .sign(refreshSecret);

export const verifyAccessToken = async (token: string): Promise<AccessClaims> => {
  const { payload } = await jwtVerify(token, accessSecret, {
    algorithms: ['HS256'], issuer: TOKEN_ISSUER, audience: ACCESS_TOKEN_AUDIENCE,
  });
  if (!payload.sub || typeof payload.sid !== 'string' || (payload.role !== 'ADMIN' && payload.role !== 'USER')) {
    throw new Error('Invalid access token claims');
  }
  return { sub: payload.sub, sid: payload.sid, role: payload.role };
};

export const verifyRefreshToken = async (token: string): Promise<RefreshClaims> => {
  const { payload } = await jwtVerify(token, refreshSecret, {
    algorithms: ['HS256'], issuer: TOKEN_ISSUER, audience: REFRESH_TOKEN_AUDIENCE,
  });
  if (!payload.sub || typeof payload.sid !== 'string') throw new Error('Invalid refresh token claims');
  return { sub: payload.sub, sid: payload.sid };
};

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

