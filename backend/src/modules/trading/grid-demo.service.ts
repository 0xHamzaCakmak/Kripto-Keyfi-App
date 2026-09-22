import { randomUUID } from 'node:crypto';
import { Prisma, type TradingBot } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { adapterFor, ownedAccount } from './exchange-account.service.js';
import { assertCentralRiskExecution } from './execution-safety.js';
import { buildDemoGridPlan, assertGridPreviewFresh, type GridDemoPlan } from './grid-demo-plan.js';
import { gridDemoInputSchema, type GridDemoInput } from './grid-demo.schema.js';
import { previewTradingEngineOrder } from './trading-engine.client.js';
import { GridExchangeReader, type GridOrderSnapshot } from './grid-demo-exchange.js';

export type GridCycle = { cycle: number; entry?: string; exit?: string; stop?: string; entryFill?: GridOrderSnapshot; exitFill?: GridOrderSnapshot; stopFill?: GridOrderSnapshot; closes?: Array<{ id: string; fill?: GridOrderSnapshot }>; settled?: boolean };
export type GridRuntime = { cycles: GridCycle[]; realized: string; fees: string; pendingRealized?: string; pendingFees?: string; settledFeesComplete?: boolean; fundingUpdatedAt?: number; funding: string | null; unrealized: string; matched: number; feesComplete: boolean; closing: boolean; closeReason?: string; nextPair: number; nextEntryAt: number; markPrice?: string };
export type GridConfigurationV2 = { gridVersion: 2; input: GridDemoInput; plan: GridDemoPlan; baseAsset: string; stepSize: string; hedgeMode: boolean; expiresAt: string; confirmedAt?: string; runtime: GridRuntime };
export function gridConfiguration(bot: Pick<TradingBot, 'configuration'>): GridConfigurationV2 {
  const config = bot.configuration as unknown as GridConfigurationV2;
  if (config.gridVersion !== 2) throw new ApiError(409, 'Bu bot yeni grid emir döngüsünü kullanmıyor.', 'GRID_VERSION_MISMATCH');
  return config;
}
export const gridJson = (value: GridConfigurationV2) => value as unknown as Prisma.InputJsonValue;

export async function gridDemoSymbols(userId: string, accountId: string) {
  const account = await ownedAccount(userId, accountId);
  const symbols = await adapterFor(account).getSymbols();
  return { marketType: account.accountType === 'SPOT' ? 'SPOT' : 'FUTURES', symbols: symbols.filter(s => s.quoteAsset === 'USDT') };
}
export async function gridDemoPreview(userId: string, input: GridDemoInput) {
  const account = await gridReadyAccount(userId, input);
  const adapter = adapterFor(account);
  const [symbols, mark, positions, orders] = await Promise.all([adapter.getSymbols(), adapter.getMarkPrice(input.symbol), adapter.getPositions(), adapter.getOpenOrders()]);
  if (positions.some(p => p.symbol === input.symbol) || orders.some(o => o.symbol === input.symbol)) throw new ApiError(409, 'Bu paritede mevcut pozisyon veya emir var. Grid için boş bir parite seçin.', 'GRID_SYMBOL_BUSY');
  const rule = symbols.find(s => s.symbol === input.symbol);
  if (!rule) throw new ApiError(404, 'Seçili piyasada parite bulunamadı.', 'TRADING_SYMBOL_NOT_FOUND');
  const reader = new GridExchangeReader(account);
  const plan = buildDemoGridPlan(input, mark, rule, 10, await reader.maintenanceRate(input.symbol, input.investment));
  const hedgeMode = input.marketType === 'FUTURES' && adapter.getHedgeMode ? await adapter.getHedgeMode() : false;
  if (input.direction === 'NEUTRAL' && !hedgeMode) throw new ApiError(409, 'Nötr grid için borsa hesabında doğrulanmış hedge modu gerekli. Long/Short yönü seçin veya hesabın pozisyon modunu düzenleyin.', 'GRID_HEDGE_MODE_REQUIRED');
  await assertGridBudget(userId, account, input, plan);
  const id = randomUUID();
  const config: GridConfigurationV2 = { gridVersion: 2, input, plan, baseAsset: rule.baseAsset, stepSize: rule.stepSize, hedgeMode, expiresAt: new Date(Date.now() + 120000).toISOString(), runtime: { cycles: plan.pairs.map(() => ({ cycle: 0 })), realized: '0', fees: '0', funding: input.marketType === 'SPOT' ? '0' : null, unrealized: '0', matched: 0, feesComplete: true, closing: false, nextPair: 0, nextEntryAt: 0 } };
  await prisma.tradingBot.create({ data: { id, userId, exchangeAccountId: account.id, name: `Grid önizleme ${id}`, type: 'GRID', mode: 'DEMO', symbol: input.symbol, intervalSeconds: 10, configuration: gridJson(config) } });
  return { previewId: id, account: { id: account.id, name: account.name, provider: account.provider, environment: account.environment }, expiresAt: config.expiresAt, input, plan };
}

export async function gridDemoConfirm(userId: string, previewId: string, accountId: string) {
  const bot = await ownedGrid(userId, previewId, accountId);
  const config = gridConfiguration(bot);
  if (config.confirmedAt) return serializeGrid(bot);
  if (new Date(config.expiresAt) <= new Date()) throw new ApiError(410, 'Önizlemenin süresi doldu. Yeni listeyi kontrol edip onaylayın.', 'GRID_PREVIEW_EXPIRED');
  const account = await gridReadyAccount(userId, config.input);
  const adapter = adapterFor(account);
  const [mark, positions, orders] = await Promise.all([adapter.getMarkPrice(bot.symbol), adapter.getPositions(), adapter.getOpenOrders()]);
  assertGridPreviewFresh(config.plan, mark);
  if (positions.some(p => p.symbol === bot.symbol) || orders.some(o => o.symbol === bot.symbol)) throw new ApiError(409, 'Önizleme sonrasında paritede emir/pozisyon oluştu.', 'GRID_SYMBOL_BUSY');
  if (config.input.marketType === 'FUTURES' && adapter.getHedgeMode && await adapter.getHedgeMode() !== config.hedgeMode) throw new ApiError(409, 'Pozisyon modu değişti; yeniden önizleme oluşturun.', 'GRID_POSITION_MODE_CHANGED');
  const profile = await assertGridBudget(userId, account, config.input, config.plan);
  // Read-only executor preview validates the deployed exchange writer before accepting the reviewed plan.
  const first = config.plan.pairs[0]!;
  await previewTradingEngineOrder(account, { exchangeAccountId: account.id, symbol: bot.symbol, side: first.direction === 'LONG' ? 'BUY' : 'SELL', type: 'LIMIT', quantity: first.quantity, price: first.entryPrice, leverage: config.input.leverage, marginMode: 'ISOLATED', reduceOnly: false });
  return prisma.$transaction(async tx => {
    // Serialize confirmations on the account; duplicate clicks consume the SAME immutable preview once.
    await tx.exchangeAccount.update({ where: { id: account.id }, data: { updatedAt: new Date() } });
    const current = await tx.tradingBot.findUniqueOrThrow({ where: { id: bot.id } });
    if (gridConfiguration(current).confirmedAt) return serializeGrid(current);
    if (new Date(config.expiresAt) <= new Date()) throw new ApiError(410, 'Önizlemenin süresi doldu.', 'GRID_PREVIEW_EXPIRED');
    const conflict = await tx.tradingBot.count({ where: { id: { not: bot.id }, exchangeAccountId: account.id, symbol: bot.symbol, mode: 'DEMO', OR: [{ desiredState: 'RUNNING' }, { state: { in: ['STARTING', 'RUNNING', 'PAUSED', 'RECONCILING', 'RISK_BLOCKED', 'ERROR'] } }] } });
    if (conflict) throw new ApiError(409, 'Bu parite başka bir bot tarafından kullanılıyor.', 'GRID_SYMBOL_BUSY');
    const reservations = await tx.tradingBot.findMany({ where: { id: { not: bot.id }, exchangeAccountId: account.id, type: 'GRID', mode: 'DEMO', state: { notIn: ['DRAFT', 'STOPPED'] }, configuration: { path: '$.gridVersion', equals: 2 } }, select: { configuration: true } });
    const reserved = reservations.reduce((sum, row) => sum.add(gridConfiguration(row).input.investment), new Prisma.Decimal(0));
    const reservedNotional = reservations.reduce((sum, row) => sum.add(gridConfiguration(row).plan.totalNotional), new Prisma.Decimal(config.plan.totalNotional));
    if (profile.maxAccountOpenNotional.gt(0) && reservedNotional.gt(profile.maxAccountOpenNotional)) throw new ApiError(409, 'Gridlerin toplam emir büyüklüğü hesap risk sınırını aşıyor.', 'GRID_ACCOUNT_NOTIONAL_LIMIT');
    const balances = await adapter.getBalances();
    const available = balances.filter(b => b.asset === 'USDT' && (config.input.marketType === 'SPOT' ? b.walletType === 'SPOT' : b.walletType !== 'SPOT')).reduce((sum, b) => sum.add(b.availableBalance), new Prisma.Decimal(0));
    if (reserved.add(config.input.investment).gt(available.sub(profile.minAvailableBalance))) throw new ApiError(409, 'Hesap sermayesi diğer gridlere ayrılmış. Yatırımı azaltın veya mevcut gridi kapatın.', 'GRID_CAPITAL_ALREADY_RESERVED');
    config.confirmedAt = new Date().toISOString();
    const updated = await tx.tradingBot.update({ where: { id: bot.id }, data: { name: config.input.name, state: 'STARTING', desiredState: 'RUNNING', startedAt: new Date(), configuration: gridJson(config), stateReason: 'Onaylanan limit emirler merkezi risk kontrolü ile hazırlanıyor.', version: { increment: 1 } } });
    await tx.tradingAuditLog.create({ data: { userId, exchangeAccountId: account.id, action: 'GRID_PREVIEW_CONFIRMED', entityType: 'TRADING_BOT', entityId: bot.id, metadata: { previewId, currentPrice: mark, levels: config.plan.pairs.length } } });
    return serializeGrid(updated);
  });
}

export async function listDemoGrids(userId: string, accountId: string) {
  await ownedAccount(userId, accountId);
  const bots = await prisma.tradingBot.findMany({ where: { userId, exchangeAccountId: accountId, type: 'GRID', mode: 'DEMO', configuration: { path: '$.gridVersion', equals: 2 } }, orderBy: { createdAt: 'desc' } });
  return bots.filter(b => gridConfiguration(b).confirmedAt).map(serializeGrid);
}
export async function controlDemoGrid(userId: string, id: string, accountId: string, action: 'PAUSE' | 'RESUME' | 'CLOSE') {
  const bot = await ownedGrid(userId, id, accountId);
  const config = gridConfiguration(bot);
  if (!config.confirmedAt || bot.state === 'STOPPED') throw new ApiError(409, 'Bot bu işlem için uygun durumda değil.', 'GRID_STATE_CONFLICT');
  if (action === 'RESUME') {
    if (config.runtime.closing || bot.state !== 'PAUSED') throw new ApiError(409, 'Yalnızca duraklatılmış grid devam ettirilebilir.', 'GRID_STATE_CONFLICT');
    await gridReadyAccount(userId, config.input);
  }
  const updated = await prisma.tradingBot.update({ where: { id }, data: { desiredState: action === 'RESUME' ? 'RUNNING' : 'STOPPED', state: action === 'RESUME' ? 'STARTING' : action === 'PAUSE' ? 'PAUSED' : 'RECONCILING', stateReason: action === 'CLOSE' ? 'GRID_CLOSE_REQUESTED' : action === 'PAUSE' ? 'Yeni girişler duraklatılıyor; kapanış ve korumalar sürüyor.' : 'Grid devam ediyor.' } });
  return serializeGrid(updated);
}
export async function ownedGrid(userId: string, id: string, accountId: string) {
  const bot = await prisma.tradingBot.findFirst({ where: { id, userId, exchangeAccountId: accountId, type: 'GRID', mode: 'DEMO' } });
  if (!bot) throw new ApiError(404, 'Seçili hesapta grid bulunamadı.', 'GRID_NOT_FOUND');
  gridConfiguration(bot); return bot;
}
export function serializeGrid(bot: TradingBot) {
  const c = gridConfiguration(bot), r = c.runtime;
  return { id: bot.id, exchangeAccountId: bot.exchangeAccountId, name: c.input.name, symbol: bot.symbol, state: bot.state, desiredState: bot.desiredState, stateReason: bot.stateReason, lastError: bot.lastErrorMessage, heartbeatAt: bot.heartbeatAt, input: c.input, plan: c.plan, runtime: r, totalNet: r.funding !== null && r.feesComplete ? new Prisma.Decimal(r.realized).add(r.pendingRealized ?? '0').sub(r.fees).sub(r.pendingFees ?? '0').add(r.unrealized).add(r.funding).toFixed() : null };
}
export async function gridReadyAccount(userId: string, input: GridDemoInput) {
  gridDemoInputSchema.parse(input);
  const account = await ownedAccount(userId, input.exchangeAccountId);
  if (!account.isActive || account.connectionStatus !== 'CONNECTED' || !account.canTrade || !['TESTNET', 'DEMO'].includes(account.environment)) throw new ApiError(409, 'Aktif, işlem yetkili demo borsa hesabı seçin.', 'GRID_ACCOUNT_NOT_READY');
  if ((account.accountType === 'SPOT') !== (input.marketType === 'SPOT')) throw new ApiError(400, 'Piyasa seçimi hesap türüyle uyuşmuyor. Spot için Spot demo API hesabı seçin.', 'GRID_MARKET_ACCOUNT_MISMATCH');
  assertCentralRiskExecution({ executionEngine: account.executionEngine, reduceOnly: false });
  return account;
}
export async function assertGridBudget(userId: string, account: Awaited<ReturnType<typeof ownedAccount>>, input: GridDemoInput, plan: GridDemoPlan) {
  const [profile, control, balances] = await Promise.all([prisma.tradingRiskProfile.findUnique({ where: { exchangeAccountId: account.id } }), prisma.tradingRiskControl.findUnique({ where: { id: 'global' } }), adapterFor(account).getBalances()]);
  if (input.marketType === 'FUTURES' && profile?.marginModePolicy === 'CROSS_ONLY') throw new ApiError(409, 'Grid için risk ayarlarında izole marjine izin verilmeli.', 'GRID_MARGIN_POLICY');
  if (input.direction === 'NEUTRAL' && profile && ((profile.maxSymbolPositions > 0 && profile.maxSymbolPositions < 2) || (profile.maxOpenPositions > 0 && profile.maxOpenPositions < 2))) throw new ApiError(409, `Nötr grid LONG ve SHORT için iki pozisyon yönü gerektirir. Mevcut parite başına sınır: ${profile.maxSymbolPositions}; hesap toplam sınırı: ${profile.maxOpenPositions}. Risk / Bot Ayarları bölümünde her iki sınır en az 2 olmalı. Tek yönlü strateji istiyorsanız LONG veya SHORT seçin.`, 'GRID_POSITION_LIMIT');
  if (!profile?.enabled || profile.accountKillSwitch || !control || control.globalKillSwitch) throw new ApiError(409, 'Hesap/merkezi risk kontrolü yeni grid girişlerine kapalı.', 'GRID_RISK_BLOCKED');
  if (input.marketType === 'FUTURES' && (input.leverage < profile.minLeverage || input.leverage > profile.maxLeverage)) throw new ApiError(409, `Risk ekranında izin verilen kaldıraç ${profile.minLeverage}x–${profile.maxLeverage}x.`, 'GRID_LEVERAGE_POLICY');
  const available = balances.filter(b => b.asset === 'USDT' && (input.marketType === 'SPOT' ? b.walletType === 'SPOT' : b.walletType !== 'SPOT')).reduce((sum, b) => sum.add(b.availableBalance), new Prisma.Decimal(0));
  if (available.sub(profile.minAvailableBalance).lt(input.investment)) throw new ApiError(409, 'Ayrılan sermaye ve hesap rezervi için kullanılabilir bakiye yetersiz.', 'GRID_BALANCE_INSUFFICIENT');
  if (profile.maxSymbolOpenNotional.gt(0) && profile.maxSymbolOpenNotional.lt(plan.totalNotional)) throw new ApiError(409, 'Grid toplam büyüklüğü Risk ekranındaki parite sınırını aşıyor.', 'GRID_SYMBOL_NOTIONAL_LIMIT');
  if (profile.maxAccountOpenNotional.gt(0) && profile.maxAccountOpenNotional.lt(plan.totalNotional)) throw new ApiError(409, 'Grid toplam büyüklüğü hesap risk sınırını aşıyor.', 'GRID_ACCOUNT_NOTIONAL_LIMIT');
  for (const p of plan.pairs) if ((profile.maxOrderNotional.gt(0) && profile.maxOrderNotional.lt(new Prisma.Decimal(p.quantity).mul(p.entryPrice))) || (profile.maxInitialMargin.gt(0) && profile.maxInitialMargin.lt(new Prisma.Decimal(p.quantity).mul(p.entryPrice).div(input.leverage)))) throw new ApiError(409, 'Grid emir miktarı Risk ekranındaki işlem başı sınırı aşıyor.', 'GRID_ORDER_LIMIT');
  return profile;
}
