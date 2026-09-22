import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const temp = await mkdtemp(path.join(tmpdir(), 'trade-pro-positions-'));
after(() => rm(temp, { recursive: true, force: true }));
const bundle = path.join(temp, 'positions.cjs');
await build({
  absWorkingDir: root,
  stdin: {
    resolveDir: root,
    loader: 'tsx',
    contents: `
      import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { PositionsFullView } from './src/features/ai-trading-pro/components/Dashboard/PositionsFullView';
      import { ActivePositionsTable } from './src/features/ai-trading-pro/components/Dashboard/ActivePositionsTable';
      export { api } from './src/services/apiClient';
      export { closeOpenPosition, getOpenOrders, cancelOrder } from './src/services/tradingService';
      export { canCancelProOrder } from './src/features/ai-trading-pro/components/Dashboard/OrdersFullView';
      export { selectedDemoBots } from './src/features/ai-trading-pro/services/useProBotControl';
      export { aiTradingApi } from './src/services/aiTradingService';
      export { updateTradingExecutionProfile } from './src/services/tradingService';
      export { riskDetailFields, buildRiskDetailsPayload, saveRiskDetails, setRiskKillSwitch } from './src/features/ai-trading-pro/services/backendRisk';
      import { RiskFullView } from './src/features/ai-trading-pro/components/Dashboard/RiskFullView';
      export const renderRisk = (props) => renderToStaticMarkup(<RiskFullView {...props} />);
      export { buildProArenaBots } from './src/features/ai-trading-pro/services/backendArena';
      export { getTradeProPositions, getTradeProOperations, closeTradeProPosition } from './src/features/ai-trading-pro/services/backendDashboard';
      export const renderPositions = (props) => renderToStaticMarkup(<PositionsFullView {...props} />);
      export const renderOverview = (props) => renderToStaticMarkup(<ActivePositionsTable {...props} />);
    `,
  },
  bundle: true, platform: 'node', format: 'cjs', outfile: bundle,
  tsconfig: path.join(root, 'tsconfig.json'),
  define: { 'import.meta.env': '{}' }, logLevel: 'silent',
});
const { api, getTradeProPositions, getTradeProOperations, closeTradeProPosition, closeOpenPosition, getOpenOrders, cancelOrder, canCancelProOrder, buildProArenaBots, renderPositions, renderOverview } = createRequire(import.meta.url)(bundle);
const long = { positionKey: 'BINANCE:BTCUSDT:LONG', symbol: 'BTCUSDT', side: 'LONG', quantity: '0.1', entryPrice: '60000', markPrice: '61000', unrealizedPnl: '100', leverage: '10', marginMode: 'ISOLATED' };
const short = { ...long, positionKey: 'BINANCE:BTCUSDT:SHORT', side: 'SHORT', unrealizedPnl: '-100' };
const response = (config, data) => ({ config, data: { data }, status: 200, statusText: 'OK', headers: {} });
const { selectedDemoBots, aiTradingApi, updateTradingExecutionProfile } = createRequire(import.meta.url)(bundle);
test('My Bots excludes other accounts, paper and archived bots', () => {
  const bot = { id: 'a', exchangeAccountId: 'demo-a', mode: 'DEMO', lifecycleStatus: 'TESTING' };
  assert.deepEqual(selectedDemoBots('demo-a', [bot, { ...bot, id: 'b', exchangeAccountId: 'demo-b' }, { ...bot, mode: 'PAPER' }, { ...bot, lifecycleStatus: 'ARCHIVED' }]), [bot]);
});
test('account control writes entryPaused only; individual bot actions target exact bot IDs', async () => {
  const calls = [];
  api.defaults.adapter = async (config) => { calls.push(config); return response(config, { data: {}, entryPaused: true }); };
  await updateTradingExecutionProfile('demo-b', { entryPaused: true });
  assert.equal(calls[0].url, '/admin/trading/exchange-accounts/demo-b/risk-profile');
  assert.deepEqual(JSON.parse(calls[0].data), { entryPaused: true });
  await aiTradingApi.pauseBot('bot-b');
  await aiTradingApi.startBot('bot-b');
  await aiTradingApi.resumeBot('bot-b');
  assert.deepEqual(calls.slice(1).map((config) => config.url), ['pause', 'start', 'resume'].map((action) => `/admin/trading/autonomous/bots/bot-b/${action}`));
});
const { riskDetailFields, buildRiskDetailsPayload, saveRiskDetails, setRiskKillSwitch, renderRisk } = createRequire(import.meta.url)(bundle);
const riskDraft = () => ({ ...Object.fromEntries(riskDetailFields.map(([key, , min]) => [key, String(min)])), marginModePolicy: 'ISOLATED_ONLY', allowedSymbols: 'btcusdt, ETHUSDT', blockedSymbols: 'SOLUSDT' });

test('risk settings appear only in Risk and never load a fabricated default account', () => {
  const positions = renderPositions({ accountId: 'demo-a', positions: [], operations: [], loading: false, onRefresh() {} });
  assert.doesNotMatch(positions, /Demo işlem ayarları|Ayarları kaydet/);
  assert.match(renderRisk({ accountId: 'demo-a', accountName: 'My demo' }), /Demo işlem ayarları/);
  const noAccount = renderRisk({ accountId: null });
  assert.doesNotMatch(noAccount, /Demo işlem ayarları|binance-test|DB Senkronize/);
});

test('risk detail save keeps decimal precision and scopes writes to the selected account', async () => {
  let sent;
  api.defaults.adapter = async (config) => { sent = config; return response(config, {}); };
  await saveRiskDetails('demo-b', { ...riskDraft(), minAvailableBalance: '123.123456789', accountKillSwitch: 'true', maxLeverage: '20' });
  assert.equal(sent.url, '/admin/trading/exchange-accounts/demo-b/risk-profile');
  const body = JSON.parse(sent.data);
  assert.equal(body.minAvailableBalance, '123.123456789');
  assert.equal(body.maxOpenPositions, 0);
  assert.deepEqual(body.allowedSymbols, ['BTCUSDT', 'ETHUSDT']);
  assert.equal(body.accountKillSwitch, undefined);
  assert.equal(body.maxLeverage, undefined);
});

test('risk details reject conflicting symbols and invalid numeric limits', () => {
  assert.throws(() => buildRiskDetailsPayload({ ...riskDraft(), blockedSymbols: 'BTCUSDT' }));
  assert.throws(() => buildRiskDetailsPayload({ ...riskDraft(), maxOpenPositions: '1.5' }));
  assert.throws(() => buildRiskDetailsPayload({ ...riskDraft(), maxDrawdownPct: '2' }));
  assert.throws(() => buildRiskDetailsPayload({ ...riskDraft(), minAvailableBalance: '' }));
});

test('account kill switch includes selected ID, global scope omits account ID', async () => {
  const calls = [];
  api.defaults.adapter = async (config) => { calls.push(JSON.parse(config.data)); return response(config, {}); };
  await setRiskKillSwitch('demo-b', 'ACCOUNT', true, 'Test reason');
  await setRiskKillSwitch('demo-b', 'GLOBAL', false, 'Test reason');
  assert.deepEqual(calls[0], { scope: 'ACCOUNT', active: true, reason: 'Test reason', exchangeAccountId: 'demo-b' });
  assert.deepEqual(calls[1], { scope: 'GLOBAL', active: false, reason: 'Test reason' });
});

test('orders read and cancellation carry the selected account and exchange order', async () => {
  const order = { exchangeOrderId: 'order-123', symbol: 'BTCUSDT', status: 'NEW' };
  const calls = [];
  api.defaults.adapter = async (config) => { calls.push(config); return response(config, config.method === 'get' ? [order] : {}); };
  assert.deepEqual(await getOpenOrders('demo-b'), [order]);
  await cancelOrder('demo-b', order);
  assert.equal(calls[0].params.exchangeAccountId, 'demo-b');
  assert.equal(calls[1].url, '/admin/trading/orders/order-123/cancel');
  const body = JSON.parse(calls[1].data);
  assert.equal(body.exchangeAccountId, 'demo-b');
  assert.equal(body.symbol, 'BTCUSDT');
  assert.ok(body.idempotencyKey);
});

test('pending, completed and reconciliation orders cannot be canceled again', () => {
  const order = { exchangeOrderId: 'order-123', status: 'NEW' };
  assert.equal(canCancelProOrder(order), true);
  assert.equal(canCancelProOrder({ ...order, pending: true }), false);
  assert.equal(canCancelProOrder({ ...order, exchangeOrderId: '' }), false);
  for (const status of ['SUBMITTING', 'CANCELING', 'CLOSING', 'RECONCILIATION_REQUIRED', 'FILLED', 'CANCELED', 'REJECTED', 'EXPIRED']) {
    assert.equal(canCancelProOrder({ ...order, status }), false, status);
  }
});

test('Arena uses only selected demo bots and does not manufacture missing performance', () => {
  const bot = { id: 'a', name: 'Actual bot', exchangeAccountId: 'demo-a', mode: 'DEMO', lifecycleStatus: 'TESTING', state: 'RUNNING', symbols: ['BTCUSDT'], generationId: 'g1', strategyVersion: null };
  const rows = buildProArenaBots('demo-a', [bot, { ...bot, id: 'b', exchangeAccountId: 'demo-b' }, { ...bot, id: 'c', mode: 'PAPER' }, { ...bot, id: 'd', lifecycleStatus: 'ARCHIVED' }], [], []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'a');
  for (const field of ['score', 'totalPnl', 'entryPrice', 'roi', 'tradesCount']) assert.equal(rows[0][field], null);
});

test('partial limit close preserves exact account, quantity and price', async () => {
  let sent;
  api.defaults.adapter = async (config) => { sent = JSON.parse(config.data); return response(config, {}); };
  await closeOpenPosition('demo-a', long, { type: 'LIMIT', quantity: '0.025', price: '61500.125' });
  assert.equal(sent.exchangeAccountId, 'demo-a');
  assert.equal(sent.type, 'LIMIT');
  assert.equal(sent.quantity, '0.025');
  assert.equal(sent.price, '61500.125');
});

test('exchange-only positions load without requesting any bot data; both hedge sides remain', async () => {
  const calls = [];
  api.defaults.adapter = async (config) => {
    calls.push(config.url);
    assert.equal(config.params.exchangeAccountId, 'demo-account');
    assert.equal(config.url, '/admin/trading/positions');
    return response(config, [long, short]);
  };
  assert.deepEqual(await getTradeProPositions('demo-account'), [long, short]);
  assert.equal(calls.length, 1);
});

test('a failed exchange read rejects instead of reporting an empty account', async () => {
  api.defaults.adapter = async () => { throw new Error('Exchange unavailable'); };
  await assert.rejects(getTradeProPositions('demo-account'), /Exchange unavailable/);
});

test('bot operation enrichment is restricted to the selected demo account', async () => {
  api.defaults.adapter = async (config) => config.url.endsWith('/bots')
    ? response(config, [
      { id: 'a', exchangeAccountId: 'account-a', mode: 'DEMO' },
      { id: 'b', exchangeAccountId: 'account-b', mode: 'DEMO' },
      { id: 'paper', exchangeAccountId: 'account-a', mode: 'PAPER' },
    ])
    : response(config, { apiVersion: 'v1', data: [{ botId: 'a' }, { botId: 'b' }, { botId: 'paper' }] });
  assert.deepEqual(await getTradeProOperations('account-a'), [{ botId: 'a' }]);
  assert.deepEqual(await getTradeProOperations('no-bots'), []);
});

test('both position screens render exchange positions even when there are no bot operations', () => {
  for (const render of [renderPositions, renderOverview]) {
    const html = render({ accountId: 'demo-account', positions: [long, short], operations: [], loading: false, onRefresh() {} });
    assert.match(html, /BTCUSDT/);
    assert.match(html, /LONG/);
    assert.match(html, /SHORT/);
    assert.doesNotMatch(html, /açık pozisyon yok|açık pozisyon bulunmuyor/);
  }
});

test('position read errors are visible and never rendered as an empty account', () => {
  for (const render of [renderPositions, renderOverview]) {
    const html = render({ accountId: 'demo-account', positions: [], operations: [], loading: false, error: 'Exchange unavailable', onRefresh() {} });
    assert.match(html, /role="alert"/);
    assert.match(html, /Exchange unavailable/);
    assert.doesNotMatch(html, /açık pozisyon yok|açık pozisyon bulunmuyor/);
  }
});

test('stale positions remain visible but all close actions are disabled after an exchange error', () => {
  const html = renderPositions({ accountId: 'demo-account', positions: [long], operations: [], loading: false, error: 'Exchange unavailable', onRefresh() {} });
  assert.match(html, /BTCUSDT/);
  assert.match(html, /güncel olmayabilir/);
  const buttons = [...html.matchAll(/<button([^>]*)>(.*?)<\/button>/gs)];
  const closeButtons = buttons.filter(([, , content]) => /Kapat/.test(content));
  assert.equal(closeButtons.length, 3);
  for (const [, attrs] of closeButtons) assert.match(attrs, / disabled=""/);
  assert.doesNotMatch(buttons.find(([, , content]) => /Yenile/.test(content))[1], / disabled=""/);
});

test('close requests target the selected account and exact hedge position with distinct idempotency keys', async () => {
  const requests = [];
  api.defaults.adapter = async (config) => { requests.push({ url: config.url, body: JSON.parse(config.data) }); return response(config, {}); };
  await closeTradeProPosition('demo-account', short);
  await closeTradeProPosition('demo-account', short);
  assert.equal(requests[0].url, `/admin/trading/positions/${encodeURIComponent(short.positionKey)}/close`);
  assert.equal(requests[0].body.exchangeAccountId, 'demo-account');
  assert.equal(requests[0].body.quantity, short.quantity);
  assert.equal(requests[0].body.type, 'MARKET');
  assert.notEqual(requests[0].body.idempotencyKey, requests[1].body.idempotencyKey);
});
