import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
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

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(pinoHttp({
    level: env.NODE_ENV === 'test' ? 'silent' : 'info',
    redact: [
        'req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.confirmPassword', 'req.body.credential',
      'req.body.apiKey', 'req.body.apiSecret', 'req.body.passphrase', 'res.headers.set-cookie',
    ],
  }));
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(API_PREFIX, rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, skip: () => env.NODE_ENV === 'test' }));

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
  app.use(`${API_PREFIX}/admin`, adminRouter);
  app.use(`${API_PREFIX}/admin/kols`, adminKOLRouter);
  app.use(`${API_PREFIX}/admin/news`, adminNewsRouter);
  app.use('/r', kolTrackingRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
