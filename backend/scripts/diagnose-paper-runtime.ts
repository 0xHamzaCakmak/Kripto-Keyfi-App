import { prisma } from '../src/database/prisma.js';

const since = new Date(Date.now() - 60_000);
const [bots, openTrades, recentAudit, riskProfiles, enabledUniverse] = await Promise.all([
  prisma.tradingBot.findMany({
    where: { type: 'AUTONOMOUS', mode: 'PAPER' },
    select: { id: true, symbol: true, configuration: true, state: true, lifecycleStatus: true, lastErrorCode: true },
  }),
  prisma.paperTrade.findMany({
    where: { tradingBot: { type: 'AUTONOMOUS', mode: 'PAPER' }, status: 'OPEN' },
    select: { tradingBotId: true, symbol: true, entryPrice: true, quantity: true, leverage: true, fees: true, realizedPnl: true, openedAt: true },
  }),
  prisma.tradingAuditLog.findMany({
    where: { action: { in: ['AUTONOMOUS_RISK_REJECTED', 'AUTONOMOUS_RISK_BLOCKED', 'AUTONOMOUS_RISK_APPROVED'] }, createdAt: { gte: since } },
    select: { action: true, metadata: true },
  }),
  prisma.tradingRiskProfile.findMany({
    where: { exchangeAccount: { provider: 'BINANCE', accountType: 'USDT_M', isActive: true } },
    select: { exchangeAccountId: true, maxOpenPositions: true, paperMaxOpenPositions: true },
  }),
  prisma.tradingUniverseAsset.findMany({ where: { enabled: true }, select: { symbol: true } }),
]);
const universe = new Set(enabledUniverse.map((item) => item.symbol));
const riskCounts: Record<string, number> = {};
for (const event of recentAudit) {
  const metadata = event.metadata && !Array.isArray(event.metadata) && typeof event.metadata === 'object' ? event.metadata : {};
  const code = typeof metadata.code === 'string' ? metadata.code : 'UNKNOWN';
  const key = `${event.action}:${code}`;
  riskCounts[key] = (riskCounts[key] ?? 0) + 1;
}
console.log(JSON.stringify({
  paperBots: bots.filter((bot) => bot.lifecycleStatus !== 'ARCHIVED').length,
  retainedPaperBots: bots.filter((bot) => bot.lifecycleStatus === 'ARCHIVED').length,
  botsOutsideCore: bots.filter((bot) => bot.lifecycleStatus !== 'ARCHIVED' && !universe.has(bot.symbol)).length,
  botsWithContinuousTrainingConfig: bots.filter((bot) => bot.lifecycleStatus !== 'ARCHIVED' && (() => {
    const value = bot.configuration;
    return value && !Array.isArray(value) && typeof value === 'object' && value.paperAlwaysInMarket === true;
  })()).length,
  openTrades: openTrades.length,
  openTradeSymbols: [...new Set(openTrades.map((trade) => trade.symbol))].sort(),
  enabledUniverseSymbols: [...universe].sort(),
  riskProfiles,
  openTradesOutsideCore: openTrades.filter((trade) => !universe.has(trade.symbol)).length,
  openTradesBelowTwentyMargin: openTrades.filter((trade) => trade.entryPrice.mul(trade.quantity).div(Math.max(1, trade.leverage)).lt(20)).length,
  latestOpenTradeSizing: openTrades.sort((left, right) => right.openedAt.getTime() - left.openedAt.getTime()).slice(0, 10).map((trade) => ({
    botId: trade.tradingBotId, symbol: trade.symbol, leverage: trade.leverage,
    initialMargin: trade.entryPrice.mul(trade.quantity).div(Math.max(1, trade.leverage)).toString(),
    notional: trade.entryPrice.mul(trade.quantity).toString(), fees: trade.fees.toString(), realizedPnl: trade.realizedPnl.toString(), openedAt: trade.openedAt,
  })),
  recentRiskDecisions: riskCounts,
}, null, 2));

await prisma.$disconnect();
