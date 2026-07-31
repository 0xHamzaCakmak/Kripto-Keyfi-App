import type { CookieOptions, Response } from 'express';
import { env } from '../config/env.js';
import { API_PREFIX, REFRESH_COOKIE_NAME } from '../config/constants.js';

export const refreshCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.NODE_ENV === 'production' || env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAME_SITE,
  path: `${API_PREFIX}/auth`,
  maxAge: env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
});

export const setRefreshCookie = (res: Response, token: string) =>
  res.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions());

export const clearRefreshCookie = (res: Response) => {
  const options = refreshCookieOptions();
  delete options.maxAge;
  res.clearCookie(REFRESH_COOKIE_NAME, options);
};
