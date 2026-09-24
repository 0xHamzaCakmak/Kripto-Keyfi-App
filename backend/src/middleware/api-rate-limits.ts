import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

// Mounted at /api: dashboard polling must not consume the login/refresh budget.
export function createApiRateLimits(disabled = false): RequestHandler {
  const options = {
    standardHeaders: 'draft-8' as const,
    legacyHeaders: false,
    skip: () => disabled,
    message: { success: false, error: { code: 'RATE_LIMITED', message: 'İstek sınırına ulaşıldı. Lütfen kısa süre sonra tekrar deneyin.' } },
  };
  const session = rateLimit({ ...options, windowMs: 60_000, limit: 60 });
  const polling = rateLimit({ ...options, windowMs: 60_000, limit: 120 });
  const general = rateLimit({ ...options, windowMs: 15 * 60_000, limit: 300, skipFailedRequests: true });
  return (req, res, next) => {
    if (req.path === '/auth' || req.path.startsWith('/auth/')) return session(req, res, next);
    if (req.method === 'GET' && (req.path === '/admin/trading' || req.path.startsWith('/admin/trading/'))) return polling(req, res, next);
    return general(req, res, next);
  };
}
