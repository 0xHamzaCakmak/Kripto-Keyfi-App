import 'dotenv/config';
import { prisma } from '../src/database/prisma.js';
import { env } from '../src/config/env.js';

const CONFIRMATION = 'DELETE PAPER BOTS KEEP TESTNET 20';
const confirmation = process.argv.find((value) => value.startsWith('--confirm='))?.slice('--confirm='.length);
const execute = confirmation === CONFIRMATION;

async function main() {
  const owners = await prisma.tradingBot.findMany({
    where: { type: 'AUTONOMOUS', mode: { in: ['PAPER', 'DEMO'] } },
    distinct: ['userId'],
    select: { userId: true },
  });
  if (owners.length === 0) {
    console.log('Temizlenecek autonomous PAPER botu veya korunacak TESTNET botu bulunamadi.');
    return;
  }

  const plans = [];
  for (const owner of owners) {
    const [testnetBots, paperBots] = await Promise.all([
      prisma.tradingBot.findMany({
        where: { userId: owner.userId, type: 'AUTONOMOUS', mode: 'DEMO', lifecycleStatus: { not: 'ARCHIVED' } },
        select: { id: true, name: true, lifecycleStatus: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.tradingBot.findMany({
        where: { userId: owner.userId, type: 'AUTONOMOUS', mode: 'PAPER' },
        select: { id: true, name: true, lifecycleStatus: true, _count: { select: { testnetExecutionFills: true } } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    if (testnetBots.length !== env.AI_TRADING_FIXED_FLEET_SIZE) {
      throw new Error(
        `GUVENLIK: ${owner.userId} icin ${env.AI_TRADING_FIXED_FLEET_SIZE} aktif TESTNET botu bekleniyordu; ${testnetBots.length} bulundu. Hicbir veri silinmedi.`,
      );
    }
    const paperBotsWithTestnetEvidence = paperBots.filter((bot) => bot._count.testnetExecutionFills > 0);
    if (paperBotsWithTestnetEvidence.length > 0) {
      throw new Error(
        `GUVENLIK: PAPER modundaki ${paperBotsWithTestnetEvidence.length} bot TESTNET fill gecmisi tasiyor (${paperBotsWithTestnetEvidence.map((bot) => bot.name).join(', ')}). Kanit kaybi olmamasi icin hicbir veri silinmedi.`,
      );
    }
    plans.push({ userId: owner.userId, testnetBots, paperBots });
  }

  for (const plan of plans) {
    console.log(`Kullanici ${plan.userId}: ${plan.testnetBots.length} TESTNET botu korunacak, ${plan.paperBots.length} PAPER botu silinecek.`);
    console.log(`Korunan TESTNET botlari: ${plan.testnetBots.map((bot) => `${bot.name} [${bot.lifecycleStatus}]`).join(', ')}`);
  }
  if (!execute) {
    console.log(`DRY-RUN: Degisiklik yapilmadi. Uygulamak icin --confirm="${CONFIRMATION}" kullanin.`);
    return;
  }

  for (const plan of plans) {
    const paperBotIds = plan.paperBots.map((bot) => bot.id);
    await prisma.$transaction(async (tx) => {
      if (paperBotIds.length > 0) {
        await tx.botMutation.deleteMany({ where: { OR: [{ parentBotId: { in: paperBotIds } }, { childBotId: { in: paperBotIds } }] } });
        await tx.botCrossover.deleteMany({ where: { OR: [{ parentABotId: { in: paperBotIds } }, { parentBBotId: { in: paperBotIds } }, { childBotId: { in: paperBotIds } }] } });
        await tx.tradingBot.deleteMany({ where: { id: { in: paperBotIds }, userId: plan.userId, type: 'AUTONOMOUS', mode: 'PAPER' } });
      }
      await tx.paperAccountingPeriod.deleteMany({ where: { userId: plan.userId } });
      await tx.tradingAuditLog.create({ data: {
        userId: plan.userId,
        action: 'AI_PAPER_BOTS_PRUNED',
        entityType: 'AUTONOMOUS_FLEET',
        metadata: {
          deletedPaperBotCount: paperBotIds.length,
          preservedTestnetBotIds: plan.testnetBots.map((bot) => bot.id),
          preservedTestnetBotCount: plan.testnetBots.length,
          testnetEvidenceDeleted: false,
          productionLiveChanged: false,
        },
      } });
    }, { maxWait: 10_000, timeout: 120_000 });
  }
  console.log('PAPER bot temizligi tamamlandi; 20 TESTNET botu ve onlara bagli skor/fill gecmisi korundu.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
