import type { Server } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './database/prisma.js';
import { logger } from './utils/logger.js';

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
    server = await new Promise<Server>((resolve, reject) => {
      const listener = app.listen(env.PORT);
      listener.once('listening', () => resolve(listener));
      listener.once('error', reject);
    });
    logger.info({ port: env.PORT }, 'KriptoKeyfi API listening');
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
