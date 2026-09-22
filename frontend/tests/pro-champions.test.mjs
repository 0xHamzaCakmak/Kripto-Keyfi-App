import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, appType: 'custom', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false }, esbuild: { jsx: 'automatic' } });
after(() => vite.close());
const { ChampionsTable } = await vite.ssrLoadModule('/src/features/ai-trading-pro/components/Dashboard/ChampionsView.tsx');
const { getProChampions } = await vite.ssrLoadModule('/src/features/ai-trading-pro/services/backendChampions.ts');
const { api } = await vite.ssrLoadModule('/src/services/apiClient.ts');
test('renders all twenty real bot rows and marks missing evidence', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ id: `bot-${i}`, name: `Real Bot ${i}`, symbol: 'BTCUSDT', state: 'STOPPED', lifecycle: 'ACTIVE', strategy: null, generation: 1, rank: null, score: null, netPnl: null, roi: null, winRate: null, profitFactor: null, sharpe: null, maxDrawdown: null, totalTrades: 0, snapshotAt: null }));
  const html = renderToStaticMarkup(React.createElement(ChampionsTable, { rows }));
  assert.equal((html.match(/Yetersiz veri/g) ?? []).length, 20);
  assert.equal((html.match(/<tr/g) ?? []).length, 21);
  assert.ok(html.includes('Real Bot 19'));
  assert.ok(html.includes('Ölçüm yok'));
});
test('loads performance only for the selected account and forwards cancellation', async () => {
  const controller = new AbortController();
  let request;
  api.defaults.adapter = async config => { request = config; return { config, data: { data: { rows: [], fetchedAt: 'now' } }, status: 200, statusText: 'OK', headers: {} }; };
  assert.deepEqual(await getProChampions('account-b', controller.signal), { rows: [], fetchedAt: 'now' });
  assert.equal(request.url, '/admin/trading/pro-champions');
  assert.equal(request.params.exchangeAccountId, 'account-b');
  assert.equal(request.signal, controller.signal);
});
