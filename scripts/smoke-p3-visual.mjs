import { randomInt } from 'node:crypto';
import { createServer } from 'node:http';

const API_URL = process.env.HOCKPAY_API_URL ?? 'http://localhost:3000/api/v1';
const WEB_URL = process.env.HOCKPAY_WEB_URL ?? 'http://localhost:4200';
const WEBHOOK_PORT = Number(process.env.HOCKPAY_SMOKE_WEBHOOK_PORT ?? 3999);
const TIMEOUT_MS = Number(process.env.HOCKPAY_SMOKE_TIMEOUT_MS ?? 30000);
const POLL_INTERVAL_MS = 500;
const PASSWORD = '12345678';
const runId = `${Date.now()}-${randomInt(1000, 9999)}`;

const state = {
  merchantId: undefined,
  merchantEmail: `p3-visual-${runId}@hockpay.local`,
  merchantPassword: PASSWORD,
  storeId: undefined,
  apiKeyPrefix: undefined,
  webhookId: undefined,
  webhookLogIds: [],
  payments: {},
};

const deliveries = [];
const cookieJar = new Map();
let receiver;

class SmokeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SmokeError';
  }
}

function step(message) {
  console.log(`[smoke:p3:visual] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new SmokeError(message);
  }
}

function apiPath(path) {
  return `${API_URL.replace(/\/$/, '')}${path}`;
}

function webPath(path) {
  return `${WEB_URL.replace(/\/$/, '')}${path}`;
}

async function requestJson(path, options = {}) {
  const {
    jwtCookie = false,
    body,
    headers: optionHeaders,
    ...fetchOptions
  } = options;
  const headers = {
    Accept: 'application/json',
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(jwtCookie ? buildCookieHeader() : {}),
    ...optionHeaders,
  };

  let response;
  try {
    response = await fetch(apiPath(path), {
      ...fetchOptions,
      body,
      headers,
    });
  } catch (error) {
    throw new SmokeError(
      `Could not reach ${apiPath(path)}. Confirm that the API is running. ${formatError(error)}`,
    );
  }

  captureCookies(response.headers);
  const text = await response.text();
  const responseBody = text ? parseJson(text, `${fetchOptions.method ?? 'GET'} ${path}`) : undefined;

  if (!response.ok) {
    const authHint =
      jwtCookie && response.status === 401
        ? ' JWT-protected dashboard endpoints require a valid hockpay_at cookie.'
        : '';
    throw new SmokeError(
      `${fetchOptions.method ?? 'GET'} ${path} failed with ${response.status}: ${
        text || 'empty response'
      }.${authHint}`,
    );
  }

  return responseBody;
}

function buildCookieHeader() {
  const cookie = [...cookieJar.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
  return cookie ? { Cookie: cookie } : {};
}

function captureCookies(headers) {
  for (const setCookie of getSetCookieHeaders(headers)) {
    const [cookiePair] = setCookie.split(';');
    const separatorIndex = cookiePair.indexOf('=');
    if (separatorIndex <= 0) continue;

    const name = cookiePair.slice(0, separatorIndex).trim();
    const value = cookiePair.slice(separatorIndex + 1).trim();
    if (value) {
      cookieJar.set(name, value);
    } else {
      cookieJar.delete(name);
    }
  }
}

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }

  if (typeof headers.raw === 'function') {
    return headers.raw()['set-cookie'] ?? [];
  }

  const combined = headers.get('set-cookie');
  return combined ? splitSetCookieHeader(combined) : [];
}

function splitSetCookieHeader(header) {
  const cookies = [];
  let start = 0;
  let inExpires = false;

  for (let index = 0; index < header.length; index += 1) {
    const char = header[index];
    const lowerTail = header.slice(index, index + 8).toLowerCase();

    if (lowerTail === 'expires=') {
      inExpires = true;
      index += 7;
      continue;
    }

    if (inExpires && char === ';') {
      inExpires = false;
      continue;
    }

    if (!inExpires && char === ',') {
      const next = header.slice(index + 1);
      if (/^\s*[^=;,\s]+=/.test(next)) {
        cookies.push(header.slice(start, index).trim());
        start = index + 1;
      }
    }
  }

  cookies.push(header.slice(start).trim());
  return cookies.filter(Boolean);
}

function setAuthCookiesFromBody(body) {
  if (body?.accessToken) {
    cookieJar.set('hockpay_at', body.accessToken);
  }
  if (body?.refreshToken) {
    cookieJar.set('hockpay_rt', body.refreshToken);
  }
}

function parseJson(text, context) {
  try {
    return JSON.parse(text);
  } catch {
    throw new SmokeError(`${context} returned non-JSON content: ${text.slice(0, 200)}`);
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntil(label, read, isReady) {
  const deadline = Date.now() + TIMEOUT_MS;
  let lastValue;

  while (Date.now() < deadline) {
    lastValue = await read();
    if (isReady(lastValue)) {
      return lastValue;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  throw new SmokeError(
    `${label} was not observed within ${TIMEOUT_MS}ms. Last value: ${JSON.stringify(lastValue)}`,
  );
}

function buildCpf(seed) {
  const base = String(seed).replace(/\D/g, '').padStart(9, '0').slice(-9);
  const digits = base.split('').map(Number);
  const digit1 = calculateCpfDigit(digits, 10);
  const digit2 = calculateCpfDigit([...digits, digit1], 11);
  return `${base}${digit1}${digit2}`;
}

function calculateCpfDigit(digits, startWeight) {
  const sum = digits.reduce(
    (total, digit, index) => total + digit * (startWeight - index),
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

async function startWebhookReceiver() {
  receiver = createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/webhook') {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'not_found' }));
      return;
    }

    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }

    const rawBody = Buffer.concat(chunks).toString('utf8');
    deliveries.push({
      headers: request.headers,
      body: rawBody ? parseJson(rawBody, 'Webhook receiver') : undefined,
    });

    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ received: true }));
  });

  await new Promise((resolve, reject) => {
    receiver.once('error', (error) => {
      reject(
        new SmokeError(
          `Could not start the local webhook receiver on port ${WEBHOOK_PORT}. ${formatError(error)}`,
        ),
      );
    });
    receiver.listen(WEBHOOK_PORT, '127.0.0.1', resolve);
  });
}

async function stopWebhookReceiver() {
  if (!receiver?.listening) return;
  await new Promise((resolve, reject) => {
    receiver.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function createMerchantAndStore() {
  const merchantDocument = buildCpf(`${Date.now()}${randomInt(1000, 9999)}`);

  const merchant = await requestJson('/merchants', {
    method: 'POST',
    body: JSON.stringify({
      name: `P3 Visual Merchant ${runId}`,
      email: state.merchantEmail,
      password: PASSWORD,
      document: merchantDocument,
    }),
  });
  state.merchantId = merchant?.id;
  assert(state.merchantId, 'Merchant creation did not return an id.');

  const login = await requestJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: state.merchantEmail,
      password: PASSWORD,
    }),
  });
  assert(login?.accessToken, 'Login did not return an access token.');
  setAuthCookiesFromBody(login);

  const storeResult = await requestJson('/stores', {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({
      name: `P3 Visual Store ${runId}`,
      slug: `p3-visual-${runId}`.replace(/[^a-z0-9-]/g, '-').slice(0, 50),
    }),
  });
  state.storeId = storeResult?.store?.id;
  assert(state.storeId, 'Store creation did not return a store id.');
  setAuthCookiesFromBody(storeResult);

  const account = await requestJson('/accounts/me', { jwtCookie: true });
  assert(account?.account?.storeId === state.storeId, 'Account lookup did not match the created store.');
}

async function createApiKeyAndWebhook() {
  const apiKey = await requestJson('/api-keys', {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({
      name: `P3 Visual API Key ${runId}`,
      environment: 'TEST',
    }),
  });
  assert(apiKey?.plainKey, 'API key creation did not return plainKey.');
  state.apiKeyPrefix = apiKey.prefix;

  const webhook = await requestJson('/webhooks', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.plainKey}`,
    },
    body: JSON.stringify({
      url: `http://127.0.0.1:${WEBHOOK_PORT}/webhook`,
      events: [
        'payment.created',
        'payment.confirmed',
        'payment.failed',
        'payment.expired',
        'payment.released',
      ],
    }),
  });
  state.webhookId = webhook?.id;
  assert(state.webhookId, 'Webhook creation did not return an id.');

  return apiKey.plainKey;
}

async function createPayment(apiKey, scenario, amount, overrides = {}) {
  const customerDocument = buildCpf(`${Date.now()}${randomInt(1000, 9999)}`);
  const externalId = `p3-${scenario.toLowerCase()}-${runId}`;

  const paymentResult = await requestJson('/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Idempotency-Key': externalId,
      'X-Request-ID': externalId,
    },
    body: JSON.stringify({
      externalId,
      amount,
      description: `P3 visual - ${scenario}`,
      customer: {
        name: `P3 ${scenario} Customer`,
        email: `customer-${scenario.toLowerCase()}-${runId}@hockpay.local`,
        document: customerDocument,
      },
      metadata: {
        smokeRunId: runId,
        scenario,
      },
      ...overrides,
    }),
  });

  const payment = paymentResult?.payment;
  assert(payment?.id, `${scenario} payment creation did not return a payment id.`);
  return payment.id;
}

async function simulate(apiKey, paymentId, action, query = '') {
  const result = await requestJson(`/dev/simulate/${paymentId}/${action}${query}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  return result?.payment;
}

async function createRefund(apiKey, paymentId, amount, scenario) {
  const result = await requestJson('/refunds', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Idempotency-Key': `p3-refund-${scenario.toLowerCase()}-${runId}`,
      'X-Request-ID': `p3-refund-${scenario.toLowerCase()}-${runId}`,
    },
    body: JSON.stringify({
      paymentId,
      amount,
      reason: `P3 visual ${scenario} refund`,
    }),
  });

  assert(result?.refund?.id, `${scenario} refund did not return an id.`);
  return result;
}

async function loadTimeline(paymentId) {
  return requestJson(`/payments/${paymentId}/timeline`, {
    jwtCookie: true,
  });
}

async function assertTimelineStatus(scenario, paymentId, expectedStatus) {
  const timeline = await loadTimeline(paymentId);
  const status = timeline?.payment?.status;
  assert(
    status === expectedStatus,
    `${scenario} expected status ${expectedStatus}, got ${status ?? 'missing'}`,
  );
  state.payments[scenario] = {
    id: paymentId,
    status,
    detailUrl: webPath(`/dashboard/payments/${paymentId}`),
  };
  return timeline;
}

async function waitForWebhookLogs(expectedEvents) {
  const logsResult = await pollUntil(
    'Expected webhook logs',
    () =>
      requestJson(`/webhooks/${state.webhookId}/logs?status=delivered&limit=100`, {
        jwtCookie: true,
      }),
    (result) => {
      const logs = result?.logs ?? [];
      return expectedEvents.every(({ paymentId, eventType }) =>
        logs.some((log) => log.paymentId === paymentId && log.eventType === eventType),
      );
    },
  );

  const logs = logsResult.logs ?? [];
  state.webhookLogIds = expectedEvents
    .map(({ paymentId, eventType }) =>
      logs.find((log) => log.paymentId === paymentId && log.eventType === eventType)?.id,
    )
    .filter(Boolean);
}

function printSummary() {
  const scenarios = Object.entries(state.payments).map(([scenario, payment]) => ({
    scenario,
    status: payment.status,
    paymentId: payment.id,
    detailUrl: payment.detailUrl,
  }));

  console.log('');
  console.log('[smoke:p3:visual] Dashboard login');
  console.log(`email: ${state.merchantEmail}`);
  console.log(`password: ${state.merchantPassword}`);
  console.log('');
  console.table(scenarios);
  console.log('');
  console.log(
    JSON.stringify(
      {
        ok: true,
        apiUrl: API_URL,
        webUrl: WEB_URL,
        loginUrl: webPath('/login'),
        financialsUrl: webPath('/dashboard/financials'),
        webhooksUrl: webPath('/dashboard/webhooks'),
        webhookReceiverUrl: `http://127.0.0.1:${WEBHOOK_PORT}/webhook`,
        deliveriesCaptured: deliveries.length,
        ...state,
      },
      null,
      2,
    ),
  );
}

async function run() {
  step(`Using API ${API_URL}`);
  step(`Using web ${WEB_URL}`);
  await startWebhookReceiver();
  step(`Local webhook receiver listening on http://127.0.0.1:${WEBHOOK_PORT}/webhook`);

  step('Checking API liveness and readiness');
  const live = await requestJson('/health/live');
  const ready = await requestJson('/health/ready');
  assert(live?.status === 'ok', 'Health live endpoint did not return status=ok.');
  assert(ready?.status === 'ok', 'Health ready endpoint did not return status=ok.');

  step('Creating merchant, store, API key and webhook');
  await createMerchantAndStore();
  const apiKey = await createApiKeyAndWebhook();

  const expectedWebhookEvents = [];

  step('Creating PENDING scenario');
  const pendingId = await createPayment(apiKey, 'PENDING', 1100);
  await assertTimelineStatus('PENDING', pendingId, 'PENDING');
  expectedWebhookEvents.push({ paymentId: pendingId, eventType: 'payment.created' });

  step('Creating CONFIRMED scenario');
  const confirmedId = await createPayment(apiKey, 'CONFIRMED', 1500);
  await simulate(apiKey, confirmedId, 'confirm');
  await assertTimelineStatus('CONFIRMED', confirmedId, 'CONFIRMED');
  expectedWebhookEvents.push(
    { paymentId: confirmedId, eventType: 'payment.created' },
    { paymentId: confirmedId, eventType: 'payment.confirmed' },
  );

  step('Creating FAILED scenario');
  const failedId = await createPayment(apiKey, 'FAILED', 1200);
  await simulate(apiKey, failedId, 'fail', '?reason=p3_visual_failure');
  await assertTimelineStatus('FAILED', failedId, 'FAILED');
  expectedWebhookEvents.push(
    { paymentId: failedId, eventType: 'payment.created' },
    { paymentId: failedId, eventType: 'payment.failed' },
  );

  step('Creating EXPIRED scenario');
  const expiredId = await createPayment(apiKey, 'EXPIRED', 1300);
  await simulate(apiKey, expiredId, 'expire');
  await assertTimelineStatus('EXPIRED', expiredId, 'EXPIRED');
  expectedWebhookEvents.push(
    { paymentId: expiredId, eventType: 'payment.created' },
    { paymentId: expiredId, eventType: 'payment.expired' },
  );

  step('Creating REFUNDED scenario');
  const refundedId = await createPayment(apiKey, 'REFUNDED', 1700);
  await simulate(apiKey, refundedId, 'confirm');
  await createRefund(apiKey, refundedId, 1700, 'REFUNDED');
  await assertTimelineStatus('REFUNDED', refundedId, 'REFUNDED');
  expectedWebhookEvents.push(
    { paymentId: refundedId, eventType: 'payment.created' },
    { paymentId: refundedId, eventType: 'payment.confirmed' },
  );

  step('Creating RELEASED scenario');
  const releasedId = await createPayment(apiKey, 'RELEASED', 1900);
  await simulate(apiKey, releasedId, 'confirm');
  await simulate(apiKey, releasedId, 'release');
  await assertTimelineStatus('RELEASED', releasedId, 'RELEASED');
  expectedWebhookEvents.push(
    { paymentId: releasedId, eventType: 'payment.created' },
    { paymentId: releasedId, eventType: 'payment.confirmed' },
    { paymentId: releasedId, eventType: 'payment.released' },
  );

  step('Waiting for worker delivery and persisted webhook logs');
  await waitForWebhookLogs(expectedWebhookEvents);

  step('Checking account and ledger endpoints');
  const account = await requestJson('/accounts/me', { jwtCookie: true });
  assert(account?.account?.storeId === state.storeId, 'Final account lookup did not match the created store.');
  const transactions = await requestJson('/transactions?limit=100', { jwtCookie: true });
  assert((transactions?.data ?? []).length >= 4, 'Expected financial ledger entries were not found.');

  step('Smoke flow completed');
  printSummary();
}

try {
  await run();
} catch (error) {
  console.error(`[smoke:p3:visual] FAILED: ${formatError(error)}`);
  process.exitCode = 1;
} finally {
  await stopWebhookReceiver().catch((error) => {
    console.error(`[smoke:p3:visual] Failed to close webhook receiver: ${formatError(error)}`);
    process.exitCode = 1;
  });
}
