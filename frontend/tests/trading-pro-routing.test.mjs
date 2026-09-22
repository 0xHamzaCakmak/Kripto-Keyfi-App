import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
const temp = await mkdtemp(path.join(tmpdir(), 'trading-pro-route-'));
const outfile = path.join(temp, 'route.cjs');
await build({ entryPoints: [path.join(root, 'src/features/ai-trading-pro/legacyRoute.ts')], bundle: true, platform: 'node', format: 'cjs', outfile });
const { legacyTradingTarget } = createRequire(import.meta.url)(outfile);

test('all former trading pages lead into the matching Pro tab', () => {
  assert.equal(legacyTradingTarget('/admin/trading'), '/admin/trading/ai-pro?tab=ai-trading');
  assert.equal(legacyTradingTarget('/admin/trading/ai'), '/admin/trading/ai-pro?tab=ai-trading');
  assert.equal(legacyTradingTarget('/admin/trading/manual'), '/admin/trading/ai-pro?tab=manual-trade');
  assert.equal(legacyTradingTarget('/admin/trading/profit-loss'), '/admin/trading/ai-pro?tab=pnl');
  assert.equal(legacyTradingTarget('/admin/trading/system'), '/admin/trading/ai-pro?tab=system');
});

test('admin Trading Bot links point directly to Pro', async () => {
  const [layout, dashboard] = await Promise.all([
    readFile(path.join(root, 'src/components/AdminLayout.tsx'), 'utf8'),
    readFile(path.join(root, 'src/components/AdminDashboard.tsx'), 'utf8'),
  ]);
  assert.match(layout, /Trading Bot[^\n]+\/admin\/trading\/ai-pro/);
  assert.match(dashboard, /\/admin\/trading\/ai-pro/);
});

test.after(() => rm(temp, { recursive: true, force: true }));
