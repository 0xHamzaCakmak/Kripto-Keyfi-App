import { setTimeout as pause } from 'node:timers/promises';
import { prisma } from '../../database/prisma.js';
import { scheduleDailyMaintenance } from '../../utils/daily-maintenance.js';
import { RETENTION_HOURS, RETENTION_INTERVAL_MS } from '../../utils/retention-policy.js';

export const AI_DECISION_RETENTION_HOURS = RETENTION_HOURS;
export const AI_DECISION_RETENTION_INTERVAL_MS = RETENTION_INTERVAL_MS;
const DELETE_BATCH_SIZE = 1_000;

export function retentionFilters(now = new Date()) {
  const cutoff = new Date(now.getTime() - AI_DECISION_RETENTION_HOURS * 3_600_000);
  return {
    cutoff,
    decisions: { type: 'AUTONOMOUS' as const, occurredAt: { lt: cutoff }, createdAt: { lt: cutoff } },
    signals: { tradingBot: { type: 'AUTONOMOUS' as const }, createdAt: { lt: cutoff } },
    // Outbox contains SSE notifications, not the engine's order queue. The
    // underlying order/fill/risk/audit records are not removed by this policy.
    outbox: { createdAt: { lt: cutoff } },
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
      ((TABLE_NAME = 'trading_bot_paper_fills' AND CONSTRAINT_NAME = 'trading_bot_paper_fills_decisionId_retention_fkey') OR
       (TABLE_NAME = 'shadow_trades' AND CONSTRAINT_NAME = 'shadow_trades_decisionId_retention_fkey'))
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
  // Old notifications of all types expire using the (createdAt, id) index.
  {
    const where = filters.outbox;
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
  return scheduleDailyMaintenance('trading retention', () => deleteExpiredAutonomousDecisions());
}
