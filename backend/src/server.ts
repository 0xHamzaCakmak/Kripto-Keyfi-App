import type { Server } from 'node:http';
import { createServer } from 'node:http';
import type { ChatIo } from './modules/chat/chat.socket.js';
import { attachChatSocket } from './modules/chat/chat.socket.js';
import { scheduleChatReconciliation } from './modules/chat/chat.service.js';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './database/prisma.js';
import { logger } from './utils/logger.js';
import { scheduleNewsSync } from './modules/news/news.worker.js';
import { ensureDefaultNewsCatalog } from './modules/news/news.catalog.js';
import { scheduleYoutubeSync } from './modules/videos/youtube.worker.js';
import { scheduleYoutubeMetricsCollection } from './modules/videos/youtube-metrics.worker.js';
import { scheduleAutonomousEvolution } from './modules/ai-trading/evolution.worker.js';
import { scheduleAutonomousUniverse } from './modules/ai-trading/universe.worker.js';
import { scheduleAutonomousLearning } from './modules/ai-trading/learning.worker.js';

let server: Server | undefined;
let shuttingDown = false;
let stopNewsSync: (() => void) | undefined;
let stopYoutubeSync: (() => void) | undefined;
let stopYoutubeMetricsCollection: (() => void) | undefined;
let stopChatReconciliation: (() => void) | undefined;
let stopAutonomousEvolution: (() => void) | undefined;
let stopAutonomousUniverse: (() => void) | undefined;
let stopAutonomousLearning: (() => void) | undefined;
let chatIo: ChatIo | undefined;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  stopNewsSync?.();
  stopYoutubeSync?.();
  stopYoutubeMetricsCollection?.();
  stopChatReconciliation?.();
  stopAutonomousEvolution?.();
  stopAutonomousUniverse?.();
  stopAutonomousLearning?.();
  chatIo?.close();
  logger.info({ signal }, 'graceful shutdown started');
  server?.close((error) => {
    void prisma.$disconnect().then(() => {
      if (error) {
        logger.error({ err: error }, 'HTTP server shutdown failed');
        process.exitCode = 1;
      }
    });
  });
  if (!server) await prisma.$disconnect();
}

async function start() {
  try {
    await prisma.$connect();
    await ensureDefaultNewsCatalog();
    logger.info('database connection established');
    const app = createApp();
    const httpServer = createServer(app);
    chatIo = attachChatSocket(httpServer);
    server = await new Promise<Server>((resolve, reject) => {
      const listener = httpServer.listen(env.PORT);
      listener.once('listening', () => resolve(listener));
      listener.once('error', reject);
    });
    logger.info({ port: env.PORT }, 'KriptoKeyfi API listening');
    if (env.NEWS_SYNC_ENABLED) stopNewsSync = scheduleNewsSync();
    if (env.YOUTUBE_SYNC_ENABLED) stopYoutubeSync = scheduleYoutubeSync();
    if (env.YOUTUBE_METRICS_ENABLED) stopYoutubeMetricsCollection = scheduleYoutubeMetricsCollection();
    stopChatReconciliation = scheduleChatReconciliation();
    if (env.AI_TRADING_EVOLUTION_ENABLED) stopAutonomousEvolution = scheduleAutonomousEvolution();
    if (env.AI_TRADING_UNIVERSE_ENABLED) stopAutonomousUniverse = scheduleAutonomousUniverse();
    if (env.AI_TRADING_LEARNING_ENABLED) stopAutonomousLearning = scheduleAutonomousLearning();
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String(error.code) : undefined;
    logger.fatal({ err: error instanceof Error ? { name: error.name, message: error.message, ...(code ? { code } : {}) } : error }, code === 'EADDRINUSE' ? `Port ${env.PORT} is already in use; stop the existing backend process before starting another.` : 'application startup failed');
    await prisma.$disconnect().catch(() => undefined);
    process.exitCode = 1;
  }
}

process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
void start();
