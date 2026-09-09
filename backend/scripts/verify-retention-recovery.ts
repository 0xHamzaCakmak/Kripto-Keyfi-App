import 'dotenv/config';
import { prisma } from '../src/database/prisma.js';

async function main() {
  const migrations = await prisma.$queryRaw<Array<{ logs: string | null }>>`
    SELECT logs FROM _prisma_migrations
    WHERE migration_name = '20260909100000_preserve_execution_evidence_retention'
      AND finished_at IS NULL AND rolled_back_at IS NULL
  `;
  if (migrations.length !== 1 || !migrations[0]?.logs?.includes('1826')) {
    throw new Error('Expected one unresolved 1826 migration failure; stop and inspect migration history.');
  }
  const columns = await prisma.$queryRaw<Array<{ TABLE_NAME: string; IS_NULLABLE: string; COLUMN_TYPE: string }>>`
    SELECT TABLE_NAME, IS_NULLABLE, COLUMN_TYPE FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('trading_bot_paper_fills', 'shadow_trades') AND COLUMN_NAME = 'decisionId'
  `;
  const links = await prisma.$queryRaw<Array<{ TABLE_NAME: string; CONSTRAINT_NAME: string; DELETE_RULE: string; REFERENCED_TABLE_NAME: string }>>`
    SELECT TABLE_NAME, CONSTRAINT_NAME, DELETE_RULE, REFERENCED_TABLE_NAME
    FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME IN ('trading_bot_paper_fills', 'shadow_trades')
      AND REFERENCED_TABLE_NAME = 'trading_bot_decisions'
  `;
  const indexes = await prisma.$queryRaw<Array<{ INDEX_NAME: string }>>`
    SELECT INDEX_NAME FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trading_outbox_events'
      AND INDEX_NAME = 'trading_outbox_events_eventType_createdAt_id_idx'
  `;
  for (const table of ['trading_bot_paper_fills', 'shadow_trades']) {
    const column = columns.find(row => row.TABLE_NAME === table);
    const link = links.find(row => row.TABLE_NAME === table);
    if (column?.IS_NULLABLE !== 'NO' || !column.COLUMN_TYPE.toLowerCase().includes('bigint') || !column.COLUMN_TYPE.toLowerCase().includes('unsigned') ||
        link?.CONSTRAINT_NAME !== `${table}_decisionId_fkey` || link.DELETE_RULE !== 'CASCADE') {
      throw new Error(`${table}: schema differs from the expected pre-migration state. Do not resolve automatically.`);
    }
  }
  if (columns.length !== 2 || links.length !== 2 || indexes.length !== 0) throw new Error('Partially applied or unexpected schema; manual inspection required.');
  console.log('Recovery precheck passed. No data changed. The failed migration can be marked rolled back and retried with the corrected SQL.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
