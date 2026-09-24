// Shared across Arena requests so multiple open dashboards cannot each fill
// the database pool with one historical lookup per configured market.
let active = 0;
const waiting: Array<() => void> = [];
export async function arenaHistoryQuery<T>(query: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>(resolve => waiting.push(resolve));
  else active++;
  try { return await query(); }
  finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}
