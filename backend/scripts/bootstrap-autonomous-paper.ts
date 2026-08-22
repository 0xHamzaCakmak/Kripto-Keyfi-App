import { prisma } from '../src/database/prisma.js';
import { createStrategy } from '../src/modules/ai-trading/strategy-registry.service.js';
import { createFactoryBot, transitionFactoryBot } from '../src/modules/ai-trading/bot-factory.service.js';
import { startAutonomousBot, triggerPaperGeneration } from '../src/modules/ai-trading/autonomous-admin.service.js';

const STRATEGY_NAME = 'AI Momentum Baseline';
const BOT_PREFIX = 'AI Momentum G1';
const POPULATION = 100;

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
        parameterSchema: { parameters: {
          signalThresholdBps: { type: 'number', min: 5, max: 100, step: 5, default: 25 },
          side: { type: 'enum', values: ['BUY', 'SELL', 'BOTH'], default: 'BOTH' },
          quantity: { type: 'string', minLength: 1, maxLength: 40, default: '0.001' },
          leverage: { type: 'integer', min: 1, max: 5, step: 1, default: 1 },
          marginMode: { type: 'enum', values: ['ISOLATED'], default: 'ISOLATED' },
          stopLossBps: { type: 'number', min: 20, max: 200, step: 10, default: 50 },
          takeProfitBps: { type: 'number', min: 40, max: 400, step: 20, default: 100 },
          paperFeeBps: { type: 'number', min: 0, max: 20, step: 1, default: 4 },
          paperSlippageBps: { type: 'number', min: 0, max: 20, step: 1, default: 2 },
        } },
      },
    });
    strategy = await prisma.strategy.findFirstOrThrow({
      where: { createdById: account.userId, name: STRATEGY_NAME },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
  }
  const strategyVersion = strategy.versions[0];
  if (!strategyVersion) throw new Error('Bootstrap strategy version is unavailable.');

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
    const name = `${BOT_PREFIX} #${ordinal}`;
    let bot = await prisma.tradingBot.findFirst({ where: { userId: account.userId, name } });
    if (!bot) {
      const threshold = 10 + (index % 9) * 5;
      const quantity = (0.001 + (index % 5) * 0.001).toFixed(3);
      await createFactoryBot(account.userId, {
        name,
        strategyVersionId: strategyVersion.id,
        exchangeAccountId: account.id,
        parameters: {
          signalThresholdBps: threshold,
          side: 'BOTH',
          quantity,
          leverage: 1,
          marginMode: 'ISOLATED',
          stopLossBps: 50,
          takeProfitBps: 100,
          paperFeeBps: 4,
          paperSlippageBps: 2,
        },
        startingPaperBalance: '1000',
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
