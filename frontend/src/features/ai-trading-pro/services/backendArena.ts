import { aiTradingApi, botSymbols, type AutonomousBot, type LeaderboardRow, type TestnetBotOperation } from '../../../services/aiTradingService';
import { getTradingExecutionProfile } from '../../../services/tradingService';
import { getApiErrorMessage } from '../../../services/apiClient';

export function buildProArenaBots(accountId: string, bots: AutonomousBot[], scores: LeaderboardRow[], operations: TestnetBotOperation[]) {
  return bots.filter((bot) => bot.exchangeAccountId === accountId && bot.mode === 'DEMO' && bot.lifecycleStatus !== 'ARCHIVED').map((bot, index) => {
    const operation = operations.find((item) => item.botId === bot.id);
    const score = scores.find((item) => item.tradingBotId === bot.id);
    const openPnl = operation?.position ? Number(operation.position.unrealizedPnl) : null;
    const totalPnl = operation ? Number(operation.netRealizedPnl) + (openPnl ?? 0) : null;
    return {
      id: bot.id, index: index + 1, name: bot.name, accountLabel: 'DEMO HESABI',
      coin: operation?.symbol ?? botSymbols(bot.symbols)[0] ?? '—',
      entryPrice: operation?.position ? Number(operation.position.entryPrice) : null,
      directionLeverage: operation?.position ? `${operation.position.side} ${operation.position.leverage}x` : null,
      currentPnl: openPnl, openPnl, totalPnl,
      tradesCount: operation?.entryFills ?? null, score: score?.score ?? null,
      roi: totalPnl !== null && operation && operation.allocationUsdt > 0 ? totalPnl / operation.allocationUsdt * 100 : null,
      profitFactor: null, status: bot.state, lifecycle: bot.lifecycleStatus,
      strategy: bot.strategyVersion?.strategy.family ?? '—', generation: bot.generationId ?? '—',
      closedFills: operation?.closedFills ?? 0,
    };
  });
}

type ArenaSnapshot = { bots: ReturnType<typeof buildProArenaBots>; entryPaused: boolean | null; error: string };

export async function getProArena(accountId: string, onCoreLoaded?: (snapshot: ArenaSnapshot) => void) {
  // Exchange history must not hold the database-backed bot list and controls hostage.
  const details = Promise.allSettled([aiTradingApi.leaderboard(100), aiTradingApi.testnetOperations(accountId)]);
  const [bots, profile] = await Promise.allSettled([aiTradingApi.bots(), getTradingExecutionProfile(accountId)]);
  if (bots.status === 'rejected') throw bots.reason;
  onCoreLoaded?.({
    bots: buildProArenaBots(accountId, bots.value, [], []),
    entryPaused: profile.status === 'fulfilled' ? profile.value.entryPaused : null,
    error: profile.status === 'rejected' ? getApiErrorMessage(profile.reason, 'İşlem durumu alınamadı.') : '',
  });
  const [scores, operations] = await details;
  const errors = [scores, operations, profile].flatMap((result) => result.status === 'rejected' ? [getApiErrorMessage(result.reason, 'Arena verisinin bir bölümü alınamadı.')] : []);
  return {
    bots: buildProArenaBots(accountId, bots.value, scores.status === 'fulfilled' ? scores.value : [], operations.status === 'fulfilled' ? operations.value.data : []),
    entryPaused: profile.status === 'fulfilled' ? profile.value.entryPaused : null,
    error: errors.join(' '),
  };
}
