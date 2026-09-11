import { prisma } from '../database/prisma.js';
import { logger } from './logger.js';

// Persist the claim before running: restarts and multiple API processes must not
// repeat a large deletion. DB time avoids clock differences between workers.
export async function runDailyMaintenance(name: string, task: () => Promise<unknown>) {
  await prisma.$executeRaw`
    INSERT INTO maintenance_jobs (name, nextRunAt, status)
    VALUES (${name}, UTC_TIMESTAMP(3), 'PENDING')
    ON DUPLICATE KEY UPDATE name = name
  `;
  const claimed = await prisma.$executeRaw`
    UPDATE maintenance_jobs
    SET nextRunAt = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 1 DAY),
        lastStartedAt = UTC_TIMESTAMP(3), status = 'RUNNING'
    WHERE name = ${name} AND nextRunAt <= UTC_TIMESTAMP(3)
  `;
  if (claimed !== 1) return false;
  try {
    const result = await task();
    await prisma.$executeRaw`
      UPDATE maintenance_jobs SET lastCompletedAt = UTC_TIMESTAMP(3), status = 'COMPLETED'
      WHERE name = ${name}
    `;
    logger.info({ job: name, result }, `daily ${name} completed`);
  } catch (error) {
    await prisma.$executeRaw`UPDATE maintenance_jobs SET status = 'FAILED' WHERE name = ${name}`;
    throw error;
  }
  return true;
}

export function scheduleDailyMaintenance(name: string, task: () => Promise<unknown>) {
  let running = false;
  let stopped = false;
  const execute = async () => {
    if (running || stopped) return;
    running = true;
    try { await runDailyMaintenance(name, task); }
    catch (error) { logger.error({ err: error, job: name }, `daily ${name} failed`); }
    finally { running = false; }
  };
  void execute();
  // This only checks the persisted due time; deletion runs once per 24 hours.
  const timer = setInterval(() => { void execute(); }, 60_000);
  timer.unref();
  return () => { stopped = true; clearInterval(timer); };
}
