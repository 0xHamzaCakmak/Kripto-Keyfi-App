import { setTimeout as pause } from 'node:timers/promises';
import { prisma } from '../../database/prisma.js';
import { logger } from '../../utils/logger.js';

export const AI_DECISION_RETENTION_HOURS = 24;
export const AI_DECISION_RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;
// Only disposable UI notifications; order/risk/account events are deliberately excluded.
export const EXPIRING_OUTBOX_EVENT_TYPES = ['BOT_PAPER_DECISION', 'BOT_SHADOW_DECISION', 'SNAPSHOT_RECONCILED', 'BOT_STATE_CHANGED'];
const DELETE_BATCH_SIZE = 1_000;
let retentionRunning = false;

export function retentionFilters(now = new Date()) {
  const cutoff = new Date(now.getTime() - AI_DECISION_RETENTION_HOURS * 3_600_000);
  return {
    cutoff,
    decisions: { type: 'AUTONOMOUS' as const, occurredAt: { lt: cutoff }, createdAt: { lt: cutoff } },
    signals: { tradingBot: { type: 'AUTONOMOUS' as const }, createdAt: { lt: cutoff } },
    outbox: { eventType: { in: EXPIRING_OUTBOX_EVENT_TYPES }, createdAt: { lt: cutoff } },
  };
}

export async function previewTradingRetention(now = new Date()) {
  const filters = retentionFilters(now);
  const [decisions, signals, outbox] = await Promise.all([
    prisma.tradingBotDecision.count({ where: filters.decisions }),
    prisma.tradingBotSignal.count({ where: filters.signals }),
    prisma.tradingOutboxEvent.count({ where: filters.outbox }),
  ]);
  return { cutoff: filters.cutoff, decisions, signals, outbox };
}

export async function deleteExpiredAutonomousDecisions(now = new Date()) {
  const constraints = await prisma.$queryRaw<Array<{ DELETE_RULE: string }>>`
    SELECT DELETE_RULE FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND
      ((TABLE_NAME = 'trading_bot_paper_fills' AND CONSTRAINT_NAME = 'trading_bot_paper_fills_decisionId_fkey') OR
       (TABLE_NAME = 'shadow_trades' AND CONSTRAINT_NAME = 'shadow_trades_decisionId_fkey'))
  `;
  if (constraints.length !== 2 || constraints.some(row => row.DELETE_RULE !== 'SET NULL')) {
    throw new Error('Trading retention requires the preserve_execution_evidence_retention migration; no records deleted.');
  }
  const filters = retentionFilters(now);
  let deletedDecisions = 0;
  let deletedSignals = 0;
  let deletedOutboxEvents = 0;
  // Independent signal sweep also removes old signals whose decision was already removed.
  while (true) {
    const rows = await prisma.tradingBotSignal.findMany({
      where: filters.signals, select: { id: true }, orderBy: { id: 'asc' }, take: DELETE_BATCH_SIZE,
    });
    if (!rows.length) break;
    const result = await prisma.tradingBotSignal.deleteMany({
      where: { ...filters.signals, id: { in: rows.map(row => row.id) } },
    });
    deletedSignals += result.count;
    if (!result.count) break;
    await pause(100);
  }
  while (true) {
    const rows = await prisma.tradingBotDecision.findMany({
      where: filters.decisions, select: { id: true },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }], take: DELETE_BATCH_SIZE,
    });
    if (!rows.length) break;
    // Migration changes child FKs to SET NULL: paper fills and shadow evidence survive.
    const result = await prisma.tradingBotDecision.deleteMany({
      where: { ...filters.decisions, id: { in: rows.map(row => row.id) } },
    });
    deletedDecisions += result.count;
    if (!result.count) break;
    await pause(100);
  }
  // Sweep each event type separately to use the (eventType, createdAt, id) index.
  for (const eventType of EXPIRING_OUTBOX_EVENT_TYPES) {
    const where = { eventType, createdAt: { lt: filters.cutoff } };
    while (true) {
      const rows = await prisma.tradingOutboxEvent.findMany({
        where, select: { id: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: DELETE_BATCH_SIZE,
      });
      if (!rows.length) break;
      const result = await prisma.tradingOutboxEvent.deleteMany({ where: { ...where, id: { in: rows.map(row => row.id) } } });
      deletedOutboxEvents += result.count;
      if (!result.count) break;
      await pause(100);
    }
  }
  return { cutoff: filters.cutoff, deletedDecisions, deletedSignals, deletedOutboxEvents };
}

export function scheduleAutonomousDecisionRetention() {
  const execute = async () => {
    if (retentionRunning) return;
    retentionRunning = true;
    try {
      logger.info(await deleteExpiredAutonomousDecisions(), 'daily trading retention completed');
    } catch (error) {
      logger.error({ err: error }, 'daily trading retention failed');
    } finally {
      retentionRunning = false;
    }
  };
  void execute();
  const timer = setInterval(() => { void execute(); }, AI_DECISION_RETENTION_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
