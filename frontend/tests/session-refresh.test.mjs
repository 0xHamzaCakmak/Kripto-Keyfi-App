import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
const vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, appType: 'custom', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
globalThis.window = new EventTarget();
const { api, setAccessToken, getAccessToken } = await vite.ssrLoadModule('/src/services/apiClient.ts');
const fail = (config, status) => Promise.reject(new axios.AxiosError('failed', undefined, config, undefined, status ? { status, config, data: {}, headers: {}, statusText: 'failed' } : undefined));
test('temporary refresh failure preserves token and does not expire the session', async () => {
  setAccessToken('old');
  const events = [];
  const expired = () => events.push('expired');
  const unavailable = () => events.push('unavailable');
  window.addEventListener('kriptokeyfi-session-expired', expired);
  window.addEventListener('kriptokeyfi-session-unavailable', unavailable);
  api.defaults.adapter = config => fail(config, 401);
  for (const status of [undefined, 500, 503, 429]) {
    axios.defaults.adapter = config => fail(config, status);
    await assert.rejects(api.get('/private'));
    assert.equal(getAccessToken(), 'old');
  }
  assert.deepEqual(events, ['unavailable', 'unavailable', 'unavailable', 'unavailable']);
  window.removeEventListener('kriptokeyfi-session-expired', expired);
  window.removeEventListener('kriptokeyfi-session-unavailable', unavailable);
});
test('invalid refresh credentials really expire the session', async () => {
  setAccessToken('old');
  let expired = 0;
  window.addEventListener('kriptokeyfi-session-expired', () => expired++, { once: true });
  api.defaults.adapter = config => fail(config, 401);
  axios.defaults.adapter = config => fail(config, 401);
  await assert.rejects(api.get('/private'));
  assert.equal(getAccessToken(), null);
  assert.equal(expired, 1);
});
