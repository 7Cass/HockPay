import { randomBytes, randomInt } from 'node:crypto';
import { createServer } from 'node:http';

const API_URL = process.env.HOCKPAY_API_URL ?? 'http://localhost:3000/api/v1';
const WEBHOOK_PORT = readEnvInt('HOCKPAY_SMOKE_WEBHOOK_PORT', 3999, 1);
const TIMEOUT_MS = readEnvInt('HOCKPAY_SMOKE_TIMEOUT_MS', 60000, 1000);
const CUSTOMER_COUNT = Math.max(readEnvInt('HOCKPAY_SMOKE_CUSTOMERS', 50, 1), 4);
const PAYMENT_COUNT = Math.max(readEnvInt('HOCKPAY_SMOKE_PAYMENTS', 200, 1), 12);
const PAYMENT_LINK_COUNT = Math.max(readEnvInt('HOCKPAY_SMOKE_PAYMENT_LINKS', 30, 1), 4);
const CONCURRENCY = readEnvInt('HOCKPAY_SMOKE_CONCURRENCY', 8, 1);
const POLL_INTERVAL_MS = 750;
const PASSWORD = randomPassword();
const DASHBOARD_URL = process.env.HOCKPAY_DASHBOARD_URL ?? 'http://localhost:4200';
const CHECKOUT_URL = process.env.HOCKPAY_CHECKOUT_URL ?? 'http://localhost:3333';
const DISCORD_WEBHOOK_URL = process.env.HOCKPAY_SMOKE_DISCORD_WEBHOOK_URL;
const runId = `${Date.now()}-${randomInt(1000, 9999)}`;

function randomPassword() {
  return randomBytes(18).toString('base64url');
}

const WEBHOOK_EVENTS = [
  'payment.created',
  'payment.confirmed',
  'payment.failed',
  'payment.expired',
  'payment.released',
  'payment.refunded',
];

const state = {
  merchantId: undefined,
  merchantEmail: `system-smoke-${runId}@hockpay.local`,
  merchantPassword: PASSWORD,
  merchantDocument: undefined,
  storeId: undefined,
  apiKeyPrefix: undefined,
  webhookId: undefined,
  alertId: undefined,
  bankAccountId: undefined,
  withdrawalId: undefined,
};

const expected = {
  account: {
    available: 0,
    pending: 0,
    blocked: 0,
  },
  transactions: {
    PAYMENT_RECEIVED: 0,
    PAYMENT_RELEASED: 0,
    REFUND_DEDUCTED: 0,
    WITHDRAWAL_RESERVED: 0,
  },
  receipts: 0,
  webhooks: Object.fromEntries(WEBHOOK_EVENTS.map((event) => [event, 0])),
};

const summary = {
  directPayments: {},
  checkoutPayments: {},
  paymentLinkPayments: {},
  paymentLinks: {
    paid: 0,
    failedOpen: 0,
    open: 0,
    canceled: 0,
  },
};

const cookieJar = new Map();
const deliveries = [];
const explicitCustomers = [];
const directPayments = [];
const checkoutPayments = [];
const paymentLinkPayments = [];
let receiver;
let currentStage = 'initializing';
let lastHttp;

class SmokeError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'SmokeError';
    this.details = details;
  }
}

function readEnvInt(name, fallback, minimum) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new SmokeError(`${name} must be an integer >= ${minimum}. Received: ${raw}`);
  }

  return parsed;
}

function step(message) {
  currentStage = message;
  console.log(`[smoke:system] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new SmokeError(message, {
      stage: currentStage,
      lastHttp,
    });
  }
}

function apiPath(path) {
  return `${API_URL.replace(/\/$/, '')}${path}`;
}

async function requestJson(path, options = {}) {
  const {
    jwtCookie = false,
    body,
    headers: optionHeaders,
    timeoutMs = TIMEOUT_MS,
    ...fetchOptions
  } = options;
  const method = fetchOptions.method ?? 'GET';
  const headers = {
    Accept: 'application/json',
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(jwtCookie ? buildCookieHeader() : {}),
    ...optionHeaders,
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  lastHttp = {
    stage: currentStage,
    method,
    path,
    requestBody: body ? parseMaybeJson(body) : undefined,
  };

  let response;
  try {
    response = await fetch(apiPath(path), {
      ...fetchOptions,
      body,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    throw new SmokeError(
      `Could not reach ${method} ${apiPath(path)} during "${currentStage}". Confirm that the API is running. ${formatError(error)}`,
      { stage: currentStage, lastHttp },
    );
  } finally {
    clearTimeout(timeout);
  }

  captureCookies(response.headers);
  const text = await response.text();
  const responseBody = text ? parseJson(text, `${method} ${path}`) : undefined;

  lastHttp = {
    ...lastHttp,
    status: response.status,
    responseBody,
  };

  if (!response.ok) {
    const authHint =
      jwtCookie && response.status === 401
        ? ' JWT-protected dashboard endpoints require a valid hockpay_at cookie; check login/store cookie handling.'
        : '';
    throw new SmokeError(
      `${method} ${path} failed with ${response.status} during "${currentStage}": ${text || 'empty response'}.${authHint}`,
      { stage: currentStage, lastHttp },
    );
  }

  return responseBody;
}

function parseMaybeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
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
    if (value) cookieJar.set(name, value);
    else cookieJar.delete(name);
  }
}

function getSetCookieHeaders(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  if (typeof headers.raw === 'function') return headers.raw()['set-cookie'] ?? [];

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
  if (body?.accessToken) cookieJar.set('hockpay_at', body.accessToken);
  if (body?.refreshToken) cookieJar.set('hockpay_rt', body.refreshToken);
}

function parseJson(text, context) {
  try {
    return JSON.parse(text);
  } catch {
    throw new SmokeError(`${context} returned non-JSON content: ${text.slice(0, 200)}`, {
      stage: currentStage,
      lastHttp,
    });
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
    `${label} was not observed within ${TIMEOUT_MS}ms. Last value: ${JSON.stringify(lastValue)?.slice(0, 2000)}`,
    { stage: currentStage, lastHttp },
  );
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => runWorker()),
  );
  return results;
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

function idSeed(offset) {
  return `${Date.now()}${runId}${offset}${randomInt(1000, 9999)}`;
}

function classifyPayment(index) {
  if (index === 0) return 'refunded_full';
  if (index === 1) return 'refunded_partial';
  if (index === 2) return 'released';
  if (index === 3) return 'failed';
  if (index === 4) return 'expired';
  if (index === 5) return 'pending';

  switch (index % 10) {
    case 0:
      return 'refunded_full';
    case 1:
      return 'refunded_partial';
    case 2:
    case 3:
      return 'released';
    case 4:
    case 5:
      return 'confirmed';
    case 6:
      return 'failed';
    case 7:
      return 'expired';
    default:
      return 'pending';
  }
}

function finalStatusForScenario(scenario) {
  if (scenario === 'released') return 'RELEASED';
  if (scenario === 'failed') return 'FAILED';
  if (scenario === 'expired') return 'EXPIRED';
  if (scenario === 'pending') return 'PENDING';
  if (scenario === 'refunded_full') return 'REFUNDED';
  return 'CONFIRMED';
}

function incrementCount(target, key, by = 1) {
  target[key] = (target[key] ?? 0) + by;
}

function expectWebhook(eventType, by = 1) {
  incrementCount(expected.webhooks, eventType, by);
}

function apiKeyHeaders(apiKey, extra = {}) {
  return {
    Authorization: `Bearer ${apiKey}`,
    ...extra,
  };
}

function customerPayload(index, source, existingCustomer) {
  if (existingCustomer) {
    return {
      name: existingCustomer.name,
      email: existingCustomer.email,
      document: existingCustomer.document,
      phone: existingCustomer.phone,
      city: existingCustomer.city,
      state: existingCustomer.state,
      country: existingCustomer.country,
    };
  }

  return {
    name: `System Smoke ${source} Customer ${index}`,
    email: `system-smoke-${source}-${index}-${runId}@hockpay.local`,
    document: buildCpf(idSeed(10_000 + index)),
    phone: `119${String(10000000 + index).slice(0, 8)}`,
    street: 'Rua Smoke',
    number: String(100 + index),
    city: 'Sao Paulo',
    state: 'SP',
    zipCode: '01001000',
    country: 'BR',
  };
}

function checkoutCustomerPayload(index, existingCustomer) {
  if (existingCustomer) {
    return {
      document: existingCustomer.document,
      name: existingCustomer.name,
      email: existingCustomer.email,
    };
  }

  return {
    document: buildCpf(idSeed(20_000 + index)),
    name: `System Smoke checkout Customer ${index}`,
    email: `system-smoke-checkout-${index}-${runId}@hockpay.local`,
  };
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
          `Could not start local webhook receiver on port ${WEBHOOK_PORT}. ${formatError(error)}`,
          { stage: currentStage, lastHttp },
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
      if (error) reject(error);
      else resolve();
    });
  });
}

async function collectPaginated(path, listKey, limit = 100, maxPages = 20, requestOptions = {}) {
  const records = [];
  let total = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const separator = path.includes('?') ? '&' : '?';
    const result = await requestJson(`${path}${separator}page=${page}&limit=${limit}`, requestOptions);
    const pageRecords = result?.[listKey] ?? [];
    records.push(...pageRecords);
    total = result?.total ?? records.length;

    if (records.length >= total || pageRecords.length === 0) {
      return { records, total, raw: result };
    }
  }

  return { records, total, raw: undefined };
}

async function createMerchantStore() {
  state.merchantDocument = buildCpf(idSeed(1));
  const merchant = await requestJson('/merchants', {
    method: 'POST',
    body: JSON.stringify({
      name: `System Smoke Merchant ${runId}`,
      email: state.merchantEmail,
      password: PASSWORD,
      document: state.merchantDocument,
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
      name: `System Smoke Store ${runId}`,
      slug: `system-smoke-${runId}`.replace(/[^a-z0-9-]/g, '-').slice(0, 50),
    }),
  });
  state.storeId = storeResult?.store?.id;
  assert(state.storeId, 'Store creation did not return a store id.');
  setAuthCookiesFromBody(storeResult);

  const account = await requestJson('/accounts/me', { jwtCookie: true });
  assert(account?.account?.storeId === state.storeId, 'Account lookup did not match the created store.');
}

async function configureDashboardSurface() {
  const apiKey = await requestJson('/api-keys', {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({
      name: `System Smoke TEST ${runId}`,
      environment: 'TEST',
    }),
  });
  assert(apiKey?.plainKey, 'API key creation did not return plainKey.');
  state.apiKeyPrefix = apiKey.prefix;

  const bankAccount = await requestJson('/bank-accounts', {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({
      pixKey: state.merchantDocument,
      pixKeyType: 'CPF',
      holderName: `System Smoke Merchant ${runId}`,
      holderDocument: state.merchantDocument,
      isDefault: true,
    }),
  });
  state.bankAccountId = bankAccount?.id;
  assert(state.bankAccountId, 'Bank account creation did not return an id.');

  const webhook = await requestJson('/webhooks', {
    method: 'POST',
    headers: apiKeyHeaders(apiKey.plainKey),
    body: JSON.stringify({
      url: `http://127.0.0.1:${WEBHOOK_PORT}/webhook`,
      events: WEBHOOK_EVENTS,
    }),
  });
  state.webhookId = webhook?.id;
  assert(state.webhookId, 'Webhook creation did not return an id.');

  const alert = await requestJson('/alerts', {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({
      name: `System Smoke Alert ${runId}`,
      channel: 'discord',
      discord: {
        webhookUrl: DISCORD_WEBHOOK_URL ?? 'https://discord.com/api/webhooks/smoke-system-volume/fake',
      },
      events: WEBHOOK_EVENTS,
      isActive: Boolean(DISCORD_WEBHOOK_URL),
    }),
  });
  state.alertId = alert?.alert?.id;
  assert(state.alertId, 'Alert creation did not return an id.');

  const updatedAlert = await requestJson(`/alerts/${state.alertId}`, {
    method: 'PATCH',
    jwtCookie: true,
    body: JSON.stringify({
      isActive: Boolean(DISCORD_WEBHOOK_URL),
    }),
  });
  assert(updatedAlert?.alert?.id === state.alertId, 'Alert update returned an unexpected alert.');

  if (DISCORD_WEBHOOK_URL) {
    const alertTest = await requestJson(`/alerts/${state.alertId}/test`, {
      method: 'POST',
      jwtCookie: true,
      timeoutMs: Math.max(TIMEOUT_MS, 15000),
    });
    assert(alertTest?.log?.id, 'Real Discord alert test did not create a delivery log.');
  }

  return apiKey.plainKey;
}

async function createExplicitCustomers(apiKey) {
  const indexes = Array.from({ length: CUSTOMER_COUNT }, (_, index) => index);
  const customers = await mapLimit(indexes, CONCURRENCY, async (index) => {
    const payload = {
      externalId: `system-${runId}-customer-${index}`,
      name: `System Smoke Customer ${index} ${runId}`,
      email: `system-customer-${index}-${runId}@hockpay.local`,
      document: buildCpf(idSeed(1000 + index)),
      phone: `119${String(20000000 + index).slice(0, 8)}`,
      street: 'Rua Smoke',
      number: String(1000 + index),
      city: 'Sao Paulo',
      state: 'SP',
      zipCode: '01001000',
      country: 'BR',
      metadata: {
        smokeRunId: runId,
        source: 'explicit_customer',
      },
    };

    const result = await requestJson('/customers?update_existing=true', {
      method: 'POST',
      headers: apiKeyHeaders(apiKey),
      body: JSON.stringify(payload),
    });
    assert(result?.customer?.id, `Customer ${index} creation did not return an id.`);

    return result.customer;
  });

  explicitCustomers.push(...customers);
}

async function createDirectPayments(apiKey) {
  const indexes = Array.from({ length: PAYMENT_COUNT }, (_, index) => index);
  const payments = await mapLimit(indexes, CONCURRENCY, async (index) => {
    const scenario = classifyPayment(index);
    const explicitCustomer =
      index % 3 === 0 ? explicitCustomers[index % explicitCustomers.length] : undefined;
    const payload = {
      externalId: `system-${runId}-payment-${index}`,
      amount: 1200 + ((index * 137) % 20000),
      description: `System volume direct ${scenario} ${index}`,
      customer: customerPayload(index, 'direct', explicitCustomer),
      metadata: {
        smokeRunId: runId,
        source: 'direct_api_key',
        scenario,
        index,
      },
    };

    const idempotencyKey = `system-${runId}-payment-${index}`;
    const created = await requestJson('/payments', {
      method: 'POST',
      headers: apiKeyHeaders(apiKey, { 'Idempotency-Key': idempotencyKey }),
      body: JSON.stringify(payload),
    });
    assert(created?.payment?.id, `Payment ${index} creation did not return an id.`);
    expectWebhook('payment.created');

    if (index === 0) {
      const replay = await requestJson('/payments', {
        method: 'POST',
        headers: apiKeyHeaders(apiKey, { 'Idempotency-Key': idempotencyKey }),
        body: JSON.stringify(payload),
      });
      assert(
        replay?.payment?.id === created.payment.id,
        'Payment idempotency replay returned a different payment id.',
      );
    }

    return {
      ...created.payment,
      scenario,
      source: 'direct',
      finalStatus: finalStatusForScenario(scenario),
      refundIds: [],
    };
  });

  directPayments.push(...payments);
}

async function applyDirectPaymentScenarios(apiKey) {
  const toConfirm = directPayments.filter((payment) =>
    ['confirmed', 'released', 'refunded_full', 'refunded_partial'].includes(payment.scenario),
  );
  await mapLimit(toConfirm, 1, async (payment) => {
    const result = await requestJson(`/dev/simulate/${payment.id}/confirm`, {
      method: 'POST',
      headers: apiKeyHeaders(apiKey),
    });
    assert(result?.payment?.status === 'CONFIRMED', `Payment ${payment.id} did not confirm.`);
    expectWebhook('payment.confirmed');
    expected.account.pending += payment.netAmount;
    expected.transactions.PAYMENT_RECEIVED += 1;
    expected.receipts += 1;
  });

  const toFail = directPayments.filter((payment) => payment.scenario === 'failed');
  await mapLimit(toFail, CONCURRENCY, async (payment) => {
    const result = await requestJson(
      `/dev/simulate/${payment.id}/fail?reason=${encodeURIComponent('system volume simulated failure')}`,
      {
        method: 'POST',
        headers: apiKeyHeaders(apiKey),
      },
    );
    assert(result?.payment?.status === 'FAILED', `Payment ${payment.id} did not fail.`);
    expectWebhook('payment.failed');
  });

  const toExpire = directPayments.filter((payment) => payment.scenario === 'expired');
  await mapLimit(toExpire, CONCURRENCY, async (payment) => {
    const result = await requestJson(`/dev/simulate/${payment.id}/expire`, {
      method: 'POST',
      headers: apiKeyHeaders(apiKey),
    });
    assert(result?.payment?.status === 'EXPIRED', `Payment ${payment.id} did not expire.`);
    expectWebhook('payment.expired');
  });

  const toRefund = directPayments.filter((payment) =>
    ['refunded_full', 'refunded_partial'].includes(payment.scenario),
  );
  await mapLimit(toRefund, 1, async (payment, index) => {
    const refundAmount =
      payment.scenario === 'refunded_full' ? payment.amount : Math.max(1, Math.floor(payment.amount / 2));
    const idempotencyKey = `system-${runId}-refund-${payment.id}`;
    const result = await requestJson('/refunds', {
      method: 'POST',
      headers: apiKeyHeaders(apiKey, { 'Idempotency-Key': idempotencyKey }),
      body: JSON.stringify({
        paymentId: payment.id,
        amount: refundAmount,
        reason: `system volume ${payment.scenario}`,
      }),
    });
    assert(result?.refund?.id, `Refund for payment ${payment.id} did not return an id.`);

    if (index === 0) {
      const replay = await requestJson('/refunds', {
        method: 'POST',
        headers: apiKeyHeaders(apiKey, { 'Idempotency-Key': idempotencyKey }),
        body: JSON.stringify({
          paymentId: payment.id,
          amount: refundAmount,
          reason: `system volume ${payment.scenario}`,
        }),
      });
      assert(
        replay?.refund?.id === result.refund.id,
        'Refund idempotency replay returned a different refund id.',
      );
    }

    payment.refundIds.push(result.refund.id);
    expectWebhook('payment.refunded');
    expected.account.pending -= result.refund.amount - result.refund.feeRefunded;
    expected.transactions.REFUND_DEDUCTED += 1;
  });

  const toRelease = directPayments.filter((payment) => payment.scenario === 'released');
  await mapLimit(toRelease, 1, async (payment) => {
    const result = await requestJson(`/dev/simulate/${payment.id}/release`, {
      method: 'POST',
      headers: apiKeyHeaders(apiKey),
    });
    assert(result?.payment?.status === 'RELEASED', `Payment ${payment.id} did not release.`);
    expectWebhook('payment.released');
    expected.account.pending -= payment.netAmount;
    expected.account.available += payment.netAmount;
    expected.transactions.PAYMENT_RELEASED += 1;
  });

  for (const payment of directPayments) {
    incrementCount(summary.directPayments, payment.finalStatus);
  }
}

async function createCheckoutSessions(apiKey) {
  const checkoutCount = Math.max(3, Math.min(10, Math.floor(PAYMENT_COUNT / 20)));
  const indexes = Array.from({ length: checkoutCount }, (_, index) => index);
  const sessions = await mapLimit(indexes, 1, async (index) => {
    const customer =
      index % 2 === 0
        ? explicitCustomers[(index + 1) % explicitCustomers.length]
        : undefined;
    const created = await requestJson('/checkout-sessions', {
      method: 'POST',
      headers: apiKeyHeaders(apiKey),
      body: JSON.stringify({
        amount: 1800 + index * 333,
        description: `System volume checkout ${index}`,
        customerCollectionMode: 'IDENTIFIED',
        prefillCustomer: customer
          ? {
              document: customer.document,
              name: customer.name,
              email: customer.email,
            }
          : undefined,
        successUrl: `${CHECKOUT_URL}/system-smoke/success`,
        cancelUrl: `${CHECKOUT_URL}/system-smoke/cancel`,
        expiresInSeconds: 3600,
        metadata: {
          smokeRunId: runId,
          source: 'checkout_session',
          index,
        },
      }),
    });
    assert(created?.checkoutToken, `Checkout session ${index} did not return a checkout token.`);

    const publicSession = await requestJson(`/checkout-sessions/${created.checkoutToken}`);
    assert(publicSession?.status === 'OPEN', 'Checkout public lookup did not return an open session.');

    const fulfilled = await requestJson(`/checkout-sessions/${created.checkoutToken}/fulfill`, {
      method: 'POST',
      body: JSON.stringify({
        customer: checkoutCustomerPayload(index, customer),
      }),
    });
    assert(fulfilled?.paymentId, `Checkout session ${index} fulfillment did not return a payment id.`);
    expectWebhook('payment.created');

    const payment = await requestJson(`/payments/${fulfilled.paymentId}`, {
      headers: apiKeyHeaders(apiKey),
    });
    assert(payment?.payment?.id === fulfilled.paymentId, 'Fulfilled checkout payment lookup returned an unexpected payment.');

    const confirmed = await requestJson(`/dev/simulate/${fulfilled.paymentId}/confirm`, {
      method: 'POST',
      headers: apiKeyHeaders(apiKey),
    });
    assert(confirmed?.payment?.status === 'CONFIRMED', 'Fulfilled checkout payment did not confirm.');
    expectWebhook('payment.confirmed');

    expected.account.pending += payment.payment.netAmount;
    expected.transactions.PAYMENT_RECEIVED += 1;
    expected.receipts += 1;
    incrementCount(summary.checkoutPayments, 'CONFIRMED');

    return {
      ...payment.payment,
      checkoutToken: created.checkoutToken,
      sessionId: fulfilled.sessionId,
      finalStatus: 'CONFIRMED',
      source: 'checkout',
    };
  });

  checkoutPayments.push(...sessions);
}

async function createPaymentLinks(apiKey) {
  const indexes = Array.from({ length: PAYMENT_LINK_COUNT }, (_, index) => index);
  const links = await mapLimit(indexes, 1, async (index) => {
    const created = await requestJson('/payment-links', {
      method: 'POST',
      jwtCookie: true,
      body: JSON.stringify({
        amount: 2500 + index * 91,
        title: `System Volume Link ${index}`,
        description: `System volume payment link ${index}`,
        internalReference: `system-${runId}-link-${index}`,
      }),
    });
    assert(created?.paymentLink?.id, `Payment link ${index} creation did not return an id.`);

    const linkId = created.paymentLink.id;
    const bucket = index % 5;

    if (bucket === 0) {
      const failed = await requestJson(`/payment-links/${linkId}/fail`, {
        method: 'POST',
        jwtCookie: true,
        body: JSON.stringify({ reason: 'system volume failed first attempt' }),
      });
      assert(failed?.payment?.status === 'FAILED', 'Payment link failed attempt did not return a failed payment.');
      paymentLinkPayments.push({ ...failed.payment, source: 'payment_link', finalStatus: 'FAILED' });
      expectWebhook('payment.failed');
      incrementCount(summary.paymentLinkPayments, 'FAILED');

      const paid = await requestJson(`/payment-links/${linkId}/pay`, {
        method: 'POST',
        jwtCookie: true,
      });
      assert(paid?.payment?.status === 'CONFIRMED', 'Payment link paid attempt did not return a confirmed payment.');
      paymentLinkPayments.push({ ...paid.payment, source: 'payment_link', finalStatus: 'CONFIRMED' });
      expectWebhook('payment.created');
      expectWebhook('payment.confirmed');
      expected.account.pending += paid.payment.netAmount;
      expected.transactions.PAYMENT_RECEIVED += 1;
      expected.receipts += 1;
      incrementCount(summary.paymentLinkPayments, 'CONFIRMED');
      summary.paymentLinks.paid += 1;
    } else if (bucket === 1) {
      const failed = await requestJson(`/payment-links/${linkId}/fail`, {
        method: 'POST',
        jwtCookie: true,
        body: JSON.stringify({ reason: 'system volume failed open attempt' }),
      });
      assert(failed?.payment?.status === 'FAILED', 'Payment link failed-open attempt did not return a failed payment.');
      paymentLinkPayments.push({ ...failed.payment, source: 'payment_link', finalStatus: 'FAILED' });
      expectWebhook('payment.failed');
      incrementCount(summary.paymentLinkPayments, 'FAILED');
      summary.paymentLinks.failedOpen += 1;
    } else if (bucket === 2) {
      const paid = await requestJson(`/payment-links/${linkId}/pay`, {
        method: 'POST',
        jwtCookie: true,
      });
      assert(paid?.payment?.status === 'CONFIRMED', 'Payment link paid attempt did not return a confirmed payment.');
      paymentLinkPayments.push({ ...paid.payment, source: 'payment_link', finalStatus: 'CONFIRMED' });
      expectWebhook('payment.created');
      expectWebhook('payment.confirmed');
      expected.account.pending += paid.payment.netAmount;
      expected.transactions.PAYMENT_RECEIVED += 1;
      expected.receipts += 1;
      incrementCount(summary.paymentLinkPayments, 'CONFIRMED');
      summary.paymentLinks.paid += 1;
    } else if (bucket === 3) {
      const canceled = await requestJson(`/payment-links/${linkId}/cancel`, {
        method: 'POST',
        jwtCookie: true,
      });
      assert(canceled?.paymentLink?.status === 'CANCELLED', 'Payment link cancel did not return CANCELLED status.');
      summary.paymentLinks.canceled += 1;
    } else {
      const opened = await requestJson(`/payment-links/public/${created.paymentLink.publicToken}`);
      assert(opened?.paymentLink?.id === linkId, 'Public payment link open returned an unexpected link.');
      summary.paymentLinks.open += 1;
    }

    return requestJson(`/payment-links/${linkId}`, { jwtCookie: true });
  });

  assert(links.length === PAYMENT_LINK_COUNT, 'Payment link scenario count did not match target.');
}

async function validateLightweightWithdrawals() {
  const bankAccounts = await requestJson('/bank-accounts', { jwtCookie: true });
  const bankAccount = bankAccounts?.find((item) => item.id === state.bankAccountId);
  assert(bankAccount?.isVerified === true, 'Withdrawals check did not find the verified Pix account.');

  const amount = 1000;
  assert(
    expected.account.available >= amount,
    `Withdrawals check needs at least ${amount} available cents, got ${expected.account.available}.`,
  );

  const created = await requestJson('/withdrawals', {
    method: 'POST',
    jwtCookie: true,
    headers: {
      'Idempotency-Key': `system-${runId}-withdrawal-light`,
    },
    body: JSON.stringify({
      bankAccountId: state.bankAccountId,
      amount,
    }),
  });
  state.withdrawalId = created?.withdrawal?.id;
  assert(state.withdrawalId, 'Withdrawals check did not return a withdrawal id.');

  expected.account.available -= amount;
  expected.account.blocked += amount;
  expected.transactions.WITHDRAWAL_RESERVED += 1;

  const list = await requestJson('/withdrawals?limit=10', { jwtCookie: true });
  assert(
    list?.withdrawals?.some((withdrawal) => withdrawal.id === state.withdrawalId),
    'Withdrawals check list did not include the created withdrawal.',
  );

  const ledger = await requestJson('/transactions?type=WITHDRAWAL_RESERVED&limit=10', { jwtCookie: true });
  assert(
    ledger?.data?.some(
      (transaction) =>
        transaction.referenceType === 'WITHDRAWAL' &&
        transaction.referenceId === state.withdrawalId,
    ),
    'Withdrawals check did not find the reserved ledger transaction.',
  );
}

async function validateFinalState(apiKey) {
  const account = await requestJson('/accounts/me', { jwtCookie: true });
  assert(account?.account?.available === expected.account.available, `Available balance mismatch. Expected ${expected.account.available}, got ${account?.account?.available}.`);
  assert(account?.account?.pending === expected.account.pending, `Pending balance mismatch. Expected ${expected.account.pending}, got ${account?.account?.pending}.`);
  assert(account?.account?.blocked === expected.account.blocked, `Blocked balance mismatch. Expected ${expected.account.blocked}, got ${account?.account?.blocked}.`);

  for (const [status, count] of Object.entries({
    ...summary.directPayments,
    CONFIRMED:
      (summary.directPayments.CONFIRMED ?? 0) +
      (summary.checkoutPayments.CONFIRMED ?? 0) +
      (summary.paymentLinkPayments.CONFIRMED ?? 0),
    FAILED:
      (summary.directPayments.FAILED ?? 0) +
      (summary.paymentLinkPayments.FAILED ?? 0),
  })) {
    const result = await requestJson(`/payments?status=${status}&limit=1`, {
      headers: apiKeyHeaders(apiKey),
    });
    assert(result?.total === count, `Payment status ${status} count mismatch. Expected ${count}, got ${result?.total}.`);
  }

  const receiptList = await requestJson('/receipts?limit=100', { jwtCookie: true });
  assert(receiptList?.total === expected.receipts, `Receipt count mismatch. Expected ${expected.receipts}, got ${receiptList?.total}.`);

  const sampleReceiptPayment = [
    ...directPayments.filter((payment) => ['confirmed', 'released', 'refunded_full', 'refunded_partial'].includes(payment.scenario)),
    ...checkoutPayments,
    ...paymentLinkPayments.filter((payment) => payment.finalStatus === 'CONFIRMED'),
  ][0];
  assert(sampleReceiptPayment?.id, 'No receipt-capable payment was created.');

  const receiptByPayment = await requestJson(`/receipts/payment/${sampleReceiptPayment.id}`, {
    jwtCookie: true,
  });
  assert(receiptByPayment?.receipt?.paymentId === sampleReceiptPayment.id, 'Receipt lookup by payment returned an unexpected payment id.');

  const receiptByNumber = await requestJson(`/receipts/number/${receiptByPayment.receipt.receiptNumber}`, {
    jwtCookie: true,
  });
  assert(receiptByNumber?.receipt?.id === receiptByPayment.receipt.id, 'Receipt lookup by number returned an unexpected receipt.');

  const receiptById = await requestJson(`/receipts/${receiptByPayment.receipt.id}`, {
    jwtCookie: true,
  });
  assert(receiptById?.receipt?.id === receiptByPayment.receipt.id, 'Receipt lookup by id returned an unexpected receipt.');

  for (const [type, count] of Object.entries(expected.transactions)) {
    const result = await requestJson(`/transactions?type=${type}&limit=1`, { jwtCookie: true });
    assert(result?.meta?.total === count, `Transaction ${type} count mismatch. Expected ${count}, got ${result?.meta?.total}.`);
  }

  const transactions = await requestJson('/transactions?limit=100', { jwtCookie: true });
  const expectedTransactionTotal = Object.values(expected.transactions).reduce(
    (total, count) => total + count,
    0,
  );
  assert(
    transactions?.meta?.total === expectedTransactionTotal,
    'Transaction total did not match expected ledger activity.',
  );

  const customers = await requestJson('/customers?limit=100', { headers: apiKeyHeaders(apiKey) });
  assert(customers?.total >= CUSTOMER_COUNT, `Customer list returned too few customers. Expected at least ${CUSTOMER_COUNT}, got ${customers?.total}.`);

  const historyCustomer = explicitCustomers[0];
  const historyPayments = await requestJson(
    `/customer-history/customers/${encodeURIComponent(historyCustomer.externalId)}/payments?limit=10`,
    { headers: apiKeyHeaders(apiKey) },
  );
  assert(Array.isArray(historyPayments?.payments), 'Customer history payments did not return a payments array.');

  const historyReceipts = await requestJson(
    `/customer-history/customers/${encodeURIComponent(historyCustomer.externalId)}/receipts?limit=10`,
    { headers: apiKeyHeaders(apiKey) },
  );
  assert(Array.isArray(historyReceipts?.receipts), 'Customer history receipts did not return a receipts array.');

  const startDate = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const endDate = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const metrics = await requestJson(
    `/dashboard/metrics?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
    { jwtCookie: true },
  );
  assert(metrics?.currentBalance?.pending === expected.account.pending, 'Dashboard pending balance did not match account.');
  assert(metrics?.currentBalance?.available === expected.account.available, 'Dashboard available balance did not match account.');
  assert(metrics?.processing?.salesCount === expected.transactions.PAYMENT_RECEIVED, 'Dashboard sales count did not match received transactions.');

  const links = await requestJson('/payment-links?limit=100', { jwtCookie: true });
  assert(links?.total === PAYMENT_LINK_COUNT || links?.stats?.total === PAYMENT_LINK_COUNT, 'Payment link list total did not match created links.');

  const apiKeys = await requestJson('/api-keys', { jwtCookie: true });
  assert(apiKeys?.apiKeys?.some((key) => key.prefix === state.apiKeyPrefix), 'API key list did not include the smoke API key.');

  const bankAccounts = await requestJson('/bank-accounts', { jwtCookie: true });
  assert(bankAccounts?.some((bankAccount) => bankAccount.id === state.bankAccountId), 'Bank account list did not include the smoke bank account.');

  const alerts = await requestJson('/alerts', { jwtCookie: true });
  assert(alerts?.alerts?.some((alert) => alert.id === state.alertId), 'Alert list did not include the smoke alert.');

  const refundTimelinePayment = directPayments.find((payment) => payment.scenario === 'refunded_full');
  const timeline = await requestJson(`/payments/${refundTimelinePayment.id}/timeline`, {
    headers: apiKeyHeaders(apiKey),
  });
  assert(timeline?.payment?.id === refundTimelinePayment.id, 'Payment timeline returned an unexpected payment.');
  assert(timeline?.receipt?.paymentId === refundTimelinePayment.id, 'Payment timeline did not include the receipt.');
  assert(timeline?.refunds?.length >= 1, 'Payment timeline did not include refunds.');
  assert(timeline?.transactions?.some((transaction) => transaction.type === 'REFUND_DEDUCTED'), 'Payment timeline did not include refund transactions.');
  assert(timeline?.timeline?.some((event) => event.type === 'payment.refunded'), 'Payment timeline did not include a payment.refunded event.');

  return {
    account: account.account,
    customers: customers.total,
    receipts: receiptList.total,
    transactions: transactions.meta.total,
    metrics,
  };
}

async function validateWebhooks(apiKey) {
  const logs = await pollUntil(
    'Delivered webhook logs for all expected events',
    async () => {
      const collected = await collectPaginated(
        `/webhooks/${state.webhookId}/logs?status=delivered`,
        'logs',
        100,
        20,
        { headers: apiKeyHeaders(apiKey) },
      );
      return collected.records;
    },
    (records) => hasExpectedWebhookCounts(records, (record) => record.eventType),
  );

  const receiverDeliveries = await pollUntil(
    'Local webhook receiver deliveries for all expected events',
    async () => deliveries,
    (records) => hasExpectedWebhookCounts(records, (record) => record?.body?.type),
  );

  const samplePayment = directPayments.find((payment) => payment.scenario === 'released');
  const sampleTimeline = await pollUntil(
    'Payment timeline webhook log',
    () =>
      requestJson(`/payments/${samplePayment.id}/timeline`, {
        headers: apiKeyHeaders(apiKey),
      }),
    (result) => result?.webhookLogs?.some((log) => log.paymentId === samplePayment.id),
  );
  assert(
    sampleTimeline.webhookLogs.some((log) => log.eventType === 'payment.released'),
    'Released payment timeline did not include payment.released webhook log.',
  );

  return {
    deliveredLogs: logs.length,
    receiverDeliveries: receiverDeliveries.length,
    expectedByEvent: expected.webhooks,
    byEvent: WEBHOOK_EVENTS.reduce((acc, event) => {
      acc[event] = logs.filter((log) => log.eventType === event).length;
      return acc;
    }, {}),
  };
}

function hasExpectedWebhookCounts(records, getEventType) {
  const counts = WEBHOOK_EVENTS.reduce((acc, event) => {
    acc[event] = 0;
    return acc;
  }, {});

  for (const record of records) {
    const eventType = getEventType(record);
    if (eventType in counts) counts[eventType] += 1;
  }

  return WEBHOOK_EVENTS.every((event) => counts[event] >= expected.webhooks[event]);
}

async function run() {
  step(`Using API ${API_URL}`);
  await startWebhookReceiver();
  step(`Local webhook receiver listening on http://127.0.0.1:${WEBHOOK_PORT}/webhook`);

  step('Checking API liveness and readiness');
  const live = await requestJson('/health/live');
  const ready = await requestJson('/health/ready');
  assert(live?.status === 'ok', 'Health live endpoint did not return status=ok.');
  assert(ready?.status === 'ok', 'Health ready endpoint did not return status=ok.');

  step('Creating merchant, logging in, and creating store');
  await createMerchantStore();

  step('Creating dashboard API key, bank account, webhook, and alert config');
  const apiKey = await configureDashboardSurface();

  step(`Creating ${CUSTOMER_COUNT} explicit customers`);
  await createExplicitCustomers(apiKey);

  step(`Creating ${PAYMENT_COUNT} direct payments`);
  await createDirectPayments(apiKey);

  step('Applying direct payment status, refund, and release scenarios');
  await applyDirectPaymentScenarios(apiKey);

  step('Creating and fulfilling checkout sessions');
  await createCheckoutSessions(apiKey);

  step(`Creating ${PAYMENT_LINK_COUNT} payment links with paid, failed, open, and canceled outcomes`);
  await createPaymentLinks(apiKey);

  step('Validating lightweight withdrawals API and reserved ledger path');
  await validateLightweightWithdrawals();

  step('Validating balances, ledger, receipts, history, dashboard, and management endpoints');
  const finalState = await validateFinalState(apiKey);

  step('Waiting for worker webhook delivery logs and local receiver deliveries');
  const webhookSummary = await validateWebhooks(apiKey);

  step('System volume smoke completed');
  console.log(
    JSON.stringify(
      {
        ok: true,
        runId,
        apiUrl: API_URL,
        webhookReceiverUrl: `http://127.0.0.1:${WEBHOOK_PORT}/webhook`,
        merchant: {
          id: state.merchantId,
          email: state.merchantEmail,
          password: state.merchantPassword,
        },
        storeId: state.storeId,
        apiKeyPrefix: state.apiKeyPrefix,
        webhookId: state.webhookId,
        alertId: state.alertId,
        bankAccountId: state.bankAccountId,
        withdrawalId: state.withdrawalId,
        totals: {
          customersCreated: CUSTOMER_COUNT,
          directPayments: PAYMENT_COUNT,
          checkoutPayments: checkoutPayments.length,
          paymentLinks: PAYMENT_LINK_COUNT,
          paymentLinkAttempts: paymentLinkPayments.length,
          paymentsByStatus: {
            direct: summary.directPayments,
            checkout: summary.checkoutPayments,
            paymentLinks: summary.paymentLinkPayments,
          },
          linkOutcomes: summary.paymentLinks,
          receipts: finalState.receipts,
          transactions: finalState.transactions,
          customers: finalState.customers,
          webhookDeliveries: webhookSummary,
        },
        balances: {
          expected: expected.account,
          actual: {
            available: finalState.account.available,
            pending: finalState.account.pending,
            blocked: finalState.account.blocked,
          },
        },
        dashboardLinks: {
          home: `${DASHBOARD_URL}/dashboard`,
          payments: `${DASHBOARD_URL}/dashboard/payments`,
          customers: `${DASHBOARD_URL}/dashboard/customers`,
          receipts: `${DASHBOARD_URL}/dashboard/receipts`,
          financials: `${DASHBOARD_URL}/dashboard/financials`,
          webhooks: `${DASHBOARD_URL}/dashboard/webhooks`,
          alerts: `${DASHBOARD_URL}/dashboard/alerts`,
          apiKeys: `${DASHBOARD_URL}/dashboard/api-keys`,
          paymentLinks: `${DASHBOARD_URL}/dashboard/payment-links`,
        },
        outOfScopeByPartialMaturity: [
          'products',
          'payment_items',
          'external Discord alert delivery unless HOCKPAY_SMOKE_DISCORD_WEBHOOK_URL is set',
        ],
      },
      null,
      2,
    ),
  );
}

try {
  await run();
} catch (error) {
  console.error(`[smoke:system] FAILED: ${formatError(error)}`);
  if (error?.details) {
    console.error(JSON.stringify(error.details, null, 2));
  } else if (lastHttp) {
    console.error(JSON.stringify({ stage: currentStage, lastHttp }, null, 2));
  }
  process.exitCode = 1;
} finally {
  await stopWebhookReceiver().catch((error) => {
    console.error(`[smoke:system] Failed to close webhook receiver: ${formatError(error)}`);
    process.exitCode = 1;
  });
}
