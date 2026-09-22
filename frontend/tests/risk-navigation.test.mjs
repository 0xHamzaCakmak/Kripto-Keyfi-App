import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
const temp = await mkdtemp(path.join(tmpdir(), 'risk-nav-test-'));
after(() => rm(temp, { recursive: true, force: true }));
const bundle = path.join(temp, 'risk-nav.cjs');
await build({ absWorkingDir: root, stdin: { resolveDir: root, loader: 'tsx', contents: `
  import React from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
  import { ManagementNavigation } from './src/features/ai-trading-pro/components/ManagementNavigation';
  export { executionSettingFields } from './src/features/ai-trading-pro/components/Dashboard/ExecutionSettingsPanel';
  export const render = () => renderToStaticMarkup(<ManagementNavigation activeMainTab="ai-trading" onSelectMainTab={()=>{}} activeAiSubTab="overview" onSelectAiSubTab={()=>{}} isBotsRunning={null} controlDisabled={true} controlCount={0} onToggleBotsRunning={()=>{}} onOpenSettings={()=>{}} openPositionsCount={0}/>);
` }, bundle: true, platform: 'node', format: 'cjs', outfile: bundle, tsconfig: path.join(root, 'tsconfig.json'), define: { 'import.meta.env': '{}' }, logLevel: 'silent' });
const { render, executionSettingFields } = createRequire(import.meta.url)(bundle);
test('risk appears once in the primary navigation and never in AI subtabs', () => {
  const html = render();
  assert.equal((html.match(/Risk \/ Bot Ayarları/g) ?? []).length, 1);
  assert.ok(html.includes('main-tab-risk'));
  assert.ok(!html.includes('ai-subtab-risk'));
});
test('the single risk page retains all bot execution settings', () => {
  assert.deepEqual(executionSettingFields.map(([key]) => key), ['botAllocationUsdt', 'minInitialMarginUsdt', 'maxInitialMargin', 'maxOrderNotional', 'maxAccountOpenNotional', 'minLeverage', 'maxLeverage', 'stopLossBps', 'takeProfitBps', 'maxOrdersPerMinute', 'maxDailyOrders']);
});
