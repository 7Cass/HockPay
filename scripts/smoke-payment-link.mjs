import { randomBytes, randomInt } from 'node:crypto';

const API_URL = process.env.HOCKPAY_API_URL ?? 'http://localhost:3000/api/v1';
const runId = `${Date.now()}-${randomInt(1000, 9999)}`;
const cookieJar = new Map();

class SmokeError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SmokeError';
  }
}

function step(message) {
  console.log(`[smoke:payment-link] ${message}`);
}

function assert(condition, message) {
  if (!condition) throw new SmokeError(message);
}

function apiPath(path) {
  return `${API_URL.replace(/\/$/, '')}${path}`;
}

async function requestJson(path, options = {}) {
  const response = await requestMaybeJson(path, options);
  if (!response.ok) {
    throw new SmokeError(
      `${options.method ?? 'GET'} ${path} failed with ${response.status}: ${response.text || 'empty response'}`,
    );
  }

  return response.body;
}

async function requestMaybeJson(path, options = {}) {
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
    return {
      ok: false,
      status: response.status,
      body: responseBody,
      text,
    };
  }

  return {
    ok: true,
    status: response.status,
    body: responseBody,
    text,
  };
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
    throw new SmokeError(`${context} returned non-JSON content: ${text.slice(0, 200)}`);
  }
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
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

/**
 * Pagar um link exige o documento do pagador desde que a API passou a
 * registrar quem pagou. Um unico pagador por run: as corridas concorrentes
 * precisam mandar o mesmo documento para simular a mesma pessoa clicando
 * duas vezes.
 */
function payerBody() {
  return JSON.stringify({
    customer: {
      document: buildCpf(runId),
      name: `Payment Link Payer ${runId}`,
      email: `payment-link-payer-${runId}@hockpay.local`,
    },
  });
}

function randomPassword() {
  return randomBytes(18).toString('base64url');
}

function slugify(value) {
  return value.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

function terminalStatusForAction(action) {
  return {
    confirm: 'CONFIRMED',
    expire: 'EXPIRED',
    fail: 'FAILED',
  }[action];
}

async function createDirectPayment(label, amount) {
  const slug = slugify(label);
  const created = await requestJson('/payments', {
    method: 'POST',
    jwtCookie: true,
    headers: {
      'Idempotency-Key': `payment-link-smoke-${runId}-${slug}`,
    },
    body: JSON.stringify({
      externalId: `payment-link-smoke-${runId}-${slug}`,
      amount,
      description: `Payment link smoke terminal race: ${label}`,
      paymentMethod: 'PIX',
      customer: {
        name: `Payment Link Race Customer ${label}`,
        email: `payment-link-race-${slug}-${runId}@hockpay.local`,
        document: buildCpf(`${Date.now()}${randomInt(1000, 9999)}`),
      },
      metadata: {
        smokeRunId: runId,
        terminalRace: label,
      },
    }),
  });

  const payment = created?.payment;
  assert(payment?.id, `${label}: payment creation did not return an id.`);
  assert(payment.status === 'PENDING', `${label}: new payment should start PENDING.`);
  assert(payment.pixChargeId, `${label}: payment should have a PixCharge.`);

  return payment;
}

async function simulatePaymentAction(paymentId, action, label) {
  const query =
    action === 'fail'
      ? `?reason=${encodeURIComponent(`${label} smoke terminal race`)}`
      : '';

  return requestMaybeJson(`/dev/simulate/${paymentId}/${action}${query}`, {
    method: 'POST',
    jwtCookie: true,
  });
}

async function assertTerminalRace(label, actions, amount) {
  step(`Racing terminal transitions: ${label}`);
  const payment = await createDirectPayment(label, amount);
  const accountBefore = await requestJson('/accounts/me', {
    jwtCookie: true,
  });
  const pendingBefore = accountBefore?.account?.pending ?? 0;

  const responses = await Promise.all(
    actions.map((action) => simulatePaymentAction(payment.id, action, label)),
  );
  const statusSet = responses.map((response) => response.status).join(', ');
  assert(
    responses.every((response) => response.ok || [409, 422].includes(response.status)),
    `${label}: unexpected race response statuses: ${statusSet}.`,
  );
  assert(
    responses.filter((response) => response.ok).length === 1,
    `${label}: expected exactly one successful terminal transition, got ${statusSet}.`,
  );

  const winnerIndex = responses.findIndex((response) => response.ok);
  const winningAction = actions[winnerIndex];
  const expectedStatus = terminalStatusForAction(winningAction);
  const detail = await requestJson(`/payments/${payment.id}`, {
    jwtCookie: true,
  });
  assert(
    detail?.payment?.status === expectedStatus,
    `${label}: expected final payment status ${expectedStatus}, got ${detail?.payment?.status}.`,
  );

  const accountAfter = await requestJson('/accounts/me', {
    jwtCookie: true,
  });
  if (winningAction === 'confirm') {
    assert(
      accountAfter.account.pending === pendingBefore + detail.payment.netAmount,
      `${label}: confirm winner should increment pending balance exactly once.`,
    );
    const receipt = await requestJson(`/receipts/payment/${payment.id}`, {
      jwtCookie: true,
    });
    assert(
      receipt?.receipt?.paymentId === payment.id,
      `${label}: confirm winner should create one receipt.`,
    );
  } else {
    assert(
      accountAfter.account.pending === pendingBefore,
      `${label}: non-confirm winner should not change pending balance.`,
    );
  }
}

async function run() {
  step(`Using API ${API_URL}`);

  const live = await requestJson('/health/live');
  const ready = await requestJson('/health/ready');
  assert(live?.status === 'ok', 'Health live endpoint did not return status=ok.');
  assert(ready?.status === 'ok', 'Health ready endpoint did not return status=ok.');

  const merchantEmail = `smoke-payment-link-${runId}@hockpay.local`;
  const merchantDocument = buildCpf(`${Date.now()}${randomInt(1000, 9999)}`);
  const merchantPassword = randomPassword();

  step('Creating merchant and store');
  const merchant = await requestJson('/merchants', {
    method: 'POST',
    body: JSON.stringify({
      name: `Payment Link Smoke Merchant ${runId}`,
      email: merchantEmail,
      password: merchantPassword,
      document: merchantDocument,
    }),
  });
  assert(merchant?.id, 'Merchant creation did not return an id.');

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
      name: `Payment Link Smoke Store ${runId}`,
      slug: `pl-smoke-${runId}`.replace(/[^a-z0-9-]/g, '-').slice(0, 50),
    }),
  });
  assert(storeResult?.store?.id, 'Store creation did not return a store id.');
  setAuthCookiesFromBody(storeResult);

  step('Creating a payment link without expiration');
  const created = await requestJson('/payment-links', {
    method: 'POST',
    jwtCookie: true,
    headers: {
      'Idempotency-Key': `pl-smoke-${runId}`,
    },
    body: JSON.stringify({
      amount: 2500,
      title: 'Payment Link Smoke',
      internalReference: `pl-smoke-${runId}`,
    }),
  });
  const linkId = created?.paymentLink?.id;
  assert(linkId, 'Payment link creation did not return an id.');
  assert(created.paymentLink.expiresAt === null, 'Payment link should not have an expiration.');
  assert(created.paymentLink.pixCharge?.status === 'OPEN', 'New PixCharge should be OPEN.');

  step('Opening dashboard detail through the API');
  const initialDetail = await requestJson(`/payment-links/${linkId}`, {
    jwtCookie: true,
  });
  assert(initialDetail?.paymentLink?.id === linkId, 'Detail response returned an unexpected link.');
  assert(Array.isArray(initialDetail.paymentLink.attempts), 'Detail response did not include attempts.');
  assert(initialDetail.paymentLink.attempts.length === 0, 'New link should start with zero attempts.');

  step('Failing the first attempt');
  await requestJson(`/payment-links/${linkId}/fail`, {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({ reason: 'smoke simulated failure' }),
  });
  const failedDetail = await requestJson(`/payment-links/${linkId}`, {
    jwtCookie: true,
  });
  assert(failedDetail.paymentLink.pixCharge.status === 'OPEN', 'PixCharge should remain OPEN after failure.');
  assert(failedDetail.paymentLink.status !== 'PAID', 'Payment link should not be PAID after a failed attempt.');
  assert(failedDetail.paymentLink.attempts.length === 1, 'Failed detail should have one attempt.');
  assert(failedDetail.paymentLink.attempts[0].status === 'FAILED', 'First attempt should be FAILED.');
  assert(failedDetail.paymentLink.attempts[0].attemptNumber === 1, 'First attempt should be numbered #1.');

  step('Paying the second attempt');
  await requestJson(`/payment-links/${linkId}/pay`, {
    method: 'POST',
    jwtCookie: true,
    body: payerBody(),
  });
  const paidDetail = await requestJson(`/payment-links/${linkId}`, {
    jwtCookie: true,
  });
  assert(paidDetail.paymentLink.status === 'PAID', 'Payment link should be PAID after pay simulation.');
  assert(paidDetail.paymentLink.pixCharge.status === 'PAID', 'PixCharge should be PAID after pay simulation.');
  assert(paidDetail.paymentLink.attempts.length === 2, 'Paid detail should have two attempts.');
  assert(paidDetail.paymentLink.attempts[1].attemptNumber === 2, 'Second attempt should be numbered #2.');
  assert(
    ['CONFIRMED', 'RELEASED'].includes(paidDetail.paymentLink.attempts[1].status),
    'Second attempt should be confirmed or released.',
  );

  step('Creating a second payment link for concurrent public pay simulation');
  const concurrentCreated = await requestJson('/payment-links', {
    method: 'POST',
    jwtCookie: true,
    headers: {
      'Idempotency-Key': `pl-concurrent-${runId}`,
    },
    body: JSON.stringify({
      amount: 3500,
      title: 'Concurrent Payment Link Smoke',
      internalReference: `pl-concurrent-${runId}`,
    }),
  });
  const concurrentLinkId = concurrentCreated?.paymentLink?.id;
  const concurrentToken = concurrentCreated?.paymentLink?.publicToken;
  assert(concurrentLinkId, 'Concurrent payment link creation did not return an id.');
  assert(concurrentToken, 'Concurrent payment link creation did not return a public token.');

  const accountBeforeConcurrentPay = await requestJson('/accounts/me', {
    jwtCookie: true,
  });
  const pendingBefore = accountBeforeConcurrentPay?.account?.pending ?? 0;

  step('Paying the same public token concurrently');
  const concurrentResponses = await Promise.all(
    Array.from({ length: 5 }, () =>
      requestMaybeJson(`/payment-links/public/${concurrentToken}/pay`, {
        method: 'POST',
        body: payerBody(),
      }),
    ),
  );
  const successfulConcurrentPays = concurrentResponses.filter((response) => response.ok);
  assert(
    concurrentResponses.every(
      (response) => response.ok || [409, 422, 429].includes(response.status),
    ),
    `Concurrent public pay returned an unexpected status set: ${concurrentResponses.map((response) => response.status).join(', ')}`,
  );
  // Pagar um link ja pago devolve o pagamento existente em vez de erro — e o que
  // faz o comprador que clica duas vezes ver a compra dele, nao uma falha. Entao
  // a corrida pode terminar com varias respostas 200; o que nao pode variar e o
  // pagamento por tras delas.
  assert(
    successfulConcurrentPays.length >= 1,
    'Concurrent public pay did not succeed a single time.',
  );
  const concurrentPaymentIds = new Set(
    successfulConcurrentPays.map((response) => response.body?.payment?.id),
  );
  assert(
    concurrentPaymentIds.size === 1,
    `Concurrent public pay should settle on one payment, got ${concurrentPaymentIds.size}: ${[...concurrentPaymentIds].join(', ')}.`,
  );

  const concurrentPayment = successfulConcurrentPays[0].body?.payment;
  assert(concurrentPayment?.id, 'Concurrent pay did not return a payment id.');
  assert(
    concurrentPayment.status === 'CONFIRMED',
    'Concurrent public pay success should return CONFIRMED payment.',
  );

  const concurrentDetail = await requestJson(`/payment-links/${concurrentLinkId}`, {
    jwtCookie: true,
  });
  const confirmedConcurrentAttempts = concurrentDetail.paymentLink.attempts.filter((attempt) =>
    ['CONFIRMED', 'RELEASED'].includes(attempt.status),
  );
  assert(
    confirmedConcurrentAttempts.length === 1,
    'Concurrent public pay should create exactly one confirmed/released attempt.',
  );

  const concurrentReceipt = await requestJson(`/receipts/payment/${concurrentPayment.id}`, {
    jwtCookie: true,
  });
  assert(
    concurrentReceipt?.receipt?.paymentId === concurrentPayment.id,
    'Concurrent public pay should create one receipt for the confirmed payment.',
  );

  const accountAfterConcurrentPay = await requestJson('/accounts/me', {
    jwtCookie: true,
  });
  assert(
    accountAfterConcurrentPay.account.pending === pendingBefore + concurrentPayment.netAmount,
    'Concurrent public pay should increment pending balance exactly once.',
  );

  step('Racing cancel against public pay on a third payment link');
  const cancelRaceCreated = await requestJson('/payment-links', {
    method: 'POST',
    jwtCookie: true,
    headers: {
      'Idempotency-Key': `pl-cancel-race-${runId}`,
    },
    body: JSON.stringify({
      amount: 4100,
      title: 'Cancel Race Payment Link Smoke',
      internalReference: `pl-cancel-race-${runId}`,
    }),
  });
  const cancelRaceLinkId = cancelRaceCreated?.paymentLink?.id;
  const cancelRaceToken = cancelRaceCreated?.paymentLink?.publicToken;
  assert(cancelRaceLinkId, 'Cancel race link creation did not return an id.');
  assert(cancelRaceToken, 'Cancel race link creation did not return a public token.');

  const accountBeforeCancelRace = await requestJson('/accounts/me', {
    jwtCookie: true,
  });
  const cancelRacePendingBefore = accountBeforeCancelRace?.account?.pending ?? 0;

  const [cancelRaceCancel, cancelRacePay] = await Promise.all([
    requestMaybeJson(`/payment-links/${cancelRaceLinkId}/cancel`, {
      method: 'POST',
      jwtCookie: true,
    }),
    requestMaybeJson(`/payment-links/public/${cancelRaceToken}/pay`, {
      method: 'POST',
      body: payerBody(),
    }),
  ]);
  assert(
    [cancelRaceCancel, cancelRacePay].every(
      (response) => response.ok || [409, 422, 429].includes(response.status),
    ),
    `Cancel vs pay race returned unexpected statuses: ${cancelRaceCancel.status}, ${cancelRacePay.status}`,
  );
  assert(
    Number(cancelRaceCancel.ok) + Number(cancelRacePay.ok) === 1,
    `Expected exactly one successful cancel/pay race action, got statuses ${cancelRaceCancel.status}, ${cancelRacePay.status}.`,
  );

  const cancelRaceDetail = await requestJson(`/payment-links/${cancelRaceLinkId}`, {
    jwtCookie: true,
  });
  const cancelRaceAccountAfter = await requestJson('/accounts/me', {
    jwtCookie: true,
  });

  if (cancelRacePay.ok) {
    const racePayment = cancelRacePay.body?.payment;
    const confirmedRaceAttempts = cancelRaceDetail.paymentLink.attempts.filter((attempt) =>
      ['CONFIRMED', 'RELEASED'].includes(attempt.status),
    );
    assert(cancelRaceDetail.paymentLink.status === 'PAID', 'Pay winner should leave link PAID.');
    assert(confirmedRaceAttempts.length === 1, 'Pay winner should create one confirmed attempt.');
    assert(
      cancelRaceAccountAfter.account.pending === cancelRacePendingBefore + racePayment.netAmount,
      'Pay winner should increment pending balance exactly once.',
    );
  } else {
    assert(
      cancelRaceDetail.paymentLink.status === 'CANCELLED',
      'Cancel winner should leave link CANCELLED.',
    );
    assert(
      cancelRaceDetail.paymentLink.attempts.length === 0,
      'Cancel winner should not create payment attempts.',
    );
    assert(
      cancelRaceAccountAfter.account.pending === cancelRacePendingBefore,
      'Cancel winner should not change pending balance.',
    );
  }

  await assertTerminalRace('confirm-vs-expire', ['confirm', 'expire'], 4300);
  await assertTerminalRace('confirm-vs-fail', ['confirm', 'fail'], 4400);
  await assertTerminalRace('fail-vs-expire', ['fail', 'expire'], 4500);

  // ── Cobranca por catalogo ────────────────────────────────────────────
  step('Creating a product to back a catalog payment link');
  const productResult = await requestJson('/products', {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({
      name: 'Camiseta Smoke',
      description: 'Produto do smoke de payment link',
      price: 4500,
      externalId: `sku-smoke-${runId}`,
    }),
  });
  const productId = productResult?.product?.id;
  assert(productId, 'Product creation did not return an id.');

  step('Creating a payment link priced from catalog items');
  const catalogCreated = await requestJson('/payment-links', {
    method: 'POST',
    jwtCookie: true,
    headers: {
      'Idempotency-Key': `pl-smoke-items-${runId}`,
    },
    body: JSON.stringify({
      items: [{ productId, quantity: 3 }],
      title: 'Catalog Payment Link Smoke',
      internalReference: `pl-smoke-items-${runId}`,
    }),
  });
  const catalogLinkId = catalogCreated?.paymentLink?.id;
  const catalogToken = catalogCreated?.paymentLink?.publicToken;
  assert(catalogLinkId, 'Catalog payment link creation did not return an id.');
  // O valor vem da soma dos itens, nunca do cliente.
  assert(
    catalogCreated.paymentLink.amount === 13500,
    `Catalog link amount should be 13500, got ${catalogCreated.paymentLink.amount}.`,
  );
  assert(
    catalogCreated.paymentLink.pixCharge?.amount === 13500,
    'PixCharge should freeze the same catalog total.',
  );

  step('Rejecting a payment link that sends amount and items together');
  const bothResponse = await requestMaybeJson('/payment-links', {
    method: 'POST',
    jwtCookie: true,
    headers: {
      'Idempotency-Key': `pl-smoke-both-${runId}`,
    },
    body: JSON.stringify({ amount: 2500, items: [{ productId, quantity: 1 }] }),
  });
  assert(
    bothResponse.status === 400 || bothResponse.status === 422,
    `Sending amount and items together should be rejected, got ${bothResponse.status}.`,
  );

  step('Checking the public catalog link exposes its items without metadata');
  const publicCatalog = await requestJson(`/payment-links/public/${catalogToken}`);
  const publicItems = publicCatalog?.paymentLink?.items;
  assert(Array.isArray(publicItems) && publicItems.length === 1, 'Public link did not expose items.');
  assert(publicItems[0].quantity === 3, 'Public item quantity did not survive.');
  assert(publicItems[0].totalPrice === 13500, 'Public item total did not survive.');
  assert(publicItems[0].metadata === undefined, 'Public item must not leak metadata.');
  assert(publicItems[0].productId === undefined, 'Public item must not leak productId.');

  step('Failing a catalog attempt and checking it carries the same basket');
  await requestJson(`/payment-links/${catalogLinkId}/fail`, {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({ reason: 'smoke catalog failure' }),
  });
  const catalogAfterFail = await requestJson(`/payment-links/${catalogLinkId}`, {
    jwtCookie: true,
  });
  const failedCatalogAttempt = catalogAfterFail?.paymentLink?.attempts?.find(
    attempt => attempt.status === 'FAILED',
  );
  assert(failedCatalogAttempt, 'Catalog link did not produce a failed attempt.');
  assert(
    Array.isArray(failedCatalogAttempt.items) && failedCatalogAttempt.items.length === 1,
    'Failed attempt did not carry the line item snapshot.',
  );

  step('Paying the catalog link and checking the snapshot reached the payment');
  await requestJson(`/payment-links/${catalogLinkId}/pay`, {
    method: 'POST',
    jwtCookie: true,
    body: payerBody(),
  });
  const catalogDetail = await requestJson(`/payment-links/${catalogLinkId}`, {
    jwtCookie: true,
  });
  const catalogAttempt = catalogDetail?.paymentLink?.attempts?.find(
    attempt => attempt.status === 'CONFIRMED' || attempt.status === 'RELEASED',
  );
  assert(catalogAttempt, 'Catalog link did not produce a confirmed payment.');
  assert(
    Array.isArray(catalogAttempt.items) && catalogAttempt.items.length === 1,
    'Confirmed payment did not carry the line item snapshot.',
  );
  assert(
    catalogAttempt.items[0].totalPrice === 13500,
    'Payment item snapshot lost the catalog total.',
  );

  step('Checking the snapshot survives a later product price change');
  await requestJson(`/products/${productId}`, {
    method: 'PATCH',
    jwtCookie: true,
    body: JSON.stringify({ price: 9900 }),
  });
  const afterPriceChange = await requestJson(`/payment-links/${catalogLinkId}`, {
    jwtCookie: true,
  });
  assert(
    afterPriceChange.paymentLink.amount === 13500,
    'Editing the product must not change an existing link amount.',
  );
  assert(
    afterPriceChange.paymentLink.items[0].unitPrice === 4500,
    'Editing the product must not change the frozen item snapshot.',
  );

  step('Validating list conversion and grouped attempts');
  const list = await requestJson('/payment-links?limit=10', {
    jwtCookie: true,
  });
  assert(list?.stats?.total >= 1, 'Payment link list did not return stats.');
  assert(list.stats.paid >= 1, 'Payment link conversion stats did not count the paid link.');
  assert(list.stats.conversionRate > 0, 'Payment link conversion rate should be positive.');

  step('Subscribing a webhook to the payment link lifecycle');
  // O catalogo em docs/EVENTS.md promete que os quatro payment_link.* sao
  // assinaveis. Se um deles nao estiver em ALLOWED_WEBHOOK_EVENTS, a API
  // responde 400 aqui em vez de deixar a doc prometer o que nao entrega.
  const lifecycleEvents = [
    'payment_link.created',
    'payment_link.paid',
    'payment_link.expired',
    'payment_link.cancelled',
  ];
  const hook = await requestJson('/webhooks', {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({
      url: 'http://localhost:4599/webhook',
      events: lifecycleEvents,
    }),
  });
  assert(
    lifecycleEvents.every((event) => hook?.events?.includes(event)),
    `Webhook config did not keep the payment link lifecycle events: ${JSON.stringify(hook?.events)}`,
  );

  step('Rejecting a webhook subscribed to an event outside the catalog');
  const bogus = await requestMaybeJson('/webhooks', {
    method: 'POST',
    jwtCookie: true,
    body: JSON.stringify({
      url: 'http://localhost:4599/webhook',
      events: ['payment_link.vanished'],
    }),
  });
  assert(bogus.status === 400, `Expected 400 for an uncatalogued event, got ${bogus.status}.`);

  step('Smoke flow completed');
  console.log(
    JSON.stringify(
      {
        ok: true,
        apiUrl: API_URL,
        paymentLinkId: linkId,
        attempts: paidDetail.paymentLink.attempts.map((attempt) => ({
          id: attempt.id,
          status: attempt.status,
          attemptNumber: attempt.attemptNumber,
        })),
        conversionRate: list.stats.conversionRate,
      },
      null,
      2,
    ),
  );
}

try {
  await run();
} catch (error) {
  console.error(`[smoke:payment-link] FAILED: ${formatError(error)}`);
  process.exitCode = 1;
}
