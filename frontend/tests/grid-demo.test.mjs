import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
const temp = await mkdtemp(path.join(tmpdir(), 'grid-ui-test-'));
after(() => rm(temp, { recursive: true, force: true }));
const bundle = path.join(temp, 'grid.cjs');
await build({ absWorkingDir: root, stdin: { resolveDir: root, loader: 'tsx', contents: `
  import React from 'react';
  import { renderToStaticMarkup } from 'react-dom/server';
  import { PlanTable, GridBotView } from './src/features/ai-trading-pro/components/Dashboard/GridBotView';
  export { api } from './src/services/apiClient';
  export * from './src/services/gridDemoService';
  export const table = props => renderToStaticMarkup(<PlanTable {...props}/>);
  export const screen = props => renderToStaticMarkup(<GridBotView {...props}/>);
` }, bundle: true, platform: 'node', format: 'cjs', outfile: bundle, tsconfig: path.join(root, 'tsconfig.json'), define: { 'import.meta.env': '{}' }, logLevel: 'silent' });
const mod = createRequire(import.meta.url)(bundle);
const pairs = [{ index: 0, direction: 'LONG', entryPrice: '2400', exitPrice: '2500', quantity: '0.1', estimatedNetProfit: '9.5' }, { index: 1, direction: 'SHORT', entryPrice: '2600', exitPrice: '2500', quantity: '0.1', estimatedNetProfit: '9.5' }];
test('preview labels distinguish opening a position from closing it', () => {
  const html = mod.table({ input: { marketType: 'FUTURES' }, plan: { pairs } });
  for (const label of ['Long aç', 'Long kapat', 'Short aç', 'Short kapat', 'LIMIT']) assert.ok(html.includes(label), label);
  const spot = mod.table({ input: { marketType: 'SPOT' }, plan: { pairs: pairs.slice(0, 1) } });
  assert.ok(spot.includes('BUY')); assert.ok(spot.includes('SELL')); assert.ok(!spot.includes('Short'));
});
test('grid screen has no fabricated running bots without an account', () => {
  const html = mod.screen({ accountId: null });
  assert.ok(html.includes('Grid Bot'));
  assert.ok(!html.includes('BTCUSDT'));
});
test('preview never calls confirm; approval submits only immutable preview identity', async () => {
  const calls = [];
  mod.api.defaults.adapter = async config => { calls.push(config); return { config, data: { data: {} }, status: 200, statusText: 'OK', headers: {} }; };
  await mod.previewDemoGrid({ exchangeAccountId: 'demo-a', symbol: 'ETHUSDT' });
  assert.equal(calls.length, 1); assert.ok(calls[0].url.endsWith('/preview'));
  await mod.confirmDemoGrid({ previewId: 'reviewed-id', account: { id: 'demo-a' }, input: { symbol: 'CHANGED' } });
  assert.deepEqual(JSON.parse(calls[1].data), { previewId: 'reviewed-id', exchangeAccountId: 'demo-a' });
  await mod.getDemoGrids('demo-b');
  assert.deepEqual(calls[2].params, { exchangeAccountId: 'demo-b' });
  await mod.controlDemoGrid('bot-a', 'demo-a', 'PAUSE');
  assert.deepEqual(JSON.parse(calls[3].data), { exchangeAccountId: 'demo-a', action: 'PAUSE' });
});
