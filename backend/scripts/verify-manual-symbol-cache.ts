import { prisma } from '../src/database/prisma.js';
import { getSymbolMarkPrice, listSymbols } from '../src/modules/trading/manual-trading.service.js';

async function main() {
  const account = await prisma.exchangeAccount.findFirst({
    where: { isActive: true, accountType: { not: 'SPOT' } },
    select: { id: true, userId: true, name: true },
  });
  if (!account) throw new Error('Doğrulama için aktif bir Futures hesabı bulunamadı.');
  if (process.argv.includes('--force-refresh')) {
    await prisma.$executeRaw`UPDATE exchange_symbol_cache SET isActive = FALSE WHERE exchangeAccountId = ${account.id}`;
  }
  const symbols = await listSymbols(account.userId, account.id);
  const cached = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count FROM exchange_symbol_cache WHERE exchangeAccountId = ${account.id} AND isActive = TRUE
  `;
  const cacheCount = Number(cached[0]?.count ?? 0n);
  if (symbols.length === 0 || cacheCount !== symbols.length) {
    throw new Error(`Sembol önbelleği doğrulanamadı: API=${symbols.length}, DB=${cacheCount}`);
  }
  const symbol = symbols.find((item) => item.symbol === 'BTCUSDT')?.symbol ?? symbols[0]!.symbol;
  const price = await getSymbolMarkPrice(account.userId, account.id, symbol);
  if (!(Number(price.markPrice) > 0)) throw new Error(`${symbol} mark fiyatı doğrulanamadı.`);
  console.log(JSON.stringify({ account: account.name, symbols: symbols.length, cached: cacheCount, symbol, markPrice: price.markPrice }));
}

main().finally(() => prisma.$disconnect());
