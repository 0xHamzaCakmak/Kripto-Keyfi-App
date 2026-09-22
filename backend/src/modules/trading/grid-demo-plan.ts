import { Prisma } from '@prisma/client';
import { ApiError } from '../../utils/api-error.js';
import type { ExchangeSymbol } from './exchanges/exchange-adapter.js';
import type { GridDemoInput } from './grid-demo.schema.js';

const D = Prisma.Decimal;
export const gridDecimal = (value: Prisma.Decimal.Value) => new D(value).toFixed();
export type GridPair = { index: number; direction: 'LONG' | 'SHORT'; entryPrice: string; exitPrice: string; quantity: string; estimatedNetProfit: string };
export type GridDemoPlan = ReturnType<typeof buildDemoGridPlan>;

/** Prices and sizes use decimal arithmetic. The reviewed pairs stay immutable after confirmation. */
export function buildDemoGridPlan(input: GridDemoInput, currentPrice: string, rule: ExchangeSymbol, feeBps = 10, maintenanceRate?: string) {
  const lower = new D(input.lowerPrice), upper = new D(input.upperPrice), mark = new D(currentPrice);
  const tick = new D(rule.tickSize), step = new D(rule.stepSize), interval = new D(input.interval);
  if (!mark.isPositive() || !tick.isPositive() || !step.isPositive()) fail('Borsa fiyat/adım bilgisi geçersiz.');
  if (mark.lte(lower) || mark.gte(upper)) fail('Önizleme için güncel fiyat alt ve üst sınırın içinde olmalıdır.');
  if (input.leverage > rule.maxLeverage) fail('Kaldıraç parite limitini aşıyor.');
  for (const price of [lower, upper, new D(input.stopLowerPrice), ...(input.stopUpperPrice ? [new D(input.stopUpperPrice)] : [])]) {
    if (!price.mod(tick).isZero()) fail(`Fiyatlar borsanın ${rule.tickSize} fiyat adımına uymalıdır.`);
  }
  const prices: Prisma.Decimal[] = [lower];
  for (let n = 1; n <= 100; n++) {
    const raw = input.spacingType === 'ARITHMETIC' ? lower.add(interval.mul(n)) : lower.mul(new D(1).add(interval.div(100)).pow(n));
    const price = raw.div(tick).floor().mul(tick);
    if (price.lte(prices[prices.length - 1]!)) fail('İşlem aralığı borsanın fiyat adımından küçük.');
    if (price.gt(upper)) break;
    prices.push(price);
    if (price.eq(upper)) break;
    if (n === 100) fail('En fazla 100 grid aralığı kullanılabilir; işlem aralığını büyütün.');
  }
  if (prices.length < 3) fail('En az iki grid aralığı oluşturun.');
  const candidates: Array<Omit<GridPair, 'quantity' | 'estimatedNetProfit'>> = [];
  prices.forEach((price, index) => {
    if (price.lt(mark) && index + 1 < prices.length && input.direction !== 'SHORT') candidates.push({ index, direction: 'LONG', entryPrice: price.toFixed(), exitPrice: prices[index + 1]!.toFixed() });
    if (price.gt(mark) && index > 0 && input.marketType === 'FUTURES' && input.direction !== 'LONG') candidates.push({ index, direction: 'SHORT', entryPrice: price.toFixed(), exitPrice: prices[index - 1]!.toFixed() });
  });
  if (!candidates.length) fail('Seçilen yönde başlangıç emri oluşmadı.');
  const budget = new D(input.investment), reserve = budget.mul(input.reservePercent).div(100);
  // Position sizing never multiplies the budget by leverage. Size is capped by BOTH capital and worst stop loss.
  const capitalPerUnit = candidates.reduce((sum, pair) => sum.add(pair.entryPrice), new D(0));
  const lossPerUnit = candidates.reduce((sum, pair) => {
    const stop = new D(pair.direction === 'LONG' ? input.stopLowerPrice : input.stopUpperPrice!);
    return sum.add(new D(pair.entryPrice).sub(stop).abs()).add(new D(pair.entryPrice).add(stop).mul(feeBps + 10).div(10000));
  }, new D(0));
  const quantity = D.min(budget.sub(reserve).div(capitalPerUnit), new D(input.maxLoss).mul('0.8').div(lossPerUnit)).div(step).floor().mul(step);
  if (quantity.lt(rule.minQuantity) || quantity.gt(rule.maxQuantity)) fail('Sermaye/zarar sınırı bu grid sayısında geçerli emir miktarı üretmiyor. Aralığı büyütün veya sermayeyi düzenleyin.');
  const pairs: GridPair[] = candidates.map(pair => {
    if (quantity.mul(pair.entryPrice).lt(rule.minNotional) || quantity.mul(pair.exitPrice).lt(rule.minNotional)) fail(`Her giriş ve çıkış en az ${rule.minNotional} USDT olmalıdır.`);
    const net = new D(pair.entryPrice).sub(pair.exitPrice).abs().sub(new D(pair.entryPrice).add(pair.exitPrice).mul(feeBps).div(10000)).mul(quantity);
    if (net.lte(0)) fail('İşlem aralığı tahmini gidiş/dönüş komisyonunu karşılamıyor.');
    return { ...pair, quantity: quantity.toFixed(), estimatedNetProfit: net.toFixed() };
  });
  const liquidationPrices: { long: string | null; short: string | null } = { long: null, short: null };
  if (input.marketType === 'FUTURES' && maintenanceRate !== undefined) {
    const rate = new D(maintenanceRate);
    if (rate.lt(0) || rate.gte(new D(1).div(input.leverage))) fail('Bakım marjini oranı bu kaldıraç için uygun değil.');
    for (const pair of pairs) {
      // Ignore maintenance deductions and added margin: conservative single-leg bounds also cover partial initialization.
      const entry = new D(pair.entryPrice);
      if (pair.direction === 'LONG') {
        const liq = entry.mul(new D(1).sub(new D(1).div(input.leverage))).div(new D(1).sub(rate));
        if (liq.gt(0) && new D(input.stopLowerPrice).lte(liq.mul('1.02'))) fail('Alt stop ile tahmini long likidasyonu arasında yeterli mesafe yok.');
        liquidationPrices.long = D.max(liquidationPrices.long ?? '0', liq).toFixed();
      } else {
        const liq = entry.mul(new D(1).add(new D(1).div(input.leverage))).div(new D(1).add(rate));
        if (new D(input.stopUpperPrice!).gte(liq.mul('0.98'))) fail('Üst stop ile tahmini short likidasyonu arasında yeterli mesafe yok.');
        liquidationPrices.short = liquidationPrices.short === null ? liq.toFixed() : D.min(liquidationPrices.short, liq).toFixed();
      }
    }
  }
  return {
    liquidationPrices,
    currentPrice: mark.toFixed(), prices: prices.map(p => p.toFixed()), pairs,
    effectiveUpperPrice: prices[prices.length - 1]!.toFixed(), intervalCount: prices.length - 1,
    totalNotional: quantity.mul(capitalPerUnit).toFixed(), initialMargin: quantity.mul(capitalPerUnit).div(input.leverage).toFixed(),
    reserve: reserve.toFixed(), estimatedStopLoss: quantity.mul(lossPerUnit).toFixed(), feeBps,
    warnings: [
      'Başlangıçta piyasa emriyle coin/pozisyon alınmaz. Girişler limit emir olarak borsada bekler.',
      'Karşı emir yalnızca girişin gerçekleşen miktarı için oluşturulur; long kapatma short açmaz.',
      'Getiri tahmindir; funding ve gerçekleşme farkı net sonucu değiştirir. Stop kesin gerçekleşme fiyatı garantisi değildir.',
      ...(prices[prices.length - 1]!.lt(upper) ? ['Üst sınır işlem aralığına tam bölünmedi; son uygulanabilir seviye tabloda gösteriliyor.'] : []),
    ],
  };
}

export function assertGridPreviewFresh(plan: GridDemoPlan, currentPrice: string) {
  const price = new D(currentPrice), previous = new D(plan.currentPrice);
  if (price.sub(previous).abs().div(previous).gt('0.005') || plan.pairs.some(p => p.direction === 'LONG' ? price.lte(p.entryPrice) : price.gte(p.entryPrice))) {
    throw new ApiError(409, 'Fiyat değişti veya bir giriş seviyesi aşıldı. Yeni önizlemeyi kontrol edip tekrar onaylayın.', 'GRID_PREVIEW_PRICE_CHANGED');
  }
}
function fail(message: string): never { throw new ApiError(400, message, 'GRID_PLAN_INVALID'); }
