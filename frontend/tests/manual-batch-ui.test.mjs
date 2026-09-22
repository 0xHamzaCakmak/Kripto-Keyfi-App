import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const vite = await createServer({ root, configFile: false, appType: 'custom', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } });
after(() => vite.close());
const { ManualBatchPanel } = await vite.ssrLoadModule('/src/features/ai-trading-pro/components/Dashboard/ManualBatchPanel.tsx');
const service = await vite.ssrLoadModule('/src/services/manualBatchService.ts');
const { api } = await vite.ssrLoadModule('/src/services/apiClient.ts');

test('batch screen is manual and contains no bot eligibility controls', () => {
  const html = renderToStaticMarkup(React.createElement(ManualBatchPanel, { accountId: 'account-a', accountName: 'Binance Test' }));
  for (const label of ['Toplu Manuel İşlem', 'Coin başına teminat', 'SL fiyat hareketi', 'TP fiyat hareketi', 'Toplu Emirleri Önizle']) assert.ok(html.includes(label), label);
  for (const removed of ['Botlara Toplu İşlem', 'Hazır / Boşta', 'Bot başına', 'AI Momentum']) assert.ok(!html.includes(removed), removed);
});

test('batch API uses the dedicated durable preview and confirmation resources', async () => {
  const calls = [];
  api.defaults.adapter = async config => { calls.push(config); return { config, data: { data: {} }, status: 200, statusText: 'OK', headers: {} }; };
  await service.previewBatch({ exchangeAccountId: 'account-a', symbols: ['BTCUSDT'], side: 'BUY', initialMargin: '100', leverage: 5, stopLossPercent: 10, takeProfitPercent: 2 });
  await service.confirmBatch('batch-a', 'account-a');
  await service.getBatch('batch-a', 'account-a');
  assert.equal(calls[0].url, '/admin/trading/manual-batches/preview');
  assert.equal(calls[1].url, '/admin/trading/manual-batches/batch-a/confirm');
  assert.equal(calls[2].url, '/admin/trading/manual-batches/batch-a');
  assert.deepEqual(calls[2].params, { exchangeAccountId: 'account-a' });
});
