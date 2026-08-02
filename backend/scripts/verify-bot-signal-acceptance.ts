import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type AcceptanceRow = {
  id: string;
  name: string;
  state: string;
  schedulerOwner: string | null;
  heartbeatAt: Date | null;
  lastDecisionAt: Date | null;
  signalCount: bigint;
  ruleSignalCount: bigint;
  aiSignalCount: bigint;
  latestSource: string | null;
  latestAction: string | null;
  latestAIStatus: string | null;
  latestAIModel: string | null;
};

async function main() {
  const rows = await prisma.$queryRaw<AcceptanceRow[]>(Prisma.sql`
    SELECT b.id, b.name, b.state, b.schedulerOwner, b.heartbeatAt, b.lastDecisionAt,
      (SELECT COUNT(*) FROM trading_bot_signals s WHERE s.tradingBotId = b.id) AS signalCount,
      (SELECT COUNT(*) FROM trading_bot_signals s WHERE s.tradingBotId = b.id AND s.source = 'RULE_ENGINE') AS ruleSignalCount,
      (SELECT COUNT(*) FROM trading_bot_signals s WHERE s.tradingBotId = b.id AND s.source = 'AI_MODEL') AS aiSignalCount,
      (SELECT source FROM trading_bot_signals s WHERE s.tradingBotId = b.id ORDER BY s.id DESC LIMIT 1) AS latestSource,
      (SELECT action FROM trading_bot_signals s WHERE s.tradingBotId = b.id ORDER BY s.id DESC LIMIT 1) AS latestAction,
      (SELECT status FROM trading_bot_signals s WHERE s.tradingBotId = b.id AND s.source = 'AI_MODEL' ORDER BY s.id DESC LIMIT 1) AS latestAIStatus,
      (SELECT modelName FROM trading_bot_signals s WHERE s.tradingBotId = b.id AND s.source = 'AI_MODEL' ORDER BY s.id DESC LIMIT 1) AS latestAIModel
    FROM trading_bots b
    WHERE b.desiredState = 'RUNNING'
    ORDER BY b.updatedAt DESC
  `);
  console.log(JSON.stringify(rows, (_, value: unknown) => typeof value === 'bigint' ? value.toString() : value));
}

main().finally(async () => prisma.$disconnect());
