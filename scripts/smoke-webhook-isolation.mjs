import { randomBytes, randomInt } from 'node:crypto';
import { createServer } from 'node:http';

/**
 * Prova que um destino de webhook pendurado nao segura a fila dos outros.
 *
 * Este e o cenario que motivou o circuit breaker: um endpoint que aceita a
 * conexao e nunca responde consome o timeout inteiro por evento, e enquanto
 * isso os eventos de outras lojas esperam. Antes do breaker, 50 eventos
 * pendentes de um destino travado seguravam a fila por dezenas de minutos.
 *
 * O smoke monta exatamente isso -- loja A apontando para um receiver que
 * pendura, loja B para um que responde -- enche a fila com eventos de A, e
 * mede quanto tempo o unico evento de B leva para sair.
 *
 * A asserção e relativa ao timeout configurado, nao um numero de parede: sem
 * breaker, o evento de B espera ceil(N/concorrencia) rodadas de timeout; com
 * breaker, espera uma rodada e o resto falha na hora. A margem fica no meio
 * dos dois, entao o teste discrimina os dois mundos em qualquer maquina.
 */

const API_URL = process.env.HOCKPAY_API_URL ?? 'http://localhost:3000/api/v1';
const HEALTHY_PORT = Number(process.env.HOCKPAY_SMOKE_WEBHOOK_PORT ?? 3999);
const HUNG_PORT = HEALTHY_PORT + 1;
const TIMEOUT_MS = Number(process.env.HOCKPAY_SMOKE_TIMEOUT_MS ?? 60000);
const POLL_INTERVAL_MS = 250;

/** Precisa bater com o worker: e a partir dele que a margem e calculada. */
const DELIVERY_TIMEOUT_MS = Number(process.env.WEBHOOK_DELIVERY_TIMEOUT_MS ?? 30000);
const DELIVERY_CONCURRENCY = Number(process.env.WEBHOOK_DELIVERY_CONCURRENCY ?? 5);
// 50 e o numero do cenario que motivou o breaker: 50 eventos pendentes de um
// destino travado. Tambem e o que da margem confortavel entre o orcamento e o
// pior caso sem breaker -- com menos que isso os dois se encostam.
const HUNG_EVENT_COUNT = Number(process.env.HOCKPAY_SMOKE_HUNG_EVENTS ?? 50);
/**
 * O outbox e varrido por cron, entao entre criar o pagamento e a entrega sair
 * existe uma espera que nao tem nada a ver com o destino pendurado. Ela entra
 * no orcamento -- de outro modo o teste acusaria gargalo quando so pegou o
 * dispatcher no tempo errado.
 */
const DISPATCH_INTERVAL_MS = Number(process.env.HOCKPAY_SMOKE_DISPATCH_INTERVAL_MS ?? 2000);

const runId = `${Date.now()}-${randomInt(1000, 9999)}`;
const cookieJar = new Map();

/** Entregas que chegaram no destino saudavel, com o instante de chegada. */
const healthyDeliveries = [];
/** Sockets pendurados de proposito, para fechar no final. */
const hungSockets = new Set();
let healthyReceiver;
let hungReceiver;

class SmokeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SmokeError';
  }
}

function step(message) {
  console.log(`[smoke:webhook-isolation] ${message}`);
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

async function startReceivers() {
  healthyReceiver = createServer((request, response) => {
    if (request.method !== 'POST' || request.url !== '/webhook') {
      response.writeHead(404).end();
      return;
    }

    // Responde na hora e so anota quando chegou. O corpo nao interessa aqui:
    // o que este smoke mede e latencia de fila, nao forma de payload.
    healthyDeliveries.push({ at: Date.now() });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ received: true }));
  });

  // O destino doente: aceita a conexao, le a request e nunca responde. E o caso
  // ruim de verdade -- um endpoint que recusa a conexao falha em milissegundos
  // e nao produz gargalo nenhum.
  hungReceiver = createServer((request, response) => {
    hungSockets.add(response);
    request.resume();
    response.on('close', () => hungSockets.delete(response));
  });
  hungReceiver.on('connection', (socket) => {
    socket.unref();
  });

  await Promise.all([
    listen(healthyReceiver, HEALTHY_PORT, 'healthy'),
    listen(hungReceiver, HUNG_PORT, 'hung'),
  ]);
}

function listen(server, port, label) {
  return new Promise((resolve, reject) => {
    server.once('error', (error) => {
      reject(
        new SmokeError(
          `Could not start the ${label} webhook receiver on port ${port}. ${formatError(error)}`,
        ),
      );
    });
    server.listen(port, '127.0.0.1', resolve);
  });
}

async function stopReceivers() {
  for (const response of hungSockets) {
    response.destroy();
  }
  hungSockets.clear();

  await Promise.all(
    [healthyReceiver, hungReceiver].map(
      (server) =>
        new Promise((resolve) => {
          if (!server?.listening) {
            resolve();
            return;
          }
          // `close()` sozinho espera as conexoes abertas terminarem -- e as do
          // destino pendurado nunca terminam, por definicao. Sem derrubar as
          // conexoes na forca, o processo fica preso no proprio cenario que
          // este smoke monta.
          server.closeAllConnections?.();
          server.close(() => resolve());
        }),
    ),
  );
}

async function createMerchant() {
  const email = `webhook-isolation-${runId}@hockpay.local`;
  const password = randomPassword();

  const merchant = await requestJson('/merchants', {
    method: 'POST',
    body: JSON.stringify({
      name: `Webhook Isolation Smoke ${runId}`,
      email,
      password,
      document: buildCpf(`${Date.now()}${randomInt(1000, 9999)}`),
    }),
  });
  assert(merchant?.id, 'Merchant creation did not return an id.');

  const login = await requestJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  assert(login?.accessToken, 'Login did not return an access token.');
  setAuthCookiesFromBody(login);
}

/**
 * Cria uma loja, uma API key TEST e um webhook apontando para `webhookUrl`.
 *
 * Precisa ser loja separada, e nao so outro webhook na mesma loja: o worker
 * busca configs por `storeId`, entao e a fronteira de loja que reproduz "o
 * evento de outro merchant".
 */
async function createStoreWithWebhook(label, webhookUrl) {
  const slug = `iso-${label}-${runId}`.replace(/[^a-z0-9-]/g, '-').slice(0, 50);
  const storeResult = await requestJson('/stores', {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({ name: `Isolation ${label} ${runId}`, slug }),
  });
  const storeId = storeResult?.store?.id;
  assert(storeId, `Store creation for ${label} did not return an id.`);
  // Criar loja devolve um token novo, ja escopado nela.
  setAuthCookiesFromBody(storeResult);

  const apiKey = await requestJson('/api-keys', {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({ name: `Isolation ${label} ${runId}`, environment: 'TEST' }),
  });
  assert(apiKey?.plainKey, `API key creation for ${label} did not return plainKey.`);

  const webhook = await requestJson('/webhooks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey.plainKey}` },
    body: JSON.stringify({ url: webhookUrl, events: ['payment.created'] }),
  });
  assert(webhook?.id, `Webhook creation for ${label} did not return an id.`);

  return { label, storeId, apiKey: apiKey.plainKey, webhookId: webhook.id };
}

async function createPayment(store, index) {
  return requestJson('/payments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${store.apiKey}`,
      'Idempotency-Key': `iso-${store.label}-${runId}-${index}`,
    },
    body: JSON.stringify({
      amount: 1000 + index,
      description: `Isolation smoke ${store.label} #${index}`,
      customer: {
        name: `Isolation Payer ${index}`,
        email: `iso-${store.label}-${index}-${runId}@hockpay.local`,
        document: buildCpf(`${index}${runId.replace(/\D/g, '')}`),
      },
    }),
  });
}

async function run() {
  step(`Using API ${API_URL}`);
  step(
    `Worker delivery timeout ${DELIVERY_TIMEOUT_MS}ms, concurrency ${DELIVERY_CONCURRENCY}, ${HUNG_EVENT_COUNT} hung events`,
  );

  await startReceivers();
  step(`Receivers up: healthy :${HEALTHY_PORT}, hung :${HUNG_PORT}`);

  step('Creating one merchant with two stores');
  await createMerchant();
  const hungStore = await createStoreWithWebhook('hung', `http://127.0.0.1:${HUNG_PORT}/webhook`);
  const healthyStore = await createStoreWithWebhook(
    'healthy',
    `http://127.0.0.1:${HEALTHY_PORT}/webhook`,
  );

  step(`Filling the queue with ${HUNG_EVENT_COUNT} events for the hung destination`);
  for (let index = 0; index < HUNG_EVENT_COUNT; index += 1) {
    await createPayment(hungStore, index);
  }

  step('Creating the single event for the healthy destination');
  const startedAt = Date.now();
  await createPayment(healthyStore, 0);

  // Sem breaker, o evento saudavel espera todas as rodadas de timeout que os
  // eventos pendurados consomem antes dele. Com breaker, espera uma rodada.
  const roundsWithoutBreaker = Math.ceil(HUNG_EVENT_COUNT / DELIVERY_CONCURRENCY);
  const worstCaseMs = roundsWithoutBreaker * DELIVERY_TIMEOUT_MS;
  // Uma rodada de timeout (a que abre o circuito) mais folga de dispatcher.
  const budgetMs = DELIVERY_TIMEOUT_MS * 2 + DISPATCH_INTERVAL_MS * 3;
  assert(
    budgetMs < worstCaseMs,
    `Smoke is not discriminating: budget ${budgetMs}ms is not below the no-breaker worst case ${worstCaseMs}ms. Raise HOCKPAY_SMOKE_HUNG_EVENTS.`,
  );

  step(`Waiting for the healthy delivery (budget ${budgetMs}ms, no-breaker worst case ${worstCaseMs}ms)`);
  await pollUntil(
    'Healthy destination delivery',
    async () => healthyDeliveries[0],
    (delivery) => Boolean(delivery),
  );

  const elapsedMs = healthyDeliveries[0].at - startedAt;
  assert(
    elapsedMs <= budgetMs,
    `Healthy destination waited ${elapsedMs}ms behind a hung one; budget is ${budgetMs}ms. A stuck destination is still blocking the queue.`,
  );

  step('Checking the hung destination tripped its circuit');
  const hooks = await pollUntil(
    'Hung destination circuit open',
    async () => requestJson('/webhooks', { headers: { Authorization: `Bearer ${hungStore.apiKey}` } }),
    (result) =>
      result?.webhooks?.some(
        (hook) => hook.id === hungStore.webhookId && hook.circuit?.state === 'open',
      ),
  );
  const hungHook = hooks.webhooks.find((hook) => hook.id === hungStore.webhookId);

  step('Smoke flow completed');
  console.log(
    JSON.stringify(
      {
        ok: true,
        apiUrl: API_URL,
        hungEvents: HUNG_EVENT_COUNT,
        deliveryTimeoutMs: DELIVERY_TIMEOUT_MS,
        healthyDeliveryMs: elapsedMs,
        budgetMs,
        noBreakerWorstCaseMs: worstCaseMs,
        hungCircuit: hungHook.circuit,
      },
      null,
      2,
    ),
  );
}

try {
  await run();
} catch (error) {
  console.error(`[smoke:webhook-isolation] FAILED: ${formatError(error)}`);
  process.exitCode = 1;
} finally {
  await stopReceivers().catch((error) => {
    console.error(`[smoke:webhook-isolation] Failed to close receivers: ${formatError(error)}`);
    process.exitCode = 1;
  });
}
