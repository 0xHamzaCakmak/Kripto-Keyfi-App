import { prisma } from '../src/database/prisma.js';
import { deleteExpiredAutonomousDecisions, previewTradingRetention } from '../src/modules/ai-trading/decision-retention.service.js';

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply')) throw new Error('Usage: npm run retention:trading -- [--apply]');
  console.log(await previewTradingRetention());
  if (args.includes('--apply')) console.log(await deleteExpiredAutonomousDecisions());
  else console.log('Dry run: no data changed. Use --apply to delete expired records.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
