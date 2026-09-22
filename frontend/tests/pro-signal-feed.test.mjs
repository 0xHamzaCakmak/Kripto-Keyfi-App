import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
const vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, appType: 'custom', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true } });
after(() => vite.close());
const { SignalFeed } = await vite.ssrLoadModule('/src/features/ai-trading-pro/components/SignalFlow/SignalFeed.tsx');
const { SignalFlow } = await vite.ssrLoadModule('/src/features/ai-trading-pro/components/SignalFlow/SignalFlow.tsx');
const { applyDecisionBatch, rotateSignalWindow } = await vite.ssrLoadModule('/src/features/ai-trading-pro/components/SignalFlow/signalFlowState.ts');
const decision = { id: 'd1', botId: 'b1', botName: 'Bot', symbol: 'BTCUSDT', action: 'HOLD', confidence: 0.6, summary: 'Decision', occurredAt: '2020-01-01T00:00:00Z' };

test('last decision survives empty polls, changes only with newer evidence, and respects universe scope', async () => {
  const { retainLastArenaDecisions } = await vite.ssrLoadModule('/src/features/ai-trading-pro/services/backendDashboard.ts');
  const empty = { botSymbols: ['BTCUSDT'], recentDecisions: [], recentSignals: [] };
  const first = retainLastArenaDecisions(null, { ...empty, recentDecisions: [decision] });
  const unchanged = retainLastArenaDecisions(first, empty);
  assert.equal(unchanged.recentDecisions[0].action, 'HOLD');
  assert.equal(unchanged.recentDecisions[0].occurredAt, decision.occurredAt);
  const next = retainLastArenaDecisions(unchanged, { ...empty, recentDecisions: [{ ...decision, action: 'LONG', occurredAt: '2026-09-14T12:00:00Z' }] });
  assert.equal(next.recentDecisions[0].action, 'LONG');
  assert.equal(retainLastArenaDecisions(next, first).recentDecisions[0].action, 'LONG');
  assert.deepEqual(retainLastArenaDecisions(next, { ...empty, botSymbols: ['ETHUSDT'] }).recentDecisions, []);
  assert.deepEqual(retainLastArenaDecisions(null, empty).recentDecisions, []);
});

test('side panels fill ten unique pairs and distinguish missing signals from missing decisions', () => {
  const botSymbols = ['BTCUSDT', ...Array.from({ length: 19 }, (_, i) => `COIN${i}USDT`)];
  const html = renderToStaticMarkup(React.createElement(SignalFeed, { arena: { botSymbols, recentDecisions: [decision], recentSignals: [] }, loading: false, hasBackendAccount: true }));
  const [decisions, signals] = html.split('id="live-stream-card"');
  assert.equal((decisions.match(/Karar bekleniyor/g) ?? []).length, 9);
  assert.equal((signals.match(/Sinyal bekleniyor/g) ?? []).length, 10);
  assert.ok(!signals.includes('HOLD'));
});

test('side window replaces one pair per second and covers the whole universe', async () => {
  const { advanceFeedWindow } = await vite.ssrLoadModule('/src/features/ai-trading-pro/components/SignalFlow/feedWindow.ts');
  let order = Array.from({ length: 20 }, (_, i) => `COIN${i}`);
  const seen = new Set(order.slice(0, 10));
  for (let i = 0; i < 20; i++) {
    const old = order.slice(0, 10);
    order = advanceFeedWindow(order);
    const next = order.slice(0, 10);
    assert.equal(new Set(next).size, 10);
    assert.equal(next.filter(symbol => !old.includes(symbol)).length, 1);
    next.forEach(symbol => seen.add(symbol));
  }
  assert.equal(seen.size, 20);
});

test('both feeds keep one latest row per pair despite repeated decisions', () => {
  const rows = [{ ...decision, id: 'new', action: 'SHORT', occurredAt: '2026-09-14T12:00:00Z' }, ...Array.from({ length: 60 }, (_, i) => ({ ...decision, id: String(i) })), { ...decision, id: 'eth', symbol: 'ETHUSDT' }];
  const html = renderToStaticMarkup(React.createElement(SignalFeed, { arena: { recentDecisions: rows, recentSignals: rows }, loading: false, hasBackendAccount: true }));
  const [decisions, signals] = html.split('id="live-stream-card"');
  for (const section of [decisions, signals]) {
    assert.equal((section.match(/>BTCUSDT</g) ?? []).length, 1);
    assert.equal((section.match(/>ETHUSDT</g) ?? []).length, 1);
    assert.ok(section.includes('SHORT'));
  }
});

test('universe pool includes missing pairs without inventing decisions and updates the latest direction', async () => {
  const { buildUniversePool } = await vite.ssrLoadModule('/src/features/ai-trading-pro/components/SignalFlow/signalFlowState.ts');
  const symbols = ['BTCUSDT', ...Array.from({ length: 19 }, (_, i) => `COIN${i}USDT`)];
  const pool = buildUniversePool(symbols, [{ ...decision, action: 'SHORT', occurredAt: '2026-09-14T12:00:00Z' }, decision]);
  assert.equal(pool.length, 20);
  assert.equal(pool[0].decision, 'SHORT');
  assert.equal(pool.filter(row => row.awaitingDecision).length, 19);
  const updated = applyDecisionBatch(pool, [decision]);
  assert.equal(updated[0].decision, 'SHORT');
});
test('decisions and raw signals are separate and stale decisions are not live', () => {
  const arena = { recentDecisions: [decision], recentSignals: [{ ...decision, id: 's1', symbol: 'ETHUSDT', action: 'LONG', source: 'RULE_ENGINE', status: 'OBSERVED' }], latestDecisionAt: decision.occurredAt };
  const html = renderToStaticMarkup(React.createElement(SignalFeed, { arena, loading: false, hasBackendAccount: true }));
  const [decisions, signals] = html.split('id="live-stream-card"');
  assert.ok(decisions.includes('BTCUSDT'));
  assert.ok(!decisions.includes('ETHUSDT'));
  assert.ok(signals.includes('ETHUSDT'));
  assert.ok(!signals.includes('BTCUSDT'));
  assert.ok(decisions.includes('VERİ ESKİ'));
});
test('the flow keeps twenty real symbols and offers no synthetic signal controls', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ ...decision, id: String(i), symbol: `COIN${i}USDT` }));
  assert.equal(applyDecisionBatch([], rows).length, 20);
  const html = renderToStaticMarkup(React.createElement(SignalFlow, { accountId: 'a', arena: null, positions: [], totalBalance: 0 }));
  assert.ok(!html.includes('manual-signal-trigger-btn'));
  assert.ok(!html.includes('speed-btn'));
  assert.ok(html.includes('Gerçek motor kararı bekleniyor'));
});

test('rotation introduces one absent symbol per second, caps at nine and covers twenty within a minute', () => {
  const pool = applyDecisionBatch([], Array.from({ length: 20 }, (_, i) => ({ ...decision, id: String(i), symbol: `COIN${i}USDT` })));
  const shown = new Map();
  let visible = [];
  for (let second = 1; second <= 60; second++) {
    const next = rotateSignalWindow(visible, pool, shown, second * 1000, () => 0.73);
    assert.equal(next.length, Math.min(second, 9));
    assert.equal(new Set(next.map(c => c.symbol)).size, next.length);
    assert.equal(next.filter(c => !visible.some(v => v.symbol === c.symbol)).length, 1);
    for (const coin of next) {
      const actual = pool.find(c => c.symbol === coin.symbol);
      assert.equal(coin.decision, actual.decision);
      assert.equal(coin.confidence, actual.confidence);
      assert.equal(coin.lastUpdated, actual.lastUpdated);
    }
    visible = next;
    if (second === 20) assert.equal(shown.size, 20);
  }
});

test('a small pool stays unique and refreshes actual decisions without inventing additional coins', () => {
  const shown = new Map();
  const pool = applyDecisionBatch([], [decision]);
  const first = rotateSignalWindow([], pool, shown, 1000);
  const updated = applyDecisionBatch(pool, [{ ...decision, action: 'SHORT', confidence: 0.8 }]);
  const next = rotateSignalWindow(first, updated, shown, 2000);
  assert.equal(next.length, 1);
  assert.equal(next[0].decision, 'SHORT');
  assert.equal(next[0].confidence, 80);
  assert.deepEqual(rotateSignalWindow(next, [], shown, 3000), []);
});
