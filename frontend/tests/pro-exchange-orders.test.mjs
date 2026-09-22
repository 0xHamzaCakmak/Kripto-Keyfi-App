import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, appType: 'custom', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } });
after(() => vite.close());
const service = await vite.ssrLoadModule('/src/features/ai-trading-pro/services/exchangeOrders.ts');
const { api } = await vite.ssrLoadModule('/src/services/apiClient.ts');
const { canCancelProOrder } = await vite.ssrLoadModule('/src/features/ai-trading-pro/components/Dashboard/OrdersFullView.tsx');
test('Pro order reads, cancels and edits carry the selected account on dedicated routes', async () => {
  const calls = [];
  api.defaults.adapter = async config => { calls.push(config); return { config, data: { data: { rows: [] } }, status: 200, statusText: 'OK', headers: {} }; };
  const row = { exchangeOrderId: '123', symbol: 'BTCUSDT' };
  await service.getExchangeOrders('account-b');
  await service.cancelExchangeOrder('account-b', row);
  await service.editExchangeOrder('account-b', row, '65000');
  assert.equal(calls[0].url, '/admin/trading/exchange-orders');
  assert.equal(calls[0].params.exchangeAccountId, 'account-b');
  assert.equal(calls[1].url, '/admin/trading/exchange-orders/123/cancel');
  assert.equal(calls[2].url, '/admin/trading/exchange-orders/123/edit');
  assert.deepEqual(JSON.parse(calls[2].data), { exchangeAccountId: 'account-b', symbol: 'BTCUSDT', value: '65000' });
});
test('pending, terminal and unsupported orders cannot be canceled', () => {
  const row = { exchangeOrderId: '123', status: 'OPEN' };
  assert.equal(canCancelProOrder(row), true);
  for (const status of ['CANCELING', 'FILLED', 'FAILED', 'RECONCILIATION_REQUIRED']) assert.equal(canCancelProOrder({ ...row, status }), false);
  assert.equal(canCancelProOrder({ ...row, canCancel: false }), false);
  assert.equal(canCancelProOrder({ ...row, pending: true }), false);
});
