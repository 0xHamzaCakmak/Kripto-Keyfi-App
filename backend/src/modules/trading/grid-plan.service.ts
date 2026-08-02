import { Prisma } from '@prisma/client';
import { prisma } from '../../database/prisma.js';
import { ApiError } from '../../utils/api-error.js';
import { adapterFor, exchangeCall, ownedAccount } from './exchange-account.service.js';
import { gridConfigurationSchema, type GridPlanPreviewInput } from './bot.schema.js';
import { compareDecimals, isStepAligned, normalizeDecimal } from './decimal.js';

type GridConfiguration = GridPlanPreviewInput['configuration'];
type SymbolRule = { tickSize: string; stepSize: string; minQuantity: string; maxQuantity: string; minNotional: string; maxLeverage: number };

export async function previewGridPlan(userId: string, input: GridPlanPreviewInput) {
  const account = await ownedAccount(userId, input.exchangeAccountId);
  if (!account.isActive || account.connectionStatus !== 'CONNECTED') throw new ApiError(409, 'Grid planı için borsa hesabı bağlı ve aktif olmalıdır.', 'BOT_ACCOUNT_NOT_READY');
  const adapter = adapterFor(account);
  const [symbols, markPrice] = await Promise.all([
    exchangeCall(() => adapter.getSymbols()), exchangeCall(() => adapter.getMarkPrice(input.symbol)),
  ]);
  const rule = symbols.find((item) => item.symbol === input.symbol);
  if (!rule) throw new ApiError(404, 'İşleme açık vadeli parite bulunamadı.', 'TRADING_SYMBOL_NOT_FOUND');
  return buildGridPlan(input.symbol, normalizeDecimal(markPrice), input.configuration, rule, {
    id: account.id, name: account.name, provider: account.provider, environment: account.environment, accountType: account.accountType,
  });
}

export async function getStoredGridPlan(userId: string, botId: string) {
  const bot = await prisma.tradingBot.findFirst({ where: { id: botId, userId }, select: {
    id: true, type: true, symbol: true, configuration: true, exchangeAccountId: true,
  } });
  if (!bot) throw new ApiError(404, 'Bot bulunamadı.', 'TRADING_BOT_NOT_FOUND');
  if (bot.type !== 'GRID') throw new ApiError(409, 'Grid planı yalnızca GRID botları için kullanılabilir.', 'BOT_NOT_GRID');
  const parsed = gridConfigurationSchema.safeParse(bot.configuration);
  if (!parsed.success) throw new ApiError(422, 'Kayıtlı grid yapılandırması okunamadı.', 'GRID_CONFIGURATION_INVALID');
  return previewGridPlan(userId, { exchangeAccountId: bot.exchangeAccountId, symbol: bot.symbol, configuration: parsed.data });
}

export function buildGridPlan(symbol: string, markPrice: string, configuration: GridConfiguration, rule: SymbolRule, account: { id: string; name: string; provider: string; environment: string; accountType: string }) {
  if (configuration.marketType !== 'FUTURES') throw new ApiError(400, 'Spot Grid henüz desteklenmiyor.', 'SPOT_GRID_NOT_SUPPORTED');
  if (configuration.leverage > rule.maxLeverage) throw new ApiError(400, `Bu paritede en fazla ${rule.maxLeverage}x kaldıraç kullanılabilir.`, 'LEVERAGE_LIMIT_EXCEEDED');
  if (compareDecimals(configuration.quantityPerGrid, rule.minQuantity) < 0 || compareDecimals(configuration.quantityPerGrid, rule.maxQuantity) > 0) {
    throw new ApiError(400, `Grid miktarı ${rule.minQuantity} ile ${rule.maxQuantity} arasında olmalıdır.`, 'QUANTITY_OUT_OF_RANGE');
  }
  if (!isStepAligned(configuration.quantityPerGrid, rule.stepSize)) throw new ApiError(400, `Grid miktarı adımı ${rule.stepSize} olmalıdır.`, 'QUANTITY_STEP_MISMATCH');

  const lower = new Prisma.Decimal(configuration.lowerPrice);
  const upper = new Prisma.Decimal(configuration.upperPrice);
  const mark = new Prisma.Decimal(markPrice);
  const quantity = new Prisma.Decimal(configuration.quantityPerGrid);
  const tick = new Prisma.Decimal(rule.tickSize);
  const spacing = upper.sub(lower).div(configuration.gridLevels - 1);
  const inRange = mark.greaterThanOrEqualTo(lower) && mark.lessThanOrEqualTo(upper);
  let totalNotional = new Prisma.Decimal(0); let totalMargin = new Prisma.Decimal(0); let buyCount = 0; let sellCount = 0;
  const levels = Array.from({ length: configuration.gridLevels }, (_, offset) => {
    const rawPrice = offset === configuration.gridLevels - 1 ? upper : lower.add(spacing.mul(offset));
    const price = rawPrice.div(tick).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).mul(tick);
    const side = !inRange ? 'WAIT' : price.lessThan(mark) ? 'BUY' : price.greaterThan(mark) ? 'SELL' : 'WAIT';
    if (side === 'BUY') buyCount += 1; else if (side === 'SELL') sellCount += 1;
    const notional = price.mul(quantity);
    const initialMargin = notional.div(configuration.leverage);
    totalNotional = totalNotional.add(notional); totalMargin = totalMargin.add(initialMargin);
    return {
      index: offset + 1, price: decimal(price), side, quantity: decimal(quantity), notional: decimal(notional),
      estimatedInitialMargin: decimal(initialMargin), distancePercent: decimal(price.sub(mark).div(mark).mul(100), 4),
      status: 'PLANNED' as const,
    };
  });
  return {
    symbol, marketType: configuration.marketType, gridDirection: configuration.gridDirection, spacingType: configuration.spacingType,
    lowerPrice: decimal(lower), upperPrice: decimal(upper), markPrice: decimal(mark), markPriceInRange: inRange,
    gridLevels: configuration.gridLevels, gridIntervals: configuration.gridLevels - 1, priceSpacing: decimal(spacing),
    quantityPerGrid: decimal(quantity), leverage: configuration.leverage, marginMode: configuration.marginMode,
    buyCount, sellCount, waitCount: levels.length - buyCount - sellCount,
    maximumPlannedNotional: decimal(totalNotional), estimatedMaximumInitialMargin: decimal(totalMargin),
    account, levels, generatedAt: new Date(), submittedToExchange: false,
    warnings: [
      'Bu tablo plan/önizlemedir; borsada açık emir oluşturmaz.',
      '10 grid seviyesi 9 fiyat aralığı oluşturur.',
      'Tasfiye, funding ve değişken komisyon bu ilk plan hesabına dahil değildir.',
      ...(inRange ? [] : ['Mark fiyatı grid aralığı dışında; tüm seviyeler WAIT durumundadır.']),
    ],
  };
}

function decimal(value: Prisma.Decimal, places = 8) { return value.toDecimalPlaces(places).toFixed().replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1'); }
