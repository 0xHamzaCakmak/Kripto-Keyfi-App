import 'dotenv/config';
import { prisma } from '../src/database/prisma.js';
import { env } from '../src/config/env.js';

const CONFIRMATION = 'DELETE ARCHIVED PAPER BOTS KEEP ACTIVE 20';
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
    const [testnetBots, activePaperBots, archivedPaperBots] = await Promise.all([
      prisma.tradingBot.findMany({
        where: { userId: owner.userId, type: 'AUTONOMOUS', mode: 'DEMO', lifecycleStatus: { not: 'ARCHIVED' } },
        select: { id: true, name: true, lifecycleStatus: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.tradingBot.findMany({
        where: { userId: owner.userId, type: 'AUTONOMOUS', mode: 'PAPER', lifecycleStatus: { not: 'ARCHIVED' } },
        select: { id: true, name: true, lifecycleStatus: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.tradingBot.findMany({
        where: { userId: owner.userId, type: 'AUTONOMOUS', mode: 'PAPER', lifecycleStatus: 'ARCHIVED' },
        select: {
          id: true,
          name: true,
          lifecycleStatus: true,
          paperTrades: { where: { status: 'OPEN' }, select: { id: true }, take: 1 },
          _count: { select: { testnetExecutionFills: true } },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    const preservedBots = testnetBots.length === env.AI_TRADING_FIXED_FLEET_SIZE && activePaperBots.length === 0
      ? testnetBots
      : activePaperBots.length === env.AI_TRADING_FIXED_FLEET_SIZE && testnetBots.length === 0
        ? activePaperBots
        : null;
    if (!preservedBots) {
      throw new Error(
        `GUVENLIK: ${owner.userId} icin tam ${env.AI_TRADING_FIXED_FLEET_SIZE} aktif PAPER veya TESTNET botu bekleniyordu; PAPER=${activePaperBots.length}, TESTNET=${testnetBots.length} bulundu. Hicbir veri silinmedi.`,
      );
    }
    const paperBotsWithTestnetEvidence = archivedPaperBots.filter((bot) => bot._count.testnetExecutionFills > 0);
    if (paperBotsWithTestnetEvidence.length > 0) {
      throw new Error(
        `GUVENLIK: Arsivlenmis PAPER botlarindan ${paperBotsWithTestnetEvidence.length} tanesi TESTNET fill gecmisi tasiyor (${paperBotsWithTestnetEvidence.map((bot) => bot.name).join(', ')}). Kanit kaybi olmamasi icin hicbir veri silinmedi.`,
      );
    }
    const paperBotsWithOpenTrades = archivedPaperBots.filter((bot) => bot.paperTrades.length > 0);
    if (paperBotsWithOpenTrades.length > 0) {
      throw new Error(
        `GUVENLIK: Arsivlenmis PAPER botlarindan ${paperBotsWithOpenTrades.length} tanesinde acik islem var (${paperBotsWithOpenTrades.map((bot) => bot.name).join(', ')}). Hicbir veri silinmedi.`,
      );
    }
    plans.push({ userId: owner.userId, preservedBots, preservedMode: testnetBots.length > 0 ? 'TESTNET' as const : 'PAPER' as const, archivedPaperBots });
  }

  for (const plan of plans) {
    console.log(`Kullanici ${plan.userId}: ${plan.preservedBots.length} aktif ${plan.preservedMode} botu korunacak, ${plan.archivedPaperBots.length} ARCHIVED PAPER botu silinecek.`);
    console.log(`Korunan botlar: ${plan.preservedBots.map((bot) => `${bot.name} [${bot.lifecycleStatus}]`).join(', ')}`);
  }
  if (!execute) {
    console.log(`DRY-RUN: Degisiklik yapilmadi. Uygulamak icin --confirm="${CONFIRMATION}" kullanin.`);
    return;
  }

  for (const plan of plans) {
    const paperBotIds = plan.archivedPaperBots.map((bot) => bot.id);
    await prisma.$transaction(async (tx) => {
      if (paperBotIds.length > 0) {
        await tx.botMutation.deleteMany({ where: { OR: [{ parentBotId: { in: paperBotIds } }, { childBotId: { in: paperBotIds } }] } });
        await tx.botCrossover.deleteMany({ where: { OR: [{ parentABotId: { in: paperBotIds } }, { parentBBotId: { in: paperBotIds } }, { childBotId: { in: paperBotIds } }] } });
        await tx.tradingBot.deleteMany({ where: { id: { in: paperBotIds }, userId: plan.userId, type: 'AUTONOMOUS', mode: 'PAPER' } });
      }
      if (plan.preservedMode === 'TESTNET') await tx.paperAccountingPeriod.deleteMany({ where: { userId: plan.userId } });
      await tx.tradingAuditLog.create({ data: {
        userId: plan.userId,
        action: 'AI_PAPER_BOTS_PRUNED',
        entityType: 'AUTONOMOUS_FLEET',
        metadata: {
          deletedPaperBotCount: paperBotIds.length,
          deletedLifecycleStatus: 'ARCHIVED',
          preservedBotIds: plan.preservedBots.map((bot) => bot.id),
          preservedBotCount: plan.preservedBots.length,
          preservedMode: plan.preservedMode,
          testnetEvidenceDeleted: false,
          productionLiveChanged: false,
        },
      } });
    }, { maxWait: 10_000, timeout: 120_000 });
  }
  console.log('Arsivlenmis PAPER bot temizligi tamamlandi; aktif 20 bot ve onlara bagli mevcut gecmis korundu.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
