import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { randomUUID } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { API_PREFIX } from './config/constants.js';
import { env } from './config/env.js';
import { prisma } from './database/prisma.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { adminNewsRouter } from './modules/news/news.admin.routes.js';
import { newsRouter } from './modules/news/news.routes.js';
import { userRouter } from './modules/users/user.routes.js';
import { adminKOLRouter, kolRouter, kolTrackingRouter } from './modules/kol/kol.routes.js';
import { adminVideoRouter, adminYoutubeChannelRouter, publicYoutubeChannelRouter, videoRouter } from './modules/videos/video.routes.js';
import { adminCreatorRouter, creatorRouter } from './modules/videos/creator.routes.js';
import { favoriteChannelRouter } from './modules/videos/favorite.routes.js';
import { videoReactionRouter } from './modules/videos/video-reaction.routes.js';
import { adminYoutubeScoreRouter } from './modules/videos/youtube-score.routes.js';
import { adminAnalyticsRouter, analyticsRouter } from './modules/analytics/analytics.routes.js';
import { adminChatRouter, chatRouter } from './modules/chat/chat.routes.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(pinoHttp({
    level: env.NODE_ENV === 'test' ? 'silent' : 'info',
    genReqId: (req, res) => {
      const supplied = req.headers['x-request-id'];
      const requestId = typeof supplied === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(supplied) ? supplied : randomUUID();
      res.setHeader('X-Request-ID', requestId);
      return requestId;
    },
    redact: [
      'req.headers.authorization', 'req.headers.cookie', 'req.headers.x-print-agent-token', 'req.body.password', 'req.body.new_password', 'req.body.confirmPassword', 'req.body.credential',
      'req.body.apiKey', 'req.body.apiSecret', 'req.body.passphrase', 'res.headers.set-cookie',
      'req.body.*.apiKey', 'req.body.*.apiSecret', 'req.body.*.passphrase',
    ],
  }));
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(API_PREFIX, rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipFailedRequests: true,
    skip: () => env.NODE_ENV === 'test',
  }));

  app.get(`${API_PREFIX}/health`, async (_req, res, next) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  });
  app.use(`${API_PREFIX}/auth`, authRouter);
  app.use(`${API_PREFIX}/users`, userRouter);
  app.use(`${API_PREFIX}/news`, newsRouter);
  app.use(`${API_PREFIX}/kols`, kolRouter);
  app.use(`${API_PREFIX}/videos`, videoRouter);
  app.use(`${API_PREFIX}/youtube-channels`, publicYoutubeChannelRouter);
  app.use(`${API_PREFIX}/favorites/channels`, favoriteChannelRouter);
  app.use(`${API_PREFIX}/video-reactions`, videoReactionRouter);
  app.use(`${API_PREFIX}/creator`, creatorRouter);
  app.use(`${API_PREFIX}/analytics`, analyticsRouter);
  app.use(`${API_PREFIX}/chat`, chatRouter);
  app.use(`${API_PREFIX}/admin`, adminRouter);
  app.use(`${API_PREFIX}/admin/kols`, adminKOLRouter);
  app.use(`${API_PREFIX}/admin/news`, adminNewsRouter);
  app.use(`${API_PREFIX}/admin/videos`, adminVideoRouter);
  app.use(`${API_PREFIX}/admin/youtube-channels`, adminYoutubeChannelRouter);
  app.use(`${API_PREFIX}/admin/youtube-scores`, adminYoutubeScoreRouter);
  app.use(`${API_PREFIX}/admin/creator-applications`, adminCreatorRouter);
  app.use(`${API_PREFIX}/admin/analytics`, adminAnalyticsRouter);
  app.use(`${API_PREFIX}/admin/chat`, adminChatRouter);
  app.use('/r', kolTrackingRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
