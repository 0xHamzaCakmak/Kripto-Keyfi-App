import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';

const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export type VerifiedGoogleIdentity = {
  subject: string; email: string; emailVerified: boolean; name: string | null; picture: string | null; hostedDomain: string | null;
};

export async function verifyGoogleCredential(credential: string): Promise<VerifiedGoogleIdentity> {
  if (!env.GOOGLE_CLIENT_ID) throw new ApiError(503, 'Google ile giriş henüz yapılandırılmadı.', 'GOOGLE_AUTH_NOT_CONFIGURED');
  try {
    const { payload } = await jwtVerify(credential, googleKeys, {
      algorithms: ['RS256'], audience: env.GOOGLE_CLIENT_ID, issuer: ['accounts.google.com', 'https://accounts.google.com'],
    });
    if (!payload.sub || typeof payload.email !== 'string' || payload.email_verified !== true) {
      throw new Error('required Google identity claims are missing');
    }
    return {
      subject: payload.sub, email: payload.email.trim().toLowerCase(), emailVerified: true,
      name: typeof payload.name === 'string' ? payload.name.trim().slice(0, 120) || null : null,
      picture: typeof payload.picture === 'string' ? payload.picture.slice(0, 500) : null,
      hostedDomain: typeof payload.hd === 'string' ? payload.hd : null,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(401, 'Google kimliği doğrulanamadı.', 'INVALID_GOOGLE_CREDENTIAL');
  }
}
