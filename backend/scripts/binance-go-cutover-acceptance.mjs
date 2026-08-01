import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';

if (process.env.CONFIRM_DEMO_ACCEPTANCE !== 'YES') {
  throw new Error('Set CONFIRM_DEMO_ACCEPTANCE=YES to run exchange write tests.');
}

const baseUrl = process.env.ACCEPTANCE_API_URL ?? 'http://127.0.0.1:4001/api';
const accountId = process.env.ACCEPTANCE_ACCOUNT_ID;
const symbol = process.env.ACCEPTANCE_SYMBOL ?? 'ADAUSDT';

if (!accountId) throw new Error('ACCEPTANCE_ACCOUNT_ID is required.');

let accessToken = '';
let testFailed = false;
const events = [];
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const idempotencyKey = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;

async function createLocalAcceptanceToken() {
  const prisma = new PrismaClient();
  try {
    const account = await prisma.exchangeAccount.findUnique({
      where: { id: accountId },
      select: { user: { select: { id: true, role: true, status: true } } },
    });
    if (!account || account.user.role !== 'ADMIN' || account.user.status !== 'ACTIVE') {
      throw new Error('An active admin owner is required for local acceptance auth.');
    }
    return new SignJWT({ role: account.user.role, sid: crypto.randomUUID() })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(account.user.id)
      .setIssuer('kriptokeyfi-api')
      .setAudience('kriptokeyfi-web')
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode(process.env.JWT_ACCESS_SECRET));
  } finally {
    await prisma.$disconnect();
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`${path} ${response.status}: ${JSON.stringify(body.error ?? body)}`);
  }
  return body.data;
}

const orders = () => api(`/admin/trading/orders?exchangeAccountId=${accountId}`);
const positions = () => api(`/admin/trading/positions?exchangeAccountId=${accountId}`);

async function setExecutor(executionEngine) {
  return api(`/admin/trading/exchange-accounts/${accountId}/execution-engine`, {
    method: 'POST',
    body: JSON.stringify({ executionEngine }),
  });
}

async function cancel(order) {
  return api(`/admin/trading/orders/${encodeURIComponent(order.exchangeOrderId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({
      exchangeAccountId: accountId,
      symbol: order.symbol,
      idempotencyKey: idempotencyKey('accept_cancel'),
    }),
  });
}

async function close(position) {
  return api(`/admin/trading/positions/${encodeURIComponent(position.positionKey)}/close`, {
    method: 'POST',
    body: JSON.stringify({
      exchangeAccountId: accountId,
      idempotencyKey: idempotencyKey('accept_close'),
    }),
  });
}

async function preview(input) {
  return api('/admin/trading/orders/preview', {
    method: 'POST',
    body: JSON.stringify({
      exchangeAccountId: accountId,
      leverage: 2,
      marginMode: 'ISOLATED',
      reduceOnly: false,
      ...input,
    }),
  });
}

async function submit(previewId, prefix) {
  return api('/admin/trading/orders', {
    method: 'POST',
    body: JSON.stringify({ previewId, idempotencyKey: idempotencyKey(prefix) }),
  });
}

function decimalPlaces(value) {
  return value.includes('.') ? value.split('.')[1].length : 0;
}

async function waitForPosition(expected) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(750);
    const position = (await positions()).find((item) => item.symbol === symbol);
    if (expected ? position : !position) return position;
  }
  throw new Error(expected ? 'Market position did not appear.' : 'Position remains after reduce-only close.');
}

async function cleanupSymbol() {
  for (const order of (await orders()).filter((item) => item.symbol === symbol)) {
    try {
      await cancel(order);
      events.push({ step: 'cleanup_limit_canceled', exchangeOrderId: order.exchangeOrderId });
    } catch (error) {
      events.push({ step: 'cleanup_cancel_error', message: error.message });
      testFailed = true;
    }
  }

  for (const position of (await positions()).filter((item) => item.symbol === symbol)) {
    try {
      await close(position);
      await waitForPosition(false);
      events.push({ step: 'cleanup_position_closed', positionKey: position.positionKey });
    } catch (error) {
      events.push({ step: 'cleanup_close_error', message: error.message });
      testFailed = true;
    }
  }
}

try {
  if (process.env.ACCEPTANCE_LOCAL_AUTH === 'YES') {
    accessToken = await createLocalAcceptanceToken();
  } else {
    const login = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: process.env.INITIAL_ADMIN_EMAIL,
        password: process.env.INITIAL_ADMIN_PASSWORD,
      }),
    });
    accessToken = login.accessToken;
  }

  const accounts = await api('/admin/trading/exchange-accounts');
  const account = accounts.find((item) => item.id === accountId);
  if (!account || account.provider !== 'BINANCE' || account.environment !== 'TESTNET') {
    throw new Error('The selected account is not Binance Testnet.');
  }
  if ((await orders()).some((item) => item.symbol === symbol)
    || (await positions()).some((item) => item.symbol === symbol)) {
    throw new Error(`${symbol} is not clean before the acceptance test.`);
  }

  const goAccount = await setExecutor('GO');
  if (goAccount.executionEngine !== 'GO') throw new Error('GO executor cutover was not confirmed.');
  events.push({ step: 'executor', value: 'GO' });

  const symbolRules = await api(`/admin/trading/symbols?exchangeAccountId=${accountId}`);
  const rule = symbolRules.find((item) => item.symbol === symbol);
  if (!rule) throw new Error(`Rules not found for ${symbol}.`);

  const probe = await preview({ symbol, side: 'BUY', type: 'MARKET', quantity: '100' });
  const markPrice = Number(probe.markPrice);
  const tickSize = Number(rule.tickSize);
  const stepSize = Number(rule.stepSize);
  const minNotional = Number(rule.minNotional);
  const tickDecimals = decimalPlaces(rule.tickSize);
  const stepDecimals = decimalPlaces(rule.stepSize);

  // Binance Futures rejects prices outside its dynamic percent-price band.
  // Four percent below mark stays safely off-market while remaining valid.
  const limitNumber = Math.floor((markPrice * 0.96) / tickSize) * tickSize;
  const limitPrice = limitNumber.toFixed(tickDecimals);
  const limitQuantity = (Math.ceil(((minNotional * 1.2) / limitNumber) / stepSize) * stepSize)
    .toFixed(stepDecimals);
  const limitPreview = await preview({
    symbol,
    side: 'BUY',
    type: 'LIMIT',
    quantity: limitQuantity,
    price: limitPrice,
  });
  const limitResult = await submit(limitPreview.id, 'accept_limit');
  events.push({
    step: 'limit_opened',
    symbol,
    exchangeOrderId: limitResult.exchangeOrderId,
    price: limitPrice,
    quantity: limitQuantity,
  });

  await sleep(500);
  const openLimit = (await orders())
    .find((item) => item.exchangeOrderId === limitResult.exchangeOrderId);
  if (!openLimit) throw new Error('Limit order was not visible in the open-order snapshot.');
  await cancel(openLimit);
  await sleep(500);
  if ((await orders()).some((item) => item.exchangeOrderId === limitResult.exchangeOrderId)) {
    throw new Error('Limit order remains open after cancellation.');
  }
  events.push({ step: 'limit_canceled', exchangeOrderId: limitResult.exchangeOrderId });

  const marketQuantity = (Math.ceil(((minNotional * 1.3) / markPrice) / stepSize) * stepSize)
    .toFixed(stepDecimals);
  const marketPreview = await preview({
    symbol,
    side: 'BUY',
    type: 'MARKET',
    quantity: marketQuantity,
  });
  const marketResult = await submit(marketPreview.id, 'accept_market');
  events.push({
    step: 'market_opened',
    symbol,
    exchangeOrderId: marketResult.exchangeOrderId,
    quantity: marketQuantity,
    leverage: 2,
    marginMode: 'ISOLATED',
  });

  const position = await waitForPosition(true);
  if (position.side !== 'LONG'
    || position.marginMode !== 'ISOLATED'
    || Number(position.leverage) !== 2) {
    throw new Error(`Position properties do not match the request: ${JSON.stringify(position)}`);
  }

  const closeResult = await close(position);
  events.push({
    step: 'reduce_only_close_sent',
    symbol,
    exchangeOrderId: closeResult.exchangeOrderId,
    quantity: position.quantity,
    reduceOnly: closeResult.reduceOnly,
  });
  await waitForPosition(false);

  if ((await orders()).some((item) => item.symbol === symbol)) {
    throw new Error(`An open ${symbol} order remains after the test.`);
  }
  events.push({ step: 'exchange_clean', symbol, openOrders: 0, openPositions: 0 });
} catch (error) {
  testFailed = true;
  events.push({ step: 'test_error', message: error.message });
} finally {
  if (accessToken) {
    try {
      await cleanupSymbol();
    } catch (error) {
      testFailed = true;
      events.push({ step: 'cleanup_read_error', message: error.message });
    }

    try {
      const typescriptAccount = await setExecutor('TYPESCRIPT');
      if (typescriptAccount.executionEngine !== 'TYPESCRIPT') {
        throw new Error('TYPESCRIPT executor restoration was not confirmed.');
      }
      events.push({ step: 'final_executor_verified', value: 'TYPESCRIPT' });
    } catch (error) {
      testFailed = true;
      events.push({ step: 'executor_restore_error', message: error.message });
    }
  }

  console.log(JSON.stringify(events, null, 2));
  if (testFailed) process.exitCode = 1;
}
