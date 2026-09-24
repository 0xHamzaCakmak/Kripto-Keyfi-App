import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const temp = await mkdtemp(path.join(tmpdir(), 'pro-loading-'));
after(() => rm(temp, { recursive: true, force: true }));
const outfile = path.join(temp, 'test.cjs');
await build({ absWorkingDir: root, stdin: { resolveDir: root, loader: 'tsx', contents: `
  import React from 'react';
  import { renderToStaticMarkup } from 'react-dom/server';
  import { MemoryRouter } from 'react-router-dom';
  import { AdminRoute, ProtectedRoute } from './src/auth/RouteGuards';
  export { getProArena } from './src/features/ai-trading-pro/services/backendArena';
  export { api } from './src/services/apiClient';
  export const render = () => renderToStaticMarkup(<MemoryRouter><AdminRoute><ProtectedRoute><div>dashboard-kept</div></ProtectedRoute></AdminRoute></MemoryRouter>);
` }, plugins: [{ name: 'auth-fixture', setup(b) {
  b.onResolve({ filter: /AuthContext$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const useAuth = () => globalThis.authFixture;', loader: 'js' }));
} }], bundle: true, platform: 'node', format: 'cjs', outfile, define: { 'import.meta.env': '{}' }, logLevel: 'silent' });
const { render, api, getProArena } = createRequire(import.meta.url)(outfile);

test('authenticated dashboard remains mounted during token refresh, but initial auth stays gated', () => {
  globalThis.authFixture = { status: 'refreshing', user: { backendRole: 'ADMIN' } };
  assert.match(render(), /dashboard-kept/);
  globalThis.authFixture = { status: 'initializing', user: { backendRole: 'ADMIN' } };
  assert.doesNotMatch(render(), /dashboard-kept/);
  globalThis.authFixture = { status: 'refreshing', user: null };
  assert.doesNotMatch(render(), /dashboard-kept/);
});

test('arena delivers bot controls before delayed exchange history', async () => {
  let release;
  const history = new Promise(resolve => { release = resolve; });
  api.defaults.adapter = async config => {
    let data = [];
    if (config.url.includes('testnet-operations')) { await history; data = { data: [] }; }
    else if (config.url.includes('risk-profile')) data = { entryPaused: true };
    else if (config.url.includes('bot-factory/bots')) data = [{ id: 'b', exchangeAccountId: 'a', mode: 'DEMO', symbols: ['BTCUSDT'], state: 'RUNNING' }];
    return { data: { data }, status: 200, statusText: 'OK', headers: {}, config };
  };
  let core;
  let done = false;
  const pending = getProArena('a', value => { core = value; }).then(value => { done = true; return value; });
  try {
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(core.bots.length, 1);
    assert.equal(done, false);
  } finally { release(); await pending; }
});
