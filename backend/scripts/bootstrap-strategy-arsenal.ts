import { prisma } from '../src/database/prisma.js';
import { createStrategy } from '../src/modules/ai-trading/strategy-registry.service.js';

const BASELINE = 'AI Momentum Baseline';
const RANGE_NAME = 'AI RSI Bollinger Range';
const CONFLUENCE_NAME = 'Playbook Confluence';

async function main() {
  const baseline = await prisma.strategy.findFirstOrThrow({
    where: { name: BASELINE }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  const baselineVersion = baseline.versions[0];
  if (!baselineVersion) throw new Error('Baseline strategy version is required.');
  const range = await ensureStrategy(baseline.createdById, RANGE_NAME, 'RSI_MEAN_REVERSION', 'RSI + Bollinger RANGE dönüş stratejisi.', baselineVersion);
  const confluence = await ensureStrategy(baseline.createdById, CONFLUENCE_NAME, 'MULTI_AGENT', 'Rejime göre trend momentum veya RANGE mean-reversion alt stratejisini seçen birleşik PAPER stratejisi.', baselineVersion);
  const bots = await prisma.tradingBot.findMany({
    where: { userId: baseline.createdById, type: 'AUTONOMOUS', mode: 'PAPER', name: { startsWith: 'AI Momentum G1 #' } },
    orderBy: { name: 'asc' }, take: 100, select: { id: true, name: true, strategyVersionId: true },
  });
  if (bots.length !== 100) throw new Error(`Expected exactly 100 baseline PAPER bots, found ${bots.length}.`);
  let changed = 0;
  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < bots.length; index += 1) {
      const target = index >= 80 ? confluence : index >= 60 ? range : baselineVersion;
      if (bots[index]!.strategyVersionId === target.id) continue;
      await tx.tradingBot.update({ where: { id: bots[index]!.id }, data: { strategyVersionId: target.id, version: { increment: 1 } } });
      changed += 1;
    }
    await tx.tradingAuditLog.create({ data: {
      userId: baseline.createdById, action: 'AI_PAPER_STRATEGY_ARSENAL_ASSIGNED', entityType: 'GENERATION', entityId: bots[0]!.id,
      metadata: { momentum: 60, rangeMeanReversion: 20, playbookConfluence: 20, paperOnly: true, productionLive: false },
    } });
  });
  console.log(JSON.stringify({ changed, population: { momentum: 60, rangeMeanReversion: 20, playbookConfluence: 20 }, productionLive: false }));
}

async function ensureStrategy(userId: string, name: string, family: 'RSI_MEAN_REVERSION' | 'MULTI_AGENT', description: string, source: {
  parameterSchema: unknown; allowedMarkets: unknown; supportedTimeframes: unknown;
}) {
  let strategy = await prisma.strategy.findFirst({ where: { createdById: userId, name }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
  if (!strategy) {
    await createStrategy(userId, { family, name, description, initialVersion: {
      parameterSchema: source.parameterSchema as never,
      allowedMarkets: source.allowedMarkets as never,
      supportedTimeframes: source.supportedTimeframes as never,
    } });
    strategy = await prisma.strategy.findFirstOrThrow({ where: { createdById: userId, name }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
  }
  const version = strategy.versions[0];
  if (!version) throw new Error(`${name} strategy version is unavailable.`);
  return version;
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }).finally(() => prisma.$disconnect());
