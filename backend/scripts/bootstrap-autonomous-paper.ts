import { prisma } from '../src/database/prisma.js';
import { createStrategy, createStrategyVersion } from '../src/modules/ai-trading/strategy-registry.service.js';
import { createFactoryBot, transitionFactoryBot } from '../src/modules/ai-trading/bot-factory.service.js';
import { startAutonomousBot, triggerPaperGeneration } from '../src/modules/ai-trading/autonomous-admin.service.js';

const STRATEGY_NAME = 'AI Momentum Baseline';
const BOT_PREFIX = 'AI Momentum G1';
const POPULATION = 100;

const parameterSchema = { parameters: {
  signalThresholdBps: { type: 'number' as const, min: 5, max: 100, step: 5, default: 25 },
  signalExperimentId: { type: 'enum' as const, values: ['PAPER_SIGNAL_SENSITIVITY_V1'], default: 'PAPER_SIGNAL_SENSITIVITY_V1' },
  signalExperimentVariant: { type: 'enum' as const, values: ['CONTROL', 'BALANCED', 'RESPONSIVE', 'EXPLORATORY'], default: 'CONTROL' },
  side: { type: 'enum' as const, values: ['BUY', 'SELL', 'BOTH'], default: 'BOTH' },
  quantity: { type: 'string' as const, minLength: 1, maxLength: 40, default: '0.001' },
  leverage: { type: 'integer' as const, min: 5, max: 20, step: 1, default: 5 },
  marginMode: { type: 'enum' as const, values: ['ISOLATED'], default: 'ISOLATED' },
  stopLossBps: { type: 'number' as const, min: 75, max: 300, step: 25, default: 75 },
  takeProfitBps: { type: 'number' as const, min: 100, max: 600, step: 25, default: 125 },
  fixedRiskPct: { type: 'number' as const, min: 0.005, max: 0.01, step: 0.0025, default: 0.0075 },
  atrStopMultiplier: { type: 'number' as const, min: 1, max: 2.5, step: 0.25, default: 1.5 },
  adaptiveStopMinBps: { type: 'number' as const, min: 75, max: 150, step: 25, default: 75 },
  adaptiveStopMaxBps: { type: 'number' as const, min: 200, max: 300, step: 25, default: 300 },
  riskRewardRatio: { type: 'number' as const, min: 1, max: 3, step: 0.25, default: 1.5 },
  maintenanceMarginBps: { type: 'number' as const, min: 25, max: 100, step: 25, default: 50 },
  liquidationReserveFraction: { type: 'number' as const, min: 0.1, max: 0.5, step: 0.1, default: 0.2 },
  newsFilterEnabled: { type: 'boolean' as const, default: false },
  playbookVersion: { type: 'enum' as const, values: ['TRADING_PLAYBOOK_V1'], default: 'TRADING_PLAYBOOK_V1' },
  experimentId: { type: 'enum' as const, values: ['ATR_STOP_WALK_FORWARD_V1'], default: 'ATR_STOP_WALK_FORWARD_V1' },
  experimentVariant: { type: 'enum' as const, values: ['ATR_1_25', 'ATR_1_50', 'ATR_1_75'], default: 'ATR_1_50' },
  paperFeeBps: { type: 'number' as const, min: 0, max: 20, step: 1, default: 4 },
  paperSlippageBps: { type: 'number' as const, min: 0, max: 20, step: 1, default: 2 },
  allocationUsdt: { type: 'number' as const, min: 100, max: 100, default: 100 },
  positionNotionalPct: { type: 'number' as const, min: 0.10, max: 0.10, default: 0.10 },
  pyramidingEnabled: { type: 'boolean' as const, default: true },
} };

async function main() {
  const account = await prisma.exchangeAccount.findFirst({
    where: {
      isActive: true,
      connectionStatus: 'CONNECTED',
      environment: { in: ['TESTNET', 'DEMO'] },
    },
    orderBy: { createdAt: 'asc' },
    include: { riskProfile: true },
  });
  if (!account) throw new Error('Connected TESTNET/DEMO exchange account is required.');
  if (!account.riskProfile?.enabled || account.riskProfile.accountKillSwitch) {
    throw new Error('Enabled risk profile with account kill switch off is required.');
  }
  const global = await prisma.tradingRiskControl.findUnique({ where: { id: 'global' } });
  if (!global || global.globalKillSwitch) throw new Error('Global kill switch must be explicitly off.');

  let strategy = await prisma.strategy.findFirst({
    where: { createdById: account.userId, name: STRATEGY_NAME },
    include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
  });
  if (!strategy) {
    await createStrategy(account.userId, {
      family: 'MOMENTUM',
      name: STRATEGY_NAME,
      description: 'Safe PAPER/SHADOW momentum baseline with immutable risk protection.',
      initialVersion: {
        allowedMarkets: ['FUTURES'],
        supportedTimeframes: ['1m', '5m', '15m'],
        parameterSchema,
      },
    });
    strategy = await prisma.strategy.findFirstOrThrow({
      where: { createdById: account.userId, name: STRATEGY_NAME },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
  }
  let strategyVersion = strategy.versions[0];
  if (!strategyVersion) throw new Error('Bootstrap strategy version is unavailable.');
  const schema = strategyVersion.parameterSchema as { parameters?: { leverage?: { min?: number; max?: number }; fixedRiskPct?: { default?: number }; atrStopMultiplier?: { default?: number }; newsFilterEnabled?: { default?: boolean }; playbookVersion?: { default?: string } } };
  if (schema.parameters?.leverage?.min !== 5 || schema.parameters.leverage.max !== 20
    || schema.parameters.fixedRiskPct?.default !== 0.0075 || schema.parameters.atrStopMultiplier?.default !== 1.5
    || schema.parameters.newsFilterEnabled?.default !== false
    || schema.parameters.playbookVersion?.default !== 'TRADING_PLAYBOOK_V1') {
    await createStrategyVersion(account.userId, strategy.id, {
      allowedMarkets: ['FUTURES'], supportedTimeframes: ['1m', '5m', '15m'], parameterSchema,
    });
    strategyVersion = await prisma.strategyVersion.findFirstOrThrow({ where: { strategyId: strategy.id }, orderBy: { version: 'desc' } });
  }

  let generation = await prisma.generation.findFirst({
    where: { createdById: account.userId, status: { in: ['RUNNING', 'EVALUATING'] } },
    orderBy: { number: 'desc' },
  });
  if (!generation) {
    const created = await triggerPaperGeneration(account.userId, { populationTarget: POPULATION, note: 'Autonomous PAPER baseline bootstrap.' });
    generation = created.data;
  }

  let created = 0;
  let started = 0;
  for (let index = 0; index < POPULATION; index += 1) {
    const ordinal = String(index + 1).padStart(3, '0');
    const atrMultiplier = [1.25, 1.5, 1.75][index % 3]!;
    const experimentVariant = ['ATR_1_25', 'ATR_1_50', 'ATR_1_75'][index % 3]!;
    const signalExperimentVariant = ['CONTROL', 'BALANCED', 'RESPONSIVE', 'EXPLORATORY'][index % 4]!;
    let name = `${BOT_PREFIX} #${ordinal}`;
    let bot = await prisma.tradingBot.findFirst({ where: { userId: account.userId, name, mode: 'PAPER' } });
    if (!bot) {
      const paperName = `${name} PAPER`;
      const paperReplacement = await prisma.tradingBot.findFirst({ where: { userId: account.userId, name: paperName, mode: 'PAPER' } });
      if (paperReplacement) {
        name = paperName;
        bot = paperReplacement;
      } else if (await prisma.tradingBot.findFirst({ where: { userId: account.userId, name } })) {
        name = paperName;
      }
    }
    if (!bot) {
      const threshold = 10 + (index % 9) * 5;
      const quantity = (0.001 + (index % 5) * 0.001).toFixed(3);
      await createFactoryBot(account.userId, {
        name,
        strategyVersionId: strategyVersion.id,
        exchangeAccountId: account.id,
        parameters: {
          signalThresholdBps: threshold,
          signalExperimentId: 'PAPER_SIGNAL_SENSITIVITY_V1',
          signalExperimentVariant,
          side: 'BOTH',
          quantity,
          leverage: 5 + (index % 16),
          marginMode: 'ISOLATED',
          stopLossBps: 75,
          takeProfitBps: 125,
          fixedRiskPct: 0.0075,
          atrStopMultiplier: atrMultiplier,
          adaptiveStopMinBps: 75,
          adaptiveStopMaxBps: 300,
          riskRewardRatio: 1.5,
          maintenanceMarginBps: 50,
          liquidationReserveFraction: 0.2,
          newsFilterEnabled: index % 2 === 0,
          playbookVersion: 'TRADING_PLAYBOOK_V1',
          experimentId: 'ATR_STOP_WALK_FORWARD_V1',
          experimentVariant,
          paperFeeBps: 4,
          paperSlippageBps: 2,
          allocationUsdt: 100,
          positionNotionalPct: 0.10,
          pyramidingEnabled: true,
        },
        startingPaperBalance: '100',
        symbols: ['ETHUSDT'],
        timeframe: '1m',
        mode: 'PAPER',
        riskProfileId: account.riskProfile.id,
        generationId: generation.id,
      });
      created += 1;
      bot = await prisma.tradingBot.findFirstOrThrow({ where: { userId: account.userId, name } });
    }

    for (const lifecycle of ['CANDIDATE', 'TESTING', 'PAPER'] as const) {
      if (bot.lifecycleStatus === lifecycle || bot.lifecycleStatus === 'PAPER') continue;
      await transitionFactoryBot(account.userId, bot.id, lifecycle);
      bot = await prisma.tradingBot.findUniqueOrThrow({ where: { id: bot.id } });
    }
    if (bot.lifecycleStatus !== 'PAPER') throw new Error(`${name} did not reach PAPER lifecycle.`);
    const currentConfiguration = bot.configuration && !Array.isArray(bot.configuration) && typeof bot.configuration === 'object' ? bot.configuration : {};
    const configuredAllocation = Number((currentConfiguration as Record<string, unknown>).allocationUsdt);
    const preservedAllocation = Number.isFinite(configuredAllocation) && configuredAllocation >= 10 && configuredAllocation <= 10_000 ? configuredAllocation : 100;
    const desiredLeverage = 5 + (index % 16);
    if (bot.intervalSeconds !== 15 || bot.strategyVersionId !== strategyVersion.id || bot.generationId !== generation.id
      || (currentConfiguration as Record<string, unknown>).leverage !== desiredLeverage
      || (currentConfiguration as Record<string, unknown>).positionNotionalPct !== 0.10
      || (currentConfiguration as Record<string, unknown>).fixedRiskPct !== 0.0075
      || (currentConfiguration as Record<string, unknown>).atrStopMultiplier !== atrMultiplier
      || (currentConfiguration as Record<string, unknown>).signalExperimentId !== 'PAPER_SIGNAL_SENSITIVITY_V1'
      || (currentConfiguration as Record<string, unknown>).signalExperimentVariant !== signalExperimentVariant
      || (currentConfiguration as Record<string, unknown>).newsFilterEnabled !== (index % 2 === 0)
      || (currentConfiguration as Record<string, unknown>).pyramidingEnabled !== true) {
      bot = await prisma.tradingBot.update({
        where: { id: bot.id },
        data: { strategyVersionId: strategyVersion.id, generationId: generation.id, intervalSeconds: 15,
          configuration: { ...currentConfiguration, leverage: desiredLeverage, allocationUsdt: preservedAllocation, positionNotionalPct: 0.10, pyramidingEnabled: true,
            stopLossBps: 75, takeProfitBps: 125, fixedRiskPct: 0.0075, atrStopMultiplier: atrMultiplier,
            adaptiveStopMinBps: 75, adaptiveStopMaxBps: 300, riskRewardRatio: 1.5,
            maintenanceMarginBps: 50, liquidationReserveFraction: 0.2, newsFilterEnabled: index % 2 === 0,
            playbookVersion: 'TRADING_PLAYBOOK_V1', experimentId: 'ATR_STOP_WALK_FORWARD_V1', experimentVariant,
            signalExperimentId: 'PAPER_SIGNAL_SENSITIVITY_V1', signalExperimentVariant },
        },
      });
    }
    if (bot.state === 'ERROR' && bot.desiredState === 'RUNNING') {
      bot = await prisma.tradingBot.update({
        where: { id: bot.id },
        data: { state: 'STARTING', schedulerOwner: null, leaseExpiresAt: null, lastErrorCode: null, lastErrorMessage: null, stateReason: 'Bootstrap repaired missing strategy linkage.' },
      });
    }
    if (['DRAFT', 'STOPPED', 'PAUSED'].includes(bot.state)) {
      await startAutonomousBot(account.userId, bot.id);
      started += 1;
    }
  }

  const population = await prisma.tradingBot.count({
    where: { userId: account.userId, type: 'AUTONOMOUS', generationId: generation.id, mode: 'PAPER' },
  });
  console.log(JSON.stringify({
    account: { name: account.name, environment: account.environment },
    strategy: { id: strategy.id, version: strategyVersion.version, family: strategy.family },
    generation: { id: generation.id, number: generation.number },
    population,
    created,
    started,
    liveTradingEnabled: false,
    submittedToExchange: false,
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
