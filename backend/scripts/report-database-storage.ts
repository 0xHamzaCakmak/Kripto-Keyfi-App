import 'dotenv/config';
import { Prisma } from '@prisma/client';
import { prisma } from '../src/database/prisma.js';

type TableSize = { tableName: string; rowEstimate: bigint; dataBytes: bigint; indexBytes: bigint; totalBytes: bigint };
type TableCount = { tableName: string; rowCount: bigint };

async function main() {
  const sizes = await prisma.$queryRaw<TableSize[]>(Prisma.sql`
    SELECT TABLE_NAME AS tableName,
           TABLE_ROWS AS rowEstimate,
           DATA_LENGTH AS dataBytes,
           INDEX_LENGTH AS indexBytes,
           (DATA_LENGTH + INDEX_LENGTH) AS totalBytes
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY totalBytes DESC
  `);
  const counts = await prisma.$queryRaw<TableCount[]>(Prisma.sql`
    SELECT 'trading_bot_decisions' AS tableName, COUNT(*) AS rowCount FROM trading_bot_decisions
    UNION ALL SELECT 'trading_bot_signals', COUNT(*) FROM trading_bot_signals
    UNION ALL SELECT 'trading_outbox_events', COUNT(*) FROM trading_outbox_events
    UNION ALL SELECT 'trading_orders', COUNT(*) FROM trading_orders
    UNION ALL SELECT 'trading_risk_events', COUNT(*) FROM trading_risk_events
    UNION ALL SELECT 'trading_audit_logs', COUNT(*) FROM trading_audit_logs
    UNION ALL SELECT 'paper_trades', COUNT(*) FROM paper_trades
    UNION ALL SELECT 'testnet_execution_fills', COUNT(*) FROM testnet_execution_fills
    UNION ALL SELECT 'news_articles', COUNT(*) FROM news_articles
  `);
  const events = await prisma.$queryRaw(Prisma.sql`
    SELECT eventType, COUNT(*) AS rowCount, MIN(createdAt) AS oldest,
      SUM(createdAt < UTC_TIMESTAMP() - INTERVAL 24 HOUR) AS olderThan24h
    FROM trading_outbox_events GROUP BY eventType ORDER BY rowCount DESC
  `);
  const audits = await prisma.$queryRaw(Prisma.sql`
    SELECT action, COUNT(*) AS rowCount, MIN(createdAt) AS oldest
    FROM trading_audit_logs GROUP BY action ORDER BY rowCount DESC LIMIT 20
  `);
  console.log('OUTBOX BY TYPE', JSON.stringify(events, (_, value) => typeof value === 'bigint' ? value.toString() : value));
  console.log('AUDIT BY ACTION', JSON.stringify(audits, (_, value) => typeof value === 'bigint' ? value.toString() : value));
  const countByTable = new Map(counts.map((item) => [item.tableName, item.rowCount]));
  console.log('TABLE SIZE REPORT');
  console.log('table\trows\tdata_mb\tindex_mb\ttotal_mb');
  console.log('InnoDB allocated estimates; rows are approximate unless explicitly counted. Sizes are MiB.');
  console.log('TOTAL_MIB', mb(sizes.reduce((sum, item) => sum + BigInt(item.totalBytes ?? 0), 0n)));
  for (const item of sizes) {
    console.log(`${item.tableName}\t${countByTable.get(item.tableName) ?? item.rowEstimate}\t${mb(item.dataBytes)}\t${mb(item.indexBytes)}\t${mb(item.totalBytes)}`);
  }
}

function mb(bytes: bigint) {
  return (Number(bytes) / 1024 / 1024).toFixed(2);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());