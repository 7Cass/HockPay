import { randomBytes, randomInt } from 'node:crypto';
import { createServer } from 'node:http';

const API_URL = process.env.HOCKPAY_API_URL ?? 'http://localhost:3000/api/v1';
const WEBHOOK_PORT = Number(process.env.HOCKPAY_SMOKE_WEBHOOK_PORT ?? 3999);
const TIMEOUT_MS = Number(process.env.HOCKPAY_SMOKE_TIMEOUT_MS ?? 30000);
const POLL_INTERVAL_MS = 500;
const runId = `${Date.now()}-${randomInt(1000, 9999)}`;

const state = {
  merchantId: undefined,
  storeId: undefined,
  apiKeyPrefix: undefined,
  webhookId: undefined,
  paymentId: undefined,
  webhookLogId: undefined,
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
  console.log(`[smoke:p0] ${message}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new SmokeError(message);
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
        ? ' JWT-protected dashboard endpoints require a valid hockpay_at cookie; check login/store cookie handling rather than the API key.'
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

function randomPassword() {
  return randomBytes(18).toString('base64url');
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

async function run() {
  step(`Using API ${API_URL}`);
  await startWebhookReceiver();
  step(`Local webhook receiver listening on http://127.0.0.1:${WEBHOOK_PORT}/webhook`);

  step('Checking API liveness and readiness');
  const live = await requestJson('/health/live');
  const ready = await requestJson('/health/ready');
  assert(live?.status === 'ok', 'Health live endpoint did not return status=ok.');
  assert(ready?.status === 'ok', 'Health ready endpoint did not return status=ok.');

  const merchantDocument = buildCpf(`${Date.now()}${randomInt(1000, 9999)}`);
  const customerDocument = buildCpf(`${Date.now() + 1}${randomInt(1000, 9999)}`);
  const merchantEmail = `smoke-${runId}@hockpay.local`;
  const merchantPassword = randomPassword();

  step('Creating merchant and authenticated store');
  const merchant = await requestJson('/merchants', {
    method: 'POST',
    body: JSON.stringify({
      name: `Smoke Merchant ${runId}`,
      email: merchantEmail,
      password: merchantPassword,
      document: merchantDocument,
    }),
  });
  state.merchantId = merchant?.id;
  assert(state.merchantId, 'Merchant creation did not return an id.');

  const login = await requestJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: merchantEmail,
      password: merchantPassword,
    }),
  });
  assert(login?.accessToken, 'Login did not return an access token.');
  setAuthCookiesFromBody(login);

  const storeResult = await requestJson('/stores', {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({
      name: `Smoke Store ${runId}`,
      slug: `smoke-store-${runId}`.replace(/[^a-z0-9-]/g, '-').slice(0, 50),
    }),
  });
  state.storeId = storeResult?.store?.id;
  assert(state.storeId, 'Store creation did not return a store id.');
  assert(storeResult?.accessToken, 'Store creation did not return a store access token.');
  setAuthCookiesFromBody(storeResult);

  const account = await requestJson('/accounts/me', {
    jwtCookie: true,
  });
  assert(account?.account?.storeId === state.storeId, 'Account lookup did not match the created store.');

  step('Creating TEST API key and local webhook config');
  const apiKey = await requestJson('/api-keys', {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({
      name: `Smoke API Key ${runId}`,
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
      events: ['payment.confirmed'],
    }),
  });
  state.webhookId = webhook?.id;
  assert(state.webhookId, 'Webhook creation did not return an id.');

  step('Creating and confirming a payment');
  const paymentResult = await requestJson('/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.plainKey}`,
      'Idempotency-Key': `smoke-payment-${runId}`,
    },
    body: JSON.stringify({
      externalId: `smoke-payment-${runId}`,
      amount: 1500,
      description: 'P0 smoke payment',
      customer: {
        name: 'Smoke Customer',
        email: `customer-${runId}@hockpay.local`,
        document: customerDocument,
      },
      metadata: {
        smokeRunId: runId,
      },
    }),
  });
  state.paymentId = paymentResult?.payment?.id;
  assert(state.paymentId, 'Payment creation did not return a payment id.');

  await requestJson(`/dev/simulate/${state.paymentId}/confirm`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.plainKey}`,
    },
  });

  const confirmedPayment = await pollUntil(
    'Confirmed payment',
    () =>
      requestJson(`/payments/${state.paymentId}`, {
        headers: {
          Authorization: `Bearer ${apiKey.plainKey}`,
        },
      }),
    (result) => result?.payment?.status === 'CONFIRMED',
  );
  assert(
    confirmedPayment?.payment?.id === state.paymentId,
    'Confirmed payment lookup returned an unexpected payment.',
  );

  step('Waiting for worker delivery and persisted webhook logs');
  const logsResult = await pollUntil(
    'Delivered webhook log',
    () =>
      requestJson(`/webhooks/${state.webhookId}/logs?status=delivered`, {
        headers: {
          Authorization: `Bearer ${apiKey.plainKey}`,
        },
      }),
    (result) =>
      result?.logs?.some(
        (log) => log.paymentId === state.paymentId && log.eventType === 'payment.confirmed',
      ),
  );
  const deliveredLog = logsResult.logs.find(
    (log) => log.paymentId === state.paymentId && log.eventType === 'payment.confirmed',
  );
  state.webhookLogId = deliveredLog?.id;

  const delivery = await pollUntil(
    'Webhook receiver delivery',
    async () => deliveries.at(-1),
    (result) =>
      result?.body?.type === 'payment.confirmed' &&
      result?.body?.data?.id === state.paymentId &&
      Boolean(result?.headers?.['x-hockpay-webhook-id']),
  );
  assert(delivery?.body?.id, 'Webhook receiver did not capture the outbox event id.');

  // O contrato publicado em docs/EVENTS.md promete um envelope versionado. Vale
  // olhar o que chegou de verdade no receiver, e nao o que a API respondeu: e o
  // corpo entregue que o integrador tem que conseguir parsear.
  for (const field of ['id', 'type', 'version', 'created_at', 'data']) {
    assert(
      delivery.body[field] !== undefined,
      `Webhook envelope for ${delivery.body.type} is missing "${field}".`,
    );
  }
  assert(
    Number.isInteger(delivery.body.version) && delivery.body.version >= 1,
    `Webhook envelope carried a non-integer version: ${delivery.body.version}`,
  );
  assert(
    typeof delivery.body.data?.storeId === 'string',
    'Webhook envelope arrived without data.storeId.',
  );

  step('Smoke flow completed');
  console.log(
    JSON.stringify(
      {
        ok: true,
        apiUrl: API_URL,
        webhookReceiverUrl: `http://127.0.0.1:${WEBHOOK_PORT}/webhook`,
        ...state,
      },
      null,
      2,
    ),
  );
}

try {
  await run();
} catch (error) {
  console.error(`[smoke:p0] FAILED: ${formatError(error)}`);
  process.exitCode = 1;
} finally {
  await stopWebhookReceiver().catch((error) => {
    console.error(`[smoke:p0] Failed to close webhook receiver: ${formatError(error)}`);
    process.exitCode = 1;
  });
}
