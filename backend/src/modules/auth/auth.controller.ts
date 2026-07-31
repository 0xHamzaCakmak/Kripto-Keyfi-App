import type { Request, Response } from 'express';
import { REFRESH_COOKIE_NAME } from '../../config/constants.js';
import { clearRefreshCookie, setRefreshCookie } from '../../security/cookies.js';
import { success } from '../../utils/response.js';
import type { LoginInput } from './auth.schema.js';
import * as authService from './auth.service.js';

const metadataFrom = (req: { ip: string | undefined; get(name: string): string | undefined }) => ({
  ipAddress: req.ip ?? null,
  userAgent: req.get('user-agent')?.slice(0, 2_000) ?? null,
});

export async function login(req: Request<object, object, LoginInput>, res: Response) {
  const result = await authService.login(req.body, metadataFrom(req));
  setRefreshCookie(res, result.refreshToken);
  return success(res, { accessToken: result.accessToken, user: result.user });
}

export async function refresh(req: Request, res: Response) {
  const rawToken = req.cookies[REFRESH_COOKIE_NAME] as string | undefined;
  if (!rawToken) return res.status(401).json({ success: false, error: { code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is required' } });
  const result = await authService.refresh(rawToken, metadataFrom(req));
  setRefreshCookie(res, result.refreshToken);
  return success(res, { accessToken: result.accessToken, user: result.user });
}

export async function logout(req: Request, res: Response) {
  await authService.logout(req.cookies[REFRESH_COOKIE_NAME] as string | undefined);
  clearRefreshCookie(res);
  return success(res, { message: 'Logged out' });
}

export async function me(req: Request, res: Response) {
  return success(res, { user: await authService.getMe(req.user!.id) });
}
