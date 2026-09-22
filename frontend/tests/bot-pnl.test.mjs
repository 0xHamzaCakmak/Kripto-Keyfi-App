import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root = fileURLToPath(new URL('../', import.meta.url));
const temp = await mkdtemp(path.join(tmpdir(), 'pnl-ui-test-'));
after(() => rm(temp, { recursive: true, force: true }));
const bundle = path.join(temp, 'pnl.cjs');
await build({ absWorkingDir: root, stdin: { resolveDir: root, loader: 'tsx', contents: `
 import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
 import { PnlMonth, PnLAnalyticsView } from './src/features/ai-trading-pro/components/Dashboard/PnLAnalyticsView';
 export { api } from './src/services/apiClient'; export * from './src/services/botPnlService';
 export const month = props => renderToStaticMarkup(<PnlMonth {...props}/>);
 export const screen = props => renderToStaticMarkup(<PnLAnalyticsView {...props}/>);
 ` }, bundle: true, platform: 'node', format: 'cjs', outfile: bundle, tsconfig: path.join(root, 'tsconfig.json'), define: { 'import.meta.env': '{}' }, logLevel: 'silent' });
const m = createRequire(import.meta.url)(bundle);
test('calendar starts Monday, ends Sunday, includes leap day and six-week months', () => {
 for (const month of ['2026-09', '2026-08', '2024-02', '2027-02']) {
  const dates = m.calendarDates(month);
  assert.equal(new Date(dates[0]).getUTCDay(), 1); assert.equal(new Date(dates.at(-1)).getUTCDay(), 0);
  assert.equal(dates.length % 7, 0); assert.ok(dates.length <= 42);
 }
 assert.equal(m.calendarDates('2026-08').length, 42); assert.equal(m.monthRange('2024-02').end, '2024-02-29');
 assert.deepEqual(m.rangeMonths('2025-12-20', '2026-02-01'), ['2025-12', '2026-01', '2026-02']);
});
test('existing cards show signed results, breakeven and no-record days distinctly', () => {
 const days = ['4', '-2', '0', null].map((net, i) => ({ date: `2026-09-0${i + 1}`, net, count: 1, profit: '0', loss: '0' }));
 const html = m.month({ month: '2026-09', start: '2026-09-01', end: '2026-09-30', days });
 for (const text of ['KÂRLI GÜN', 'ZARARLI GÜN', 'BAŞA BAŞ', 'İşlem kaydı yok', 'KOMİSYON EKSİK', 'Detayı aç', 'grid-cols-7', 'rounded-xl', 'opacity-35']) assert.ok(html.includes(text), text);
 assert.equal((html.match(/data-date=/g) ?? []).length, 35);
 const empty = m.screen({ accountId: null }); assert.ok(empty.includes('API hesabı seçin')); assert.ok(!empty.includes('1,482.60'));
});
test('read and reset are scoped to selected account; read cannot reset', async () => {
 const calls = []; m.api.defaults.adapter = async config => { calls.push(config); return { config, data: { data: {} }, status: 200, statusText: 'OK', headers: {} }; };
 await m.getBotPnl('account-b', '2026-09-01', '2026-09-30');
 assert.equal(calls.length, 1); assert.equal(calls[0].method, 'get'); assert.deepEqual(calls[0].params, { exchangeAccountId: 'account-b', start: '2026-09-01', end: '2026-09-30' });
 await m.resetBotPnl('account-b'); assert.equal(calls[1].url, '/admin/trading/bot-pnl/reset'); assert.deepEqual(JSON.parse(calls[1].data), { exchangeAccountId: 'account-b', confirmation: 'SIFIRLA' });
 await m.getPnlDayDetails('account-b', '2026-09-14'); assert.equal(calls[2].url, '/admin/trading/bot-pnl/details'); assert.deepEqual(calls[2].params, { exchangeAccountId: 'account-b', date: '2026-09-14' });
});
