import { spawn } from 'node:child_process';
import {
  SmokeError,
  assert,
  buildCpf,
  createApiClient,
  formatError,
  pollUntil,
  randomRunId,
  readEnvInt,
} from './smoke/lib/smoke-utils.mjs';

const API_URL = process.env.HOCKPAY_API_URL ?? 'http://localhost:3000/api/v1';
const CHECKOUT_URL = process.env.HOCKPAY_CHECKOUT_URL ?? 'http://localhost:3333';
const DEMO_URL = process.env.HOCKPAY_STUDYCASE_DEMO_URL ?? 'http://localhost:3005';
const DEMO_PORT = readEnvInt('HOCKPAY_STUDYCASE_DEMO_PORT', 3005, 1);
const TIMEOUT_MS = readEnvInt('HOCKPAY_SMOKE_TIMEOUT_MS', 60000, 1000);
const START_DEMO = process.env.HOCKPAY_STUDYCASE_START_DEMO !== 'false';
const PASSWORD = '12345678';
const runId = randomRunId();

const api = createApiClient(API_URL, { timeoutMs: TIMEOUT_MS });
const demo = createApiClient(DEMO_URL, { timeoutMs: TIMEOUT_MS });

let demoProcess;

function step(message) {
  console.log(`[smoke:studycase:mediakit] ${message}`);
}

function apiKeyHeaders(apiKey) {
  return { Authorization: `Bearer ${apiKey}` };
}

async function run() {
  step(`Using API ${API_URL}`);
  step(`Using checkout ${CHECKOUT_URL}`);
  step(`Using MediaKit demo ${DEMO_URL}`);

  const live = await api.requestJson('/health/live');
  const ready = await api.requestJson('/health/ready');
  assert(live?.status === 'ok', 'Health live endpoint did not return status=ok.');
  assert(ready?.status === 'ok', 'Health ready endpoint did not return status=ok.');

  const { apiKey, webhook, merchantEmail, storeId } = await createMerchantStoreAndWebhook();

  if (START_DEMO) {
    await startDemoServer(apiKey.plainKey, webhook.secret);
  } else {
    step('Skipping demo startup because HOCKPAY_STUDYCASE_START_DEMO=false');
  }

  await waitForDemo();

  const sessionId = `mediakit-smoke-${runId}`;
  const checkoutUrl = await createDemoCheckoutSession(sessionId);
  const checkoutToken = extractCheckoutToken(checkoutUrl);

  step('Fulfilling hosted checkout session');
  const fulfilled = await api.requestJson(`/checkout-sessions/${checkoutToken}/fulfill`, {
    method: 'POST',
    body: JSON.stringify({
      customer: {
        name: 'MediaKit Smoke Buyer',
        email: `buyer-${runId}@hockpay.local`,
        document: buildCpf(`${Date.now()}${runId}`),
      },
    }),
  });
  assert(fulfilled?.paymentId, 'Checkout fulfillment did not return a payment id.');

  step('Confirming payment in TEST mode');
  await api.requestJson(`/dev/simulate/${fulfilled.paymentId}/confirm`, {
    method: 'POST',
    headers: apiKeyHeaders(apiKey.plainKey),
  });

  step('Verifying account, receipt and payment timeline');
  const account = await api.requestJson('/accounts/me', {
    headers: apiKeyHeaders(apiKey.plainKey),
  });
  assert(account?.account?.storeId === storeId, 'Account lookup did not match the study-case store.');

  const receipt = await pollUntil(
    'Receipt by payment',
    async () => readOptionalReceiptByPayment(apiKey.plainKey, fulfilled.paymentId),
    (result) => result?.receipt?.paymentId === fulfilled.paymentId,
    { timeoutMs: TIMEOUT_MS, intervalMs: 1000 },
  );

  const timeline = await api.requestJson(`/payments/${fulfilled.paymentId}/timeline`, {
    headers: apiKeyHeaders(apiKey.plainKey),
  });
  assert(timeline?.payment?.id === fulfilled.paymentId, 'Timeline returned an unexpected payment.');
  assert(timeline?.receipt?.paymentId === fulfilled.paymentId, 'Timeline did not include the receipt.');
  assert(
    timeline?.timeline?.some((event) => event.type === 'payment.confirmed'),
    'Timeline did not include payment.confirmed.',
  );

  step('Waiting for MediaKit demo to receive webhook and render ready state');
  const record = await pollUntil(
    'MediaKit ready state',
    () => demo.requestJson(`/api/mediakit?sessionId=${sessionId}`),
    (result) => result?.status === 'ready' && result?.data?.sessionId === sessionId,
    { timeoutMs: TIMEOUT_MS, intervalMs: 1000 },
  );

  step('Verifying delivered webhook log');
  const logs = await pollUntil(
    'Delivered MediaKit webhook log',
    () =>
      api.requestJson(`/webhooks/${webhook.id}/logs?status=delivered`, {
        headers: apiKeyHeaders(apiKey.plainKey),
      }),
    (result) =>
      result?.logs?.some(
        (log) => log.paymentId === fulfilled.paymentId && log.eventType === 'payment.confirmed',
      ),
    { timeoutMs: TIMEOUT_MS, intervalMs: 1000 },
  );

  step('Study-case smoke completed');
  console.log(
    JSON.stringify(
      {
        ok: true,
        apiUrl: API_URL,
        checkoutUrl,
        demoUrl: DEMO_URL,
        merchantEmail,
        storeId,
        webhookId: webhook.id,
        sessionId,
        checkoutToken,
        paymentId: fulfilled.paymentId,
        receiptId: receipt.receipt.id,
        deliveredLogId: logs.logs.find((log) => log.paymentId === fulfilled.paymentId)?.id,
        renderedStatus: record.status,
      },
      null,
      2,
    ),
  );
}

async function createMerchantStoreAndWebhook() {
  const merchantEmail = `studycase-mediakit-${runId}@hockpay.local`;

  step('Creating merchant and store');
  const merchant = await api.requestJson('/merchants', {
    method: 'POST',
    body: JSON.stringify({
      name: `MediaKit Study Case ${runId}`,
      email: merchantEmail,
      password: PASSWORD,
      document: buildCpf(`${Date.now()}${runId}`),
    }),
  });
  assert(merchant?.id, 'Merchant creation did not return an id.');

  const login = await api.requestJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: merchantEmail,
      password: PASSWORD,
    }),
  });
  assert(login?.accessToken, 'Login did not return an access token.');
  api.cookieJar.setFromAuthBody(login);

  const storeResult = await api.requestJson('/stores', {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({
      name: `MediaKit Study Store ${runId}`,
      slug: `mediakit-study-${runId}`.replace(/[^a-z0-9-]/g, '-').slice(0, 50),
    }),
  });
  const storeId = storeResult?.store?.id;
  assert(storeId, 'Store creation did not return a store id.');
  api.cookieJar.setFromAuthBody(storeResult);

  step('Creating TEST API key and demo webhook config');
  const apiKey = await api.requestJson('/api-keys', {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({
      name: `MediaKit Study Key ${runId}`,
      environment: 'TEST',
    }),
  });
  assert(apiKey?.plainKey, 'API key creation did not return plainKey.');

  const webhook = await api.requestJson('/webhooks', {
    method: 'POST',
    headers: apiKeyHeaders(apiKey.plainKey),
    body: JSON.stringify({
      url: `${DEMO_URL.replace(/\/$/, '')}/api/webhook`,
      events: ['payment.confirmed', 'payment.failed', 'payment.expired'],
    }),
  });
  assert(webhook?.id, 'Webhook creation did not return an id.');
  assert(webhook?.secret, 'Webhook creation did not return the plain secret.');

  return { apiKey, webhook, merchantEmail, storeId };
}

async function startDemoServer(apiKey, webhookSecret) {
  step(`Starting MediaKit demo on port ${DEMO_PORT}`);
  demoProcess = spawn(
    'pnpm',
    ['--filter', '@hockpay/demo-mediakit', 'exec', 'next', 'dev', '-p', String(DEMO_PORT)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOCKPAY_BASE_URL: API_URL.replace(/\/api\/v1\/?$/, ''),
        HOCKPAY_API_KEY: apiKey,
        HOCKPAY_WEBHOOK_SECRET: webhookSecret,
        NEXT_PUBLIC_APP_URL: DEMO_URL,
        PORT: String(DEMO_PORT),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  demoProcess.stdout?.on('data', (chunk) => {
    const text = chunk.toString().trim();
    if (text) console.log(`[demo-mediakit] ${text}`);
  });
  demoProcess.stderr?.on('data', (chunk) => {
    const text = chunk.toString().trim();
    if (text) console.error(`[demo-mediakit] ${text}`);
  });
  demoProcess.once('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`[demo-mediakit] exited with code ${code}`);
    }
  });
}

async function waitForDemo() {
  await pollUntil(
    'MediaKit demo',
    async () => {
      try {
        const response = await fetch(DEMO_URL, { redirect: 'manual' });
        return { ok: response.ok || response.status < 500, status: response.status };
      } catch (error) {
        return { ok: false, error: formatError(error) };
      }
    },
    (result) => result.ok,
    { timeoutMs: TIMEOUT_MS, intervalMs: 1000 },
  );
}

async function createDemoCheckoutSession(sessionId) {
  step('Creating checkout session through the MediaKit demo route');
  const result = await demo.requestJson('/api/create-session', {
    method: 'POST',
    body: JSON.stringify({
      sessionId,
      creatorName: 'MediaKit Smoke Creator',
      bio: 'Criador usado pelo smoke do study-case P3.',
      niche: 'Tecnologia',
      location: 'Sao Paulo, BR',
      socials: {
        instagram: { followers: '100K', engagement: '4.2%' },
        tiktok: { followers: '250K', engagement: '6.1%' },
        youtube: { followers: '50K', engagement: '3.8%' },
      },
      audience: {
        age: '18-34 (72%)',
        gender: '60% M / 38% F',
        topCountries: 'BR, PT, US',
      },
      rates: {
        post: 'R$ 2.500',
        story: 'R$ 1.200',
        video: 'R$ 5.000',
      },
    }),
  });

  assert(result?.checkoutUrl, 'Demo create-session did not return checkoutUrl.');
  return result.checkoutUrl;
}

function extractCheckoutToken(checkoutUrl) {
  const parsed = new URL(checkoutUrl, CHECKOUT_URL);
  const token = parsed.pathname.split('/').filter(Boolean).at(0);
  assert(token, `Could not extract checkout token from ${checkoutUrl}`);
  return token;
}

async function readOptionalReceiptByPayment(apiKey, paymentId) {
  try {
    return await api.requestJson(`/receipts/payment/${paymentId}`, {
      headers: apiKeyHeaders(apiKey),
    });
  } catch (error) {
    if (error instanceof SmokeError && error.message.includes('failed with 404')) {
      return null;
    }
    throw error;
  }
}

async function stopDemoServer() {
  if (!demoProcess || demoProcess.killed) return;
  demoProcess.kill('SIGTERM');
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3000);
    demoProcess.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

try {
  await run();
} catch (error) {
  console.error(`[smoke:studycase:mediakit] FAILED: ${formatError(error)}`);
  if (error instanceof SmokeError && error.details) {
    console.error(JSON.stringify(error.details, null, 2));
  }
  process.exitCode = 1;
} finally {
  await stopDemoServer().catch((error) => {
    console.error(`[smoke:studycase:mediakit] Failed to stop demo: ${formatError(error)}`);
    process.exitCode = 1;
  });
}
