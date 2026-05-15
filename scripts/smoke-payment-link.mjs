import { randomInt } from 'node:crypto';

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
    throw new SmokeError(
      `${fetchOptions.method ?? 'GET'} ${path} failed with ${response.status}: ${text || 'empty response'}`,
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

async function run() {
  step(`Using API ${API_URL}`);

  const live = await requestJson('/health/live');
  const ready = await requestJson('/health/ready');
  assert(live?.status === 'ok', 'Health live endpoint did not return status=ok.');
  assert(ready?.status === 'ok', 'Health ready endpoint did not return status=ok.');

  const merchantEmail = `smoke-payment-link-${runId}@hockpay.local`;
  const merchantDocument = buildCpf(`${Date.now()}${randomInt(1000, 9999)}`);

  step('Creating merchant and store');
  const merchant = await requestJson('/merchants', {
    method: 'POST',
    body: JSON.stringify({
      name: `Payment Link Smoke Merchant ${runId}`,
      email: merchantEmail,
      password: '12345678',
      document: merchantDocument,
    }),
  });
  assert(merchant?.id, 'Merchant creation did not return an id.');

  const login = await requestJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: merchantEmail,
      password: '12345678',
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

  step('Validating list conversion and grouped attempts');
  const list = await requestJson('/payment-links?limit=10', {
    jwtCookie: true,
  });
  assert(list?.stats?.total >= 1, 'Payment link list did not return stats.');
  assert(list.stats.paid >= 1, 'Payment link conversion stats did not count the paid link.');
  assert(list.stats.conversionRate > 0, 'Payment link conversion rate should be positive.');

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
