import type { Server } from 'node:http';
import pino from 'pino';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './database/prisma.js';

const logger = pino({ level: env.NODE_ENV === 'development' ? 'debug' : 'info' });
let server: Server | undefined;
let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
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
    logger.info('database connection established');
    const app = createApp();
    server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, 'KriptoKeyfi API listening'));
  } catch (error) {
    logger.fatal({ err: error instanceof Error ? { name: error.name, message: error.message } : error }, 'application startup failed');
    await prisma.$disconnect().catch(() => undefined);
    process.exitCode = 1;
  }
}

process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
void start();
